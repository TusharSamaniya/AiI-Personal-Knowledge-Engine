import logging
import os
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
import httpx


from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(tags=["contact"])

EMAIL_RE = re.compile(r"^[^\s@<>\"',;]+@[^\s@<>\"',;]+\.[^\s@<>\"',;]+$")

# Simple per-IP rate limit so nobody can spam your inbox: 5 messages / hour.
RATE_LIMIT = 5
RATE_WINDOW_SECONDS = 3600
_hits: dict[str, deque] = defaultdict(deque)


class ContactIn(BaseModel):
    email: str = Field(..., max_length=254)
    subject: str = Field(..., min_length=1, max_length=150)
    message: str = Field(..., min_length=1, max_length=5000)


def _check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > RATE_WINDOW_SECONDS:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        raise HTTPException(429, "Too many messages. Please try again later.")
    q.append(now)

def _send_email(visitor_email: str, subject: str, message: str, ip: str) -> None:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    to_addr = os.getenv("CONTACT_TO_EMAIL", "").strip()
    from_addr = os.getenv("CONTACT_FROM_EMAIL", "Knowledge Engine <onboarding@resend.dev>").strip()

    if not api_key or not to_addr:
        logger.error("Contact form: RESEND_API_KEY / CONTACT_TO_EMAIL are not set")
        raise HTTPException(503, "The contact service is not configured yet.")

    text = (
        f"New message from your website contact form\n"
        f"{'-' * 44}\n"
        f"From:    {visitor_email}\n"
        f"Subject: {subject}\n"
        f"Time:    {datetime.now(timezone.utc):%Y-%m-%d %H:%M UTC}\n"
        f"IP:      {ip}\n"
        f"{'-' * 44}\n\n"
        f"{message}\n"
    )

    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from": from_addr,
                "to": [to_addr],
                "reply_to": visitor_email,
                "subject": f"[Knowledge Engine] {subject}",
                "text": text,
            },
            timeout=15,
        )
    except httpx.HTTPError as exc:
        logger.error("Contact form: could not reach Resend: %s", exc)
        raise HTTPException(502, "The message could not be sent right now. Please try again later.")

    if resp.status_code >= 400:
        logger.error("Contact form: Resend rejected the email (%s): %s", resp.status_code, resp.text)
        raise HTTPException(502, "The message could not be sent right now. Please try again later.")

@router.post("/contact")
def send_contact_message(payload: ContactIn, request: Request):
    # `def` (not async) so FastAPI runs this blocking SMTP call in a worker thread.
    email = payload.email.strip()
    subject = " ".join(payload.subject.split())          # strips CR/LF -> no header injection
    message = payload.message.strip()

    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Please enter a valid email address.")
    if not subject or not message:
        raise HTTPException(422, "Subject and message are required.")

    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)
    _send_email(email, subject, message, ip)
    return {"message": "Your message has been sent."}

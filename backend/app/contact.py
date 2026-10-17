"""
Contact-form endpoint.

POST /contact   { "email": "...", "subject": "...", "message": "..." }

Sends the visitor's message to YOUR inbox over SMTP. The visitor's address is
set as Reply-To, so pressing "Reply" in Gmail answers them directly.

Required .env settings (backend/.env):
    SMTP_USER=you@gmail.com            # the Gmail account that SENDS the mail
    SMTP_PASSWORD=abcdefghijklmnop     # Gmail *App Password* (NOT your login password)
Optional:
    CONTACT_TO_EMAIL=you@gmail.com     # where messages arrive (defaults to SMTP_USER)
    SMTP_HOST=smtp.gmail.com           # default
    SMTP_PORT=465                      # 465 = SSL (default), 587 = STARTTLS
"""
import logging
import os
import re
import smtplib
import ssl
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from email.message import EmailMessage

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
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()  # app passwords are shown with spaces
    host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    port = int(os.getenv("SMTP_PORT", "465"))
    to_addr = os.getenv("CONTACT_TO_EMAIL", "").strip() or user

    if not user or not password:
        logger.error("Contact form: SMTP_USER / SMTP_PASSWORD are not set in backend/.env")
        raise HTTPException(503, "The contact service is not configured yet.")

    msg = EmailMessage()
    msg["From"] = f"Knowledge Engine Contact <{user}>"   # Gmail only allows your own address here
    msg["To"] = to_addr
    msg["Reply-To"] = visitor_email
    msg["Subject"] = f"[Knowledge Engine] {subject}"
    msg.set_content(
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
        context = ssl.create_default_context()
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=15, context=context) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.starttls(context=context)
                server.login(user, password)
                server.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        logger.error("Contact form: SMTP login failed. Use a Gmail App Password, not your normal password.")
        raise HTTPException(502, "The message could not be sent right now. Please try again later.")
    except (smtplib.SMTPException, OSError) as exc:
        logger.error("Contact form: could not send email: %s", exc)
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

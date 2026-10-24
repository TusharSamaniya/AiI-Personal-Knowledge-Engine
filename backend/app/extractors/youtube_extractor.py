import re
from urllib.parse import urlparse, parse_qs
import os
from google import genai
from google.genai import types

from youtube_transcript_api import YouTubeTranscriptApi

_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
_YOUTUBE_HOSTS = {"youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"}


def extract_video_id(url: str) -> str:
    """
    Return the 11-character video ID from any common YouTube link:
      https://www.youtube.com/watch?v=ID&t=30s
      https://youtu.be/ID?si=...
      https://www.youtube.com/shorts/ID
      https://www.youtube.com/live/ID
      https://www.youtube.com/embed/ID   (and /v/ID)
      https://m.youtube.com/watch?v=ID   /   https://music.youtube.com/watch?v=ID
    """
    raw = (url or "").strip()
    if not raw:
        raise ValueError("Invalid YouTube URL. Could not find video ID.")
    if "://" not in raw:
        raw = "https://" + raw

    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    parts = [p for p in parsed.path.split("/") if p]

    candidate = None
    if host == "youtu.be":
        candidate = parts[0] if parts else None
    elif host in _YOUTUBE_HOSTS:
        if parts and parts[0] in {"shorts", "live", "embed", "v"} and len(parts) > 1:
            candidate = parts[1]
        else:
            candidate = parse_qs(parsed.query).get("v", [None])[0]

    if candidate and _ID_RE.match(candidate):
        return candidate

    # Last resort for odd formats: look for an ID after a known marker.
    if "youtube" in host or host == "youtu.be":
        m = re.search(r"(?:v=|youtu\.be/|embed/|shorts/|live/)([A-Za-z0-9_-]{11})", url)
        if m:
            return m.group(1)
    raise ValueError("Invalid YouTube URL. Could not find video ID.")


def _transcript_via_api(video_id: str) -> str:
    ytt_api = YouTubeTranscriptApi()
    transcript_list = ytt_api.list(video_id)
    try:
        transcript = transcript_list.find_transcript(['en'])
    except Exception:
        transcript = next(iter(transcript_list))
    fetched = transcript.fetch()
    return " ".join(snippet.text for snippet in fetched)


def _transcript_via_gemini(video_id: str) -> str:
    """Ask Gemini to read the public YouTube video and return its spoken content."""
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    model = os.getenv("GEMINI_VIDEO_MODEL", "gemini-2.5-flash")

    response = client.models.generate_content(
        model=model,
        contents=types.Content(parts=[
            types.Part(file_data=types.FileData(
                file_uri=f"https://www.youtube.com/watch?v={video_id}"
            )),
            types.Part(text=(
                "Write out everything that is said in this video as plain text, "
                "in the language spoken. If there is little or no speech, describe "
                "in detail what the video shows and any on-screen text. "
                "Output only the text, with no introduction or commentary."
            )),
        ]),
        config=types.GenerateContentConfig(
            media_resolution=types.MediaResolution.MEDIA_RESOLUTION_LOW
        ),
    )
    text = (response.text or "").strip()
    if not text:
        raise ValueError("Gemini returned no content for this video.")
    return text


def extract_youtube_text(url: str) -> str:
    video_id = extract_video_id(url)

    # 1) Try the transcript API (works when YouTube doesn't block the server's IP)
    try:
        return _transcript_via_api(video_id)
    except Exception:
        pass

    # 2) Fall back to Gemini, which reads the video on Google's side
    try:
        return _transcript_via_gemini(video_id)
    except Exception as e:
        raise ValueError(f"Could not read this YouTube video: {e}")
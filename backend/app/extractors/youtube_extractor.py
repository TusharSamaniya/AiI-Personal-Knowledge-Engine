import re
from urllib.parse import urlparse, parse_qs

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


def extract_youtube_text(url: str) -> str:
    video_id = extract_video_id(url)

    try:
        ytt_api = YouTubeTranscriptApi()
        transcript_list = ytt_api.list(video_id)

        # Try to find English first, then fall back to any available transcript
        try:
            transcript = transcript_list.find_transcript(['en'])
        except Exception:
            # English not available, get the first available one
            transcript = next(iter(transcript_list))

        fetched = transcript.fetch()
        return " ".join(snippet.text for snippet in fetched)
    except Exception as e:
        raise ValueError(f"Could not fetch transcript: {str(e)}")

import re
from youtube_transcript_api import YouTubeTranscriptApi

def extract_youtube_text(url: str) -> str:
    # Extract video ID from any YouTube URL format
    match = re.search(r"(?:v=|youtu\.be/|embed/)([a-zA-Z0-9_-]{11})", url)
    if not match:
        raise ValueError("Invalid YouTube URL. Could not find video ID.")
    
    video_id = match.group(1)
    
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
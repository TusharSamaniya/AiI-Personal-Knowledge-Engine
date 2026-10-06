import os
import re
import httpx
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize"
SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access"
SLACK_API_BASE = "https://slack.com/api"


def get_slack_auth_url(state: str) -> str:
    """Build the URL that sends users to Slack's consent page."""
    client_id = os.getenv("SLACK_CLIENT_ID")
    redirect_uri = os.getenv("SLACK_REDIRECT_URI")
    
    scopes = ",".join([
        "channels:history",
        "channels:read",
        "groups:history",
        "groups:read",
        "users:read",
        "team:read"
    ])
    
    return (
        f"{SLACK_AUTHORIZE_URL}"
        f"?client_id={client_id}"
        f"&scope={scopes}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
    )


async def exchange_code_for_token(code: str) -> dict:
    """Exchange the OAuth code for a Bot User OAuth Token."""
    client_id = os.getenv("SLACK_CLIENT_ID")
    client_secret = os.getenv("SLACK_CLIENT_SECRET")
    redirect_uri = os.getenv("SLACK_REDIRECT_URI")
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            SLACK_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri
            }
        )
        response.raise_for_status()
        data = response.json()
        if not data.get("ok"):
            raise ValueError(f"Slack token exchange failed: {data.get('error')}")
        return data


async def list_slack_channels(access_token: str) -> list:
    """List all channels the bot has access to."""
    headers = {"Authorization": f"Bearer {access_token}"}
    channels = []
    cursor = ""
    
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            params = {
                "types": "public_channel,private_channel",
                "limit": 200,
                "exclude_archived": "true"
            }
            if cursor:
                params["cursor"] = cursor
            
            response = await client.get(
                f"{SLACK_API_BASE}/conversations.list",
                headers=headers,
                params=params
            )
            response.raise_for_status()
            data = response.json()
            if not data.get("ok"):
                raise ValueError(f"Slack API error: {data.get('error')}")
            
            channels.extend(data.get("channels", []))
            cursor = data.get("response_metadata", {}).get("next_cursor", "")
            if not cursor:
                break
    
    return channels


async def list_slack_users(access_token: str) -> dict:
    """Fetch a mapping of user_id -> display_name."""
    headers = {"Authorization": f"Bearer {access_token}"}
    user_map = {}
    cursor = ""
    
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            params = {"limit": 200}
            if cursor:
                params["cursor"] = cursor
            
            response = await client.get(
                f"{SLACK_API_BASE}/users.list",
                headers=headers,
                params=params
            )
            response.raise_for_status()
            data = response.json()
            if not data.get("ok"):
                raise ValueError(f"Slack API error: {data.get('error')}")
            
            for member in data.get("members", []):
                if member.get("deleted") or member.get("is_bot"):
                    continue
                profile = member.get("profile", {})
                name = (
                    profile.get("display_name")
                    or profile.get("real_name")
                    or member.get("name")
                    or member.get("id")
                )
                user_map[member["id"]] = name
            
            cursor = data.get("response_metadata", {}).get("next_cursor", "")
            if not cursor:
                break
    
    return user_map


async def fetch_channel_messages(access_token: str, channel_id: str, limit_per_page: int = 200) -> list:
    """Fetch ALL messages from a channel, newest-first."""
    headers = {"Authorization": f"Bearer {access_token}"}
    all_messages = []
    cursor = ""
    
    async with httpx.AsyncClient(timeout=60) as client:
        while True:
            params = {
                "channel": channel_id,
                "limit": limit_per_page
            }
            if cursor:
                params["cursor"] = cursor
            
            response = await client.get(
                f"{SLACK_API_BASE}/conversations.history",
                headers=headers,
                params=params
            )
            response.raise_for_status()
            data = response.json()
            
            if not data.get("ok"):
                error = data.get("error")
                if error == "not_in_channel":
                    raise ValueError(f"Bot is not a member of channel {channel_id}.")
                raise ValueError(f"Slack API error: {error}")
            
            all_messages.extend(data.get("messages", []))
            cursor = data.get("response_metadata", {}).get("next_cursor", "")
            if not cursor:
                break
    
    all_messages.reverse()
    return all_messages


def format_messages(messages: list, user_map: dict) -> str:
    """Convert raw Slack JSON into readable conversation text."""
    lines = []
    
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        
        # Skip subtypes that add noise
        subtype = msg.get("subtype")
        if subtype in ("channel_join", "channel_leave", "bot_message", "channel_topic", "channel_purpose"):
            continue
        
        # SAFELY get the text field
        raw_text = msg.get("text")
        if raw_text is None or not isinstance(raw_text, str):
            raw_text = _extract_from_blocks(msg.get("blocks", []))
        
        if not raw_text or not raw_text.strip():
            continue
        
        text = raw_text.strip()
        
        # Resolve user IDs
        try:
            for uid, name in user_map.items():
                text = text.replace(f"<@{uid}>", f"@{name}")
        except Exception:
            pass
        
        # Resolve channel mentions and URLs
        try:
            text = _replace_channel_mentions(text)
        except Exception:
            pass
        try:
            text = _clean_urls(text)
        except Exception:
            pass
        
        # Timestamp
        ts = msg.get("ts", "")
        try:
            timestamp = datetime.fromtimestamp(float(ts)).strftime("%Y-%m-%d %H:%M")
        except (ValueError, TypeError):
            timestamp = "unknown"
        
        # Author
        author_id = msg.get("user")
        if not author_id:
            author = msg.get("username") or msg.get("bot_id") or "unknown"
        else:
            author = user_map.get(author_id, author_id)
        
        lines.append(f"[{timestamp}] {author}: {text}")
    
    return "\n".join(lines)


def _extract_from_blocks(blocks: list) -> str:
    """Extract text from a Slack 'blocks' structure."""
    if not isinstance(blocks, list):
        return ""
    parts = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        block_type = block.get("type")
        if block_type in ("section", "header"):
            text_obj = block.get("text", {})
            if isinstance(text_obj, dict):
                parts.append(text_obj.get("text", ""))
        elif block_type == "context":
            for elem in block.get("elements", []):
                if isinstance(elem, dict):
                    parts.append(elem.get("text", ""))
    return " ".join(parts)


def _replace_channel_mentions(text: str) -> str:
    """Convert <#C123|general> into #general."""
    def repl(match):
        parts = match.group(1).split("|")
        return f"#{parts[1]}" if len(parts) > 1 else f"#{parts[0]}"
    return re.sub(r"<#([^>]+)>", repl, text)


def _clean_urls(text: str) -> str:
    """Convert <https://x.com|link> into https://x.com."""
    def repl(match):
        parts = match.group(1).split("|")
        return parts[0] if len(parts) > 1 else match.group(1)
    return re.sub(r"<(https?://[^>]+)>", repl, text)

async def join_slack_channel(access_token: str, channel_id: str) -> bool:
    """Make the bot join a public channel. Returns True if successful.
    For private channels, this fails — the user must invite the bot manually.
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{SLACK_API_BASE}/conversations.join",
            headers=headers,
            data={"channel": channel_id}
        )
        response.raise_for_status()
        data = response.json()
        
        if data.get("ok"):
            return True
        
        error = data.get("error")
        if error == "method_not_supported_for_channel_type":
            raise ValueError("This is a private channel. Please type `/invite @AI Knowledge Engine` in the channel.")
        if error == "already_in_channel":
            return True  # Bot is already there, no problem
        raise ValueError(f"Failed to join channel: {error}")
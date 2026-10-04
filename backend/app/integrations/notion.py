import os
import httpx
from dotenv import load_dotenv

load_dotenv()

NOTION_VERSION = "2022-06-28"
NOTION_AUTHORIZE_URL = "https://api.notion.com/v1/oauth/authorize"
NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token"
NOTION_API_BASE = "https://api.notion.com/v1"


def get_notion_auth_url(state: str) -> str:
    """Build the URL where we send users to authorize our app."""
    client_id = os.getenv("NOTION_CLIENT_ID")
    redirect_uri = os.getenv("NOTION_REDIRECT_URI")
    
    return (
        f"{NOTION_AUTHORIZE_URL}"
        f"?client_id={client_id}"
        f"&response_type=code"
        f"&owner=user"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
    )


async def exchange_code_for_token(code: str) -> dict:
    """Exchange the OAuth code for an access token.
    Notion requires HTTP Basic Auth (client_id:client_secret).
    """
    client_id = os.getenv("NOTION_CLIENT_ID")
    client_secret = os.getenv("NOTION_CLIENT_SECRET")
    redirect_uri = os.getenv("NOTION_REDIRECT_URI")
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            NOTION_TOKEN_URL,
            auth=(client_id, client_secret),  # HTTP Basic Auth
            json={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri
            },
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return response.json()


async def list_notion_pages(access_token: str) -> list:
    """List all pages the user has shared with our integration."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
    }
    body = {
        "filter": {"property": "object", "value": "page"},
        "page_size": 50,
        "sort": {"direction": "descending", "timestamp": "last_edited_time"}
    }
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{NOTION_API_BASE}/search",
            headers=headers,
            json=body
        )
        response.raise_for_status()
        data = response.json()
        return data.get("results", [])


async def fetch_page_text(access_token: str, page_id: str) -> str:
    """Recursively walk a Notion page's blocks and extract all text."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Notion-Version": NOTION_VERSION
    }
    
    lines = []
    await _walk_blocks(page_id, headers, lines)
    return "\n".join(lines)


async def _walk_blocks(block_id: str, headers: dict, lines: list, depth: int = 0):
    """Recursively fetch children of a block and append their text to `lines`."""
    if depth > 5:  # Safety: max 5 levels deep
        return
    
    url = f"{NOTION_API_BASE}/blocks/{block_id}/children?page_size=100"
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
    
    for block in data.get("results", []):
        block_type = block.get("type")
        if not block_type:
            continue
        
        block_data = block.get(block_type, {})
        rich_text = block_data.get("rich_text", [])
        
        # Extract plain text from this block
        text = "".join(rt.get("plain_text", "") for rt in rich_text)
        
        # Format certain block types
        if text:
            if block_type == "heading_1":
                text = f"\n# {text}\n"
            elif block_type == "heading_2":
                text = f"\n## {text}\n"
            elif block_type == "heading_3":
                text = f"\n### {text}\n"
            elif block_type == "bulleted_list_item":
                text = f"• {text}"
            elif block_type == "numbered_list_item":
                text = f"- {text}"
            elif block_type == "code":
                text = f"```\n{text}\n```"
            
            lines.append(text)
        
        # If this block has children (nested content), recurse
        if block.get("has_children"):
            await _walk_blocks(block["id"], headers, lines, depth + 1)
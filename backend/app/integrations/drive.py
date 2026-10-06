import os
import httpx
from dotenv import load_dotenv

load_dotenv()

DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"


async def list_drive_files(access_token: str, page_size: int = 50) -> list:
    """List files in the user's Google Drive."""
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {
        "pageSize": page_size,
        "fields": "files(id,name,mimeType,size,modifiedTime)",
        "q": "trashed = false",
        "orderBy": "modifiedTime desc"
    }
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{DRIVE_API_BASE}/files",
            headers=headers,
            params=params
        )
        response.raise_for_status()
        data = response.json()
        return data.get("files", [])


async def download_drive_file(access_token: str, file_id: str) -> bytes:
    """Download a file's raw content from Google Drive."""
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
        response = await client.get(
            f"{DRIVE_API_BASE}/files/{file_id}",
            headers=headers,
            params={"alt": "media"}
        )
        response.raise_for_status()
        return response.content


async def refresh_drive_token(refresh_token: str) -> dict:
    """Exchange a Google refresh token for a fresh access token."""
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            }
        )
        response.raise_for_status()
        return response.json()
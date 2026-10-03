import httpx

DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"


async def list_drive_files(access_token: str, page_size: int = 50) -> list:
    """List files in the user's Google Drive.
    
    Returns a list of dicts with id, name, mimeType, size.
    Only shows files that are documents (PDFs, Docs, Sheets, etc.)
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {
        "pageSize": page_size,
        "fields": "files(id,name,mimeType,size,modifiedTime)",
        "q": "trashed = false",  # Don't show deleted files
        "orderBy": "modifiedTime desc"  # Newest first
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
    """Download a file's raw content from Google Drive.
    
    Returns the file content as bytes (ready to save to disk).
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
        response = await client.get(
            f"{DRIVE_API_BASE}/files/{file_id}",
            headers=headers,
            params={"alt": "media"}  # This tells Drive to send raw file content
        )
        response.raise_for_status()
        return response.content
import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
}

def extract_web_text(url: str) -> str:
    try:
        response = httpx.get(
            url,
            timeout=15,
            follow_redirects=True,
            headers=HEADERS
        )
        response.raise_for_status()
    except Exception as e:
        raise ValueError(f"Could not fetch URL: {str(e)}")
    
    soup = BeautifulSoup(response.text, "html.parser")
    
    # Remove non-content tags
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "iframe"]):
        tag.decompose()
    
    text = soup.get_text(separator="\n", strip=True)
    return text
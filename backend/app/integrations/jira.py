import os
import httpx
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

JIRA_AUTH_URL = "https://auth.atlassian.com/authorize"
JIRA_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
JIRA_API_BASE = "https://api.atlassian.com"
JIRA_SCOPES = "read:jira-work read:jira-user"


def get_jira_auth_url(state: str) -> str:
    """Build the OAuth URL that redirects users to Atlassian's consent page."""
    client_id = os.getenv("JIRA_CLIENT_ID")
    redirect_uri = os.getenv("JIRA_REDIRECT_URI")
    
    return (
        f"{JIRA_AUTH_URL}"
        f"?audience=api.atlassian.com"
        f"&client_id={client_id}"
        f"&scope={JIRA_SCOPES.replace(' ', '%20')}"
        f"&redirect_uri={redirect_uri}"
        f"&state={state}"
        f"&response_type=code"
        f"&prompt=consent"
    )


async def exchange_code_for_token(code: str) -> dict:
    """Exchange the OAuth code for access_token + refresh_token."""
    client_id = os.getenv("JIRA_CLIENT_ID")
    client_secret = os.getenv("JIRA_CLIENT_SECRET")
    redirect_uri = os.getenv("JIRA_REDIRECT_URI")
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            JIRA_TOKEN_URL,
            json={
                "grant_type": "authorization_code",
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri
            },
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return response.json()


async def refresh_access_token(refresh_token: str) -> dict:
    """Get a new access token using the refresh token."""
    client_id = os.getenv("JIRA_CLIENT_ID")
    client_secret = os.getenv("JIRA_CLIENT_SECRET")
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            JIRA_TOKEN_URL,
            json={
                "grant_type": "refresh_token",
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token
            },
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        return response.json()


async def get_accessible_resources(access_token: str) -> list:
    """Get the list of Jira sites this token has access to.
    Returns list of dicts: {id, name, url, scopes}
    """
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{JIRA_API_BASE}/oauth/token/accessible-resources",
            headers=headers
        )
        response.raise_for_status()
        return response.json()


async def list_jira_projects(access_token: str, cloud_id: str) -> list:
    """List all projects in a Jira site."""
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    url = f"{JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/project"
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.json()


async def list_jira_users(access_token: str, cloud_id: str) -> dict:
    """Fetch user_id → display_name mapping for resolving assignees/reporters."""
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    url = f"{JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/users/search"
    
    user_map = {}
    start_at = 0
    max_results = 100
    
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            response = await client.get(
                url,
                headers=headers,
                params={"startAt": start_at, "maxResults": max_results}
            )
            response.raise_for_status()
            users = response.json()
            if not users:
                break
            
            for u in users:
                if u.get("accountType") == "atlassian":
                    user_map[u["accountId"]] = u.get("displayName") or u.get("emailAddress") or u["accountId"]
            
            if len(users) < max_results:
                break
            start_at += max_results
    
    return user_map


async def search_jira_issues(access_token: str, cloud_id: str, project_key: str, max_total: int = 500) -> list:
    """Fetch issues from a project via JQL with pagination."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    url = f"{JIRA_API_BASE}/ex/jira/{cloud_id}/rest/api/3/search"
    
    fields = ["summary", "description", "status", "assignee", "reporter", "priority", "issuetype", "created", "updated", "comment", "labels"]
    
    all_issues = []
    start_at = 0
    page_size = 100
    
    async with httpx.AsyncClient(timeout=60) as client:
        while len(all_issues) < max_total:
            body = {
                "jql": f"project = {project_key} ORDER BY created DESC",
                "fields": fields,
                "startAt": start_at,
                "maxResults": page_size
            }
            response = await client.post(url, headers=headers, json=body)
            response.raise_for_status()
            data = response.json()
            
            issues = data.get("issues", [])
            all_issues.extend(issues)
            
            total = data.get("total", 0)
            if start_at + page_size >= total or not issues:
                break
            start_at += page_size
    
    return all_issues


def format_issues_for_rag(issues: list, user_map: dict, project_name: str = "") -> str:
    """Convert raw Jira issues into readable text for the RAG pipeline."""
    lines = []
    
    if project_name:
        lines.append(f"# Jira Project: {project_name}\n")
    
    for issue in issues:
        try:
            key = issue.get("key", "?")
            fields = issue.get("fields", {})
            
            summary = fields.get("summary", "")
            issue_type = (fields.get("issuetype") or {}).get("name", "Issue")
            status = (fields.get("status") or {}).get("name", "Unknown")
            priority = (fields.get("priority") or {}).get("name", "None")
            
            assignee_id = (fields.get("assignee") or {}).get("accountId")
            assignee = user_map.get(assignee_id, "Unassigned") if assignee_id else "Unassigned"
            
            reporter_id = (fields.get("reporter") or {}).get("accountId")
            reporter = user_map.get(reporter_id, "Unknown") if reporter_id else "Unknown"
            
            created = _format_date(fields.get("created"))
            updated = _format_date(fields.get("updated"))
            
            description = _extract_adf_text(fields.get("description"))
            
            lines.append(f"\n=== [{key}] {summary} ===")
            lines.append(f"Type: {issue_type} | Status: {status} | Priority: {priority}")
            lines.append(f"Reporter: {reporter} | Assignee: {assignee}")
            lines.append(f"Created: {created} | Updated: {updated}")
            
            if description:
                lines.append(f"Description:\n{description}")
            
            # Comments (first 5)
            comments = (fields.get("comment") or {}).get("comments", [])
            if comments:
                lines.append("Comments:")
                for c in comments[:5]:
                    author_id = (c.get("author") or {}).get("accountId")
                    author = user_map.get(author_id, "Unknown") if author_id else "Unknown"
                    body = _extract_adf_text(c.get("body"))
                    if body:
                        lines.append(f"  - {author}: {body}")
            
            labels = fields.get("labels", [])
            if labels:
                lines.append(f"Labels: {', '.join(labels)}")
        
        except Exception as e:
            print(f"[JIRA-FORMAT] Failed for issue: {e}")
            continue
    
    return "\n".join(lines)


def _format_date(date_str) -> str:
    """Convert ISO date string to a readable format."""
    if not date_str:
        return "unknown"
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except (ValueError, AttributeError):
        return str(date_str)


def _extract_adf_text(node) -> str:
    """Recursively extract plain text from Atlassian Document Format (ADF)."""
    if node is None:
        return ""
    
    if isinstance(node, str):
        return node
    
    if isinstance(node, list):
        return " ".join(_extract_adf_text(item) for item in node if item)
    
    if not isinstance(node, dict):
        return ""
    
    node_type = node.get("type")
    
    if node_type == "text":
        return node.get("text", "")
    
    if node_type == "hardBreak":
        return "\n"
    
    # Recursively handle content
    content = node.get("content", [])
    parts = [_extract_adf_text(child) for child in content]
    text = " ".join(p for p in parts if p)
    
    # Add paragraph breaks
    if node_type in ("paragraph", "heading", "listItem", "blockquote"):
        text = text.strip() + "\n"
    elif node_type in ("bulletList", "orderedList"):
        text = text.strip() + "\n"
    
    return text
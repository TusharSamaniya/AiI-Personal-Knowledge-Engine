from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Project, File as FileModel, ChatHistory, Integration, Quiz, QuizAttempt
from app.auth import hash_password, verify_password, get_current_user, require_role
from app.jwt_handler import create_access_token, decode_access_token
from app.storage import LocalStorage
from app.celery_worker import ingest_file_task
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from app.vector_store import search, get_collection
from app.llm_service import (
    generate_answer,
    stream_answer_async,
    generate_quiz,
    generate_flashcards,
    summarize_content,
    explain_like_im_5
)
import json
import logging
from datetime import datetime, timedelta
from app.integrations.drive import list_drive_files, download_drive_file, refresh_drive_token
from app.integrations.notion import (
    get_notion_auth_url,
    exchange_code_for_token as notion_exchange_code,
    list_notion_pages,
    fetch_page_text
)
from app.integrations.slack import (
    get_slack_auth_url,
    exchange_code_for_token as slack_exchange_code,
    list_slack_channels,
    list_slack_users,
    fetch_channel_messages,
    format_messages,
    join_slack_channel
)
from app.integrations.jira import (
    get_jira_auth_url,
    exchange_code_for_token as jira_exchange_code,
    refresh_access_token as jira_refresh_token,
    get_accessible_resources as jira_get_sites,
    list_jira_projects,
    list_jira_users,
    search_jira_issues,
    format_issues_for_rag
)
import random


async def get_valid_jira_token(integration, db):
    """Returns a valid Jira access token, refreshing if expired."""
    now = datetime.utcnow()
    
    # If token is still valid (with 5-minute buffer), use it
    if integration.expires_at and integration.expires_at > now + timedelta(minutes=5):
        return integration.access_token
    
    # Token expired — refresh
    if not integration.refresh_token:
        raise HTTPException(status_code=401, detail="Jira session expired. Please reconnect.")
    
    try:
        new_tokens = await jira_refresh_token(integration.refresh_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Jira token refresh failed: {str(e)}")
    
    integration.access_token = new_tokens["access_token"]
    integration.expires_at = now + timedelta(seconds=new_tokens.get("expires_in", 3600))
    if new_tokens.get("refresh_token"):
        integration.refresh_token = new_tokens["refresh_token"]
    db.commit()
    
    return integration.access_token

async def get_valid_drive_token(integration, db):
    """Returns a valid Google Drive access token, refreshing if expired."""
    now = datetime.utcnow()
    
    if integration.expires_at and integration.expires_at > now + timedelta(minutes=5):
        return integration.access_token
    
    if not integration.refresh_token:
        integration.status = "expired"
        db.commit()
        raise HTTPException(status_code=401, detail="Drive connection expired. Please reconnect.")
    
    try:
        tokens = await refresh_drive_token(integration.refresh_token)
    except Exception as e:
        # Refresh failed permanently — mark integration as expired
        integration.status = "expired"
        db.commit()
        raise HTTPException(status_code=401, detail="Drive connection expired. Please reconnect.")
    
    integration.access_token = tokens["access_token"]
    integration.expires_at = now + timedelta(seconds=tokens.get("expires_in", 3600))
    db.commit()
    return integration.access_token

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="super-secret-key-change-me")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth Setup
oauth = OAuth()
oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


@app.get("/")
def read_root():
    return {"message": "Backend is running!"}


@app.post("/auth/register")
def register(email: str, password: str, name: str, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = User(email=email, password_hash=hash_password(password), name=name)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully", "user_id": new_user.id}


@app.post("/auth/login")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/google")
async def auth_google(request: Request):
    redirect_uri = "http://localhost:8000/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@app.get("/auth/google/callback")
async def auth_google_callback(request: Request, db: Session = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth error: {str(e)}")
    
    user_info = token.get("userinfo")
    email = user_info["email"]
    name = user_info.get("name")
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, password_hash=None, name=name, oauth_provider="google")
        db.add(user)
        db.commit()
        db.refresh(user)
    
    access_token = create_access_token({"sub": user.email})
    
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(url=f"{frontend_url}/auth/callback?token={access_token}")


@app.get("/user/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "oauth_provider": current_user.oauth_provider,
        "active_project_id": current_user.active_project_id
    }


@app.put("/user/update")
def update_user(name: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.name = name
    db.commit()
    db.refresh(current_user)
    return {"message": "Profile updated successfully", "new_name": current_user.name}


# ==========================================
# Project Management Endpoints
# ==========================================

@app.post("/projects/create")
def create_project(
    name: str,
    description: str = "",
    current_user: User = Depends(require_role(["teacher", "admin"])),
    db: Session = Depends(get_db)
):
    new_project = Project(user_id=current_user.id, name=name, description=description)
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return {"message": "Project created", "project_id": new_project.id, "name": new_project.name}


@app.get("/projects/list")
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    projects = db.query(Project).filter(Project.user_id == current_user.id).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "is_active": (p.id == current_user.active_project_id)
        }
        for p in projects
    ]


@app.post("/projects/switch/{project_id}")
def switch_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    current_user.active_project_id = project.id
    db.commit()
    return {"message": f"Switched to project '{project.name}'"}


@app.delete("/projects/delete/{project_id}")
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.active_project_id == project.id:
        current_user.active_project_id = None
    db.delete(project)
    db.commit()
    return {"message": f"Project '{project.name}' deleted"}


# ==========================================
# Ingestion Endpoints
# ==========================================

@app.post("/ingest/url")
def ingest_url(
    url: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.active_project_id:
        raise HTTPException(status_code=400, detail="No active project. Please switch to a project first.")
    
    if "youtube.com" in url or "youtu.be" in url:
        source_type = "youtube"
    else:
        source_type = "web"
    
    new_file = FileModel(
        project_id=current_user.active_project_id,
        name=url,
        file_type=source_type,
        source_type=source_type,
        status="processing"
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    
    ingest_file_task.delay(new_file.id)
    
    return {
        "message": f"{source_type.capitalize()} URL received. Processing in background.",
        "file_id": new_file.id
    }


storage = LocalStorage()


@app.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.active_project_id:
        raise HTTPException(status_code=400, detail="No active project. Please switch to a project first.")
    
    saved_path = storage.save_file(file)
    file_type = file.filename.split('.')[-1].lower()
    
    new_file = FileModel(
        project_id=current_user.active_project_id,
        name=file.filename,
        file_type=file_type,
        status="processing"
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    
    ingest_file_task.delay(new_file.id)
    
    return {
        "message": "File uploaded and processing started.",
        "file_id": new_file.id,
        "name": new_file.name
    }


@app.get("/files/list/{project_id}")
def list_files(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    files = db.query(FileModel).filter(
        FileModel.project_id == project_id
    ).order_by(FileModel.uploaded_at.desc()).all()
    
    return [
        {
            "id": f.id,
            "name": f.name,
            "source_type": f.source_type,
            "status": f.status,
            "error_message": f.error_message,
            "uploaded_at": f.uploaded_at
        }
        for f in files
    ]


# ==========================================
# Query Endpoints
# ==========================================

@app.post("/query")
def query(
    project_id: int,
    question: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    try:
        results = search(project_id, question, top_k=5, max_distance=2.0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
    
    if not results:
        return {
            "answer": "No relevant content found in this project. Please upload some files first.",
            "sources": []
        }
    
        # Build context with source file names attached
    context_chunks = []
    for r in results:
        file_id = r.get("file_id")
        file_name = "Unknown"
        if file_id:
            file_rec = db.query(FileModel).filter(FileModel.id == file_id).first()
            if file_rec:
                file_name = file_rec.name
        context_chunks.append(f"[Source: {file_name}]\n{r['text']}")
    
    try:
        answer = generate_answer(question, context_chunks)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM failed: {str(e)}")
    
    sources = []
    for r in results:
        file_id = r.get("file_id")
        if not file_id:
            continue
        file_record = db.query(FileModel).filter(FileModel.id == file_id).first()
        if file_record and file_record.name not in sources:
            sources.append(file_record.name)
    
    return {"answer": answer, "sources": sources}


@app.post("/query/stream")
async def query_stream(
    project_id: int,
    question: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 2. Retrieve relevant chunks
    try:
        results = search(project_id, question, top_k=5, max_distance=2.0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

    if not results:
        async def empty_stream():
            msg = "No relevant content found. This project may have no files yet, or your question may be unrelated to the uploaded content. Try uploading a PDF first, or ask a different question."
            yield f"data: {json.dumps({'type': 'error', 'message': msg})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return StreamingResponse(empty_stream(), media_type="text/event-stream")
    
    # 3. Get source file names
    sources = []
    for r in results:
        file_id = r.get("file_id")
        if not file_id:
            continue
        file_record = db.query(FileModel).filter(FileModel.id == file_id).first()
        if file_record and file_record.name not in sources:
            sources.append(file_record.name)
    
    context_chunks = [r["text"] for r in results]
    
    # 4. Stream the answer
    async def generate():
        # Send sources first
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        
        full_answer = ""
        try:
            async for token in stream_answer_async(question, context_chunks):
                full_answer += token
                yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
        except Exception as e:
            error_msg = str(e) if str(e) else "Something went wrong. Please try again."
            logger.error(f"[STREAM] Error: {error_msg}")
            yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"
        
        
        if full_answer:
            try:
                history = ChatHistory(
                    user_id=current_user.id,
                    project_id=project_id,
                    question=question,
                    answer=full_answer
                )
                db.add(history)
                db.commit()
            except Exception as e:
                print(f"[CHAT] Failed to save history: {str(e)}")
        
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    
    # ⚠️ THIS WAS THE MISSING LINE ⚠️
    return StreamingResponse(generate(), media_type="text/event-stream")


# ==========================================
# Chat History
# ==========================================

@app.get("/chat/history/{project_id}")
def get_chat_history(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    history = db.query(ChatHistory).filter(
        ChatHistory.project_id == project_id,
        ChatHistory.user_id == current_user.id
    ).order_by(ChatHistory.created_at.asc()).all()
    
    return [
        {
            "id": h.id,
            "question": h.question,
            "answer": h.answer,
            "created_at": h.created_at
        }
        for h in history
    ]

@app.get("/integrations/drive/connect")
async def drive_connect(token: str, request: Request, db: Session = Depends(get_db)):
    # 1. Validate the JWT (because the browser navigation can't send Authorization headers)
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 2. Store the user ID in the browser session
    request.session["drive_user_id"] = user.id
    
    # 3. Redirect to Google with the Drive scope
    redirect_uri = "http://localhost:8000/integrations/drive/callback"
    return await oauth.google.authorize_redirect(
        request,
        redirect_uri,
        scope="openid email profile https://www.googleapis.com/auth/drive.readonly",
        access_type="offline",   # Request a refresh token
        prompt="consent"         # Force consent screen (needed to get refresh token)
    )

@app.get("/integrations/drive/callback")
async def drive_callback(request: Request, db: Session = Depends(get_db)):
    # 1. Get the user ID from the session
    user_id = request.session.get("drive_user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Session expired. Please reconnect Drive.")
    
    # 2. Exchange the code for tokens
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth error: {str(e)}")
    
    # 3. Save or update the integration in the database
    integration = db.query(Integration).filter(
        Integration.user_id == user_id,
        Integration.type == "google_drive"
    ).first()
    
    expires_at = datetime.utcnow() + timedelta(seconds=token.get("expires_in", 3600))
    
    if integration:
        # User reconnected → update existing row
        integration.access_token = token["access_token"]
        if token.get("refresh_token"):
            integration.refresh_token = token["refresh_token"]
        integration.expires_at = expires_at
        integration.status = "active"
    else:
        # New connection → create new row
        integration = Integration(
            user_id=user_id,
            type="google_drive",
            access_token=token["access_token"],
            refresh_token=token.get("refresh_token"),
            expires_at=expires_at,
            status="active"
        )
        db.add(integration)
    
    db.commit()
    
    # 4. Redirect the browser back to the frontend
    return RedirectResponse(url="http://localhost:5173/dashboard?drive=connected")

@app.get("/integrations/drive/files")
async def drive_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    integration = db.query(Integration).filter(
        Integration.user_id == current_user.id,
        Integration.type == "google_drive"
    ).first()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Google Drive not connected")
    
    if integration.status == "expired":
        raise HTTPException(status_code=401, detail="Drive connection expired. Please reconnect.")
    
    token = await get_valid_drive_token(integration, db)
    
    try:
        files = await list_drive_files(token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list Drive files: {str(e)}")
    
    return files

@app.post("/integrations/drive/import")
async def drive_import(
    file_id: str,
    file_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Verify the user has an active project
    if not current_user.active_project_id:
        raise HTTPException(status_code=400, detail="No active project. Please switch to a project first.")
    
    # 2. Verify the user has an active Drive integration
    integration = db.query(Integration).filter(
        Integration.user_id == current_user.id,
        Integration.type == "google_drive",
        Integration.status == "active"
    ).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Google Drive not connected")
    
    # 3. Download the file content from Drive
    try:
        content = await download_drive_file(integration.access_token, file_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")
    
    # 4. Save the file to disk (same place as regular uploads)
    safe_name = file_name.replace("/", "_").replace("\\", "_")
    file_path = f"uploads/{safe_name}"
    with open(file_path, "wb") as f:
        f.write(content)
    
    # 5. Determine file type from extension
    file_type = safe_name.split('.')[-1].lower() if '.' in safe_name else "bin"
    
    # 6. Create a database record
    new_file = FileModel(
        project_id=current_user.active_project_id,
        name=safe_name,
        file_type=file_type,
        source_type="file",
        status="processing"
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    
    # 7. Send to Celery for processing
    ingest_file_task.delay(new_file.id)
    
    return {
        "message": f"Importing '{safe_name}'...",
        "file_id": new_file.id
    }

@app.get("/integrations/notion/connect")
async def notion_connect(token: str):
    """Redirect the user to Notion's OAuth consent page.
    We pass the JWT as `state` so we can identify the user on callback.
    """
    # Validate the JWT first
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Build Notion's auth URL with the JWT as state
    auth_url = get_notion_auth_url(state=token)
    return RedirectResponse(url=auth_url)

@app.get("/integrations/notion/callback")
async def notion_callback(code: str, state: str, db: Session = Depends(get_db)):
    """Notion redirects here after user approval.
    `code` is the OAuth code, `state` is our JWT (which we passed earlier).
    """
    # 1. Validate the JWT from state
    payload = decode_access_token(state)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid state token")
    
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 2. Exchange code for access token
    try:
        token_data = await notion_exchange_code(code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {str(e)}")
    
    access_token = token_data.get("access_token")
    workspace_id = token_data.get("workspace_id")
    workspace_name = token_data.get("workspace_name", "")
    bot_id = token_data.get("bot_id")
    
    if not access_token:
        raise HTTPException(status_code=400, detail="No access token returned from Notion")
    
    # 3. Save or update the integration
    integration = db.query(Integration).filter(
        Integration.user_id == user.id,
        Integration.type == "notion"
    ).first()
    
    if integration:
        integration.access_token = access_token
        integration.status = "active"
    else:
        integration = Integration(
            user_id=user.id,
            type="notion",
            access_token=access_token,
            refresh_token=None,   # Notion tokens don't expire
            expires_at=None,       # No expiry
            status="active"
        )
        db.add(integration)
    
    db.commit()
    
    # 4. Redirect back to the frontend
    return RedirectResponse(url="http://localhost:5173/dashboard?notion=connected")

@app.get("/integrations/notion/pages")
async def notion_pages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all Notion pages the user has shared with our integration."""
    integration = db.query(Integration).filter(
        Integration.user_id == current_user.id,
        Integration.type == "notion",
        Integration.status == "active"
    ).first()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Notion not connected")
    
    try:
        raw_pages = await list_notion_pages(integration.access_token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list pages: {str(e)}")
    
    # Extract just the fields we need
    pages = []
    for p in raw_pages:
        # Get the page title from the "title" property
        title = "Untitled"
        properties = p.get("properties", {})
        for prop in properties.values():
            if prop.get("type") == "title":
                title_arr = prop.get("title", [])
                if title_arr:
                    title = "".join(t.get("plain_text", "") for t in title_arr)
                break
        
        pages.append({
            "id": p.get("id"),
            "title": title,
            "url": p.get("url", ""),
            "last_edited": p.get("last_edited_time", "")
        })
    
    return pages

@app.post("/integrations/notion/import")
async def notion_import(
    page_id: str,
    page_title: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Import a Notion page's text content into the RAG pipeline."""
    # 1. Verify active project
    if not current_user.active_project_id:
        raise HTTPException(status_code=400, detail="No active project. Please switch to a project first.")
    
    # 2. Verify Notion integration
    integration = db.query(Integration).filter(
        Integration.user_id == current_user.id,
        Integration.type == "notion",
        Integration.status == "active"
    ).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Notion not connected")
    
    # 3. Fetch the full page text (recursive)
    try:
        text_content = await fetch_page_text(integration.access_token, page_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch page: {str(e)}")
    
    if not text_content or len(text_content.strip()) < 20:
        raise HTTPException(status_code=400, detail="Page is empty or has no readable text")
    
    # 4. Save as a .txt file (same folder as uploads)
    safe_title = "".join(c for c in page_title if c.isalnum() or c in " _-")[:60] or "notion_page"
    file_name = f"{safe_title}.txt"
    file_path = f"uploads/{file_name}"
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(text_content)
    
    # 5. Create DB record
    new_file = FileModel(
        project_id=current_user.active_project_id,
        name=file_name,
        file_type="txt",
        source_type="notion",
        status="processing"
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    
    # 6. Send to Celery
    ingest_file_task.delay(new_file.id)
    
    return {
        "message": f"Importing Notion page '{page_title}'...",
        "file_id": new_file.id
    }
@app.get("/integrations/slack/connect")
async def slack_connect(token: str):
    """Redirect user to Slack's OAuth consent page."""
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    auth_url = get_slack_auth_url(state=token)
    return RedirectResponse(url=auth_url)

@app.get("/integrations/slack/callback")
async def slack_callback(code: str, state: str, db: Session = Depends(get_db)):
    """Slack redirects here after user approves."""
    # Validate JWT from state
    payload = decode_access_token(state)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid state token")
    
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Exchange code for bot token
    try:
        token_data = await slack_exchange_code(code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Slack token exchange failed: {str(e)}")
    
    # The bot token is at token_data["access_token"]
    bot_token = token_data.get("access_token")
    team_info = token_data.get("team", {})
    team_name = team_info.get("name", "")
    
    if not bot_token:
        raise HTTPException(status_code=400, detail="No bot token returned from Slack")
    
    # Save or update integration
    integration = db.query(Integration).filter(
        Integration.user_id == user.id,
        Integration.type == "slack"
    ).first()
    
    if integration:
        integration.access_token = bot_token
        integration.status = "active"
    else:
        integration = Integration(
            user_id=user.id,
            type="slack",
            access_token=bot_token,
            refresh_token=None,
            expires_at=None,
            status="active"
        )
        db.add(integration)
    
    db.commit()
    
    return RedirectResponse(url="http://localhost:5173/dashboard?slack=connected")

@app.get("/integrations/slack/channels")
async def slack_channels(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all channels the bot has access to."""
    integration = db.query(Integration).filter(
        Integration.user_id == current_user.id,
        Integration.type == "slack",
        Integration.status == "active"
    ).first()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Slack not connected")
    
    try:
        channels = await list_slack_channels(integration.access_token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list channels: {str(e)}")
    
    # Return just what the frontend needs
    return [
        {
            "id": c.get("id"),
            "name": c.get("name"),
            "is_private": c.get("is_private", False),
            "member_count": c.get("num_members", 0)
        }
        for c in channels
    ]

@app.post("/integrations/slack/import")
async def slack_import(
    channel_id: str,
    channel_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Import all messages from a Slack channel into the RAG pipeline."""
    # 1. Verify active project
    if not current_user.active_project_id:
        raise HTTPException(status_code=400, detail="No active project.")
    
    # 2. Get the Slack integration
    integration = db.query(Integration).filter(
        Integration.user_id == current_user.id,
        Integration.type == "slack",
        Integration.status == "active"
    ).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Slack not connected")
    
    token = integration.access_token
    print(f"[SLACK-1] Starting import for #{channel_name}", flush=True)
    
    # 3. Fetch users and messages
    try:
        user_map = await list_slack_users(token)
        print(f"[SLACK-2] Fetched {len(user_map)} users", flush=True)
    except Exception as e:
        print(f"[SLACK-ERROR] list_slack_users failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Failed to list users: {e}")
    
        # 3b. Try to auto-join the channel (for public channels)
    try:
        await join_slack_channel(token, channel_id)
        print(f"[SLACK-3a] Joined channel (or already in it)", flush=True)
    except Exception as e:
        print(f"[SLACK-3a-WARN] Auto-join failed: {e}", flush=True)
        # Don't fail here — the fetch below will give a clearer error if needed
    
    try:
        messages = await fetch_channel_messages(token, channel_id)
        print(f"[SLACK-3] Fetched {len(messages)} messages", flush=True)
    except Exception as e:
        print(f"[SLACK-ERROR] fetch_channel_messages failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch messages: {e}")
    
    if not messages:
        raise HTTPException(status_code=400, detail="Channel has no messages to import")
    
    # DEBUG: Show a sample message
    try:
        sample = messages[0]
        print(f"[SLACK-4] First message type: {type(sample)}", flush=True)
        if isinstance(sample, dict):
            print(f"[SLACK-4] First message keys: {list(sample.keys())}", flush=True)
            print(f"[SLACK-4] First message text: {sample.get('text')!r}", flush=True)
    except Exception as e:
        print(f"[SLACK-WARN] Debug sample failed: {e}", flush=True)
    
    # 4. Format messages
    try:
        formatted_text = format_messages(messages, user_map)
        print(f"[SLACK-5] Formatted text length: {len(formatted_text)}", flush=True)
    except Exception as e:
        import traceback
        print(f"[SLACK-ERROR] format_messages failed: {type(e).__name__}: {e}", flush=True)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Format failed: {type(e).__name__}: {e}")
    
    if not formatted_text or len(formatted_text.strip()) < 20:
        raise HTTPException(status_code=400, detail="Channel has no readable messages")
    
    # 5. Save as .txt file
    safe_name = f"slack_{channel_name}"
    file_name = f"{safe_name}.txt"
    file_path = f"uploads/{file_name}"
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(formatted_text)
        print(f"[SLACK-6] File written: {file_path}", flush=True)
    except Exception as e:
        print(f"[SLACK-ERROR] File write failed: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"File write failed: {e}")
    
    # 6. Create DB record
    new_file = FileModel(
        project_id=current_user.active_project_id,
        name=file_name,
        file_type="txt",
        source_type="slack",
        status="processing"
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    print(f"[SLACK-7] DB record created: id={new_file.id}", flush=True)
    
    # 7. Send to Celery
    ingest_file_task.delay(new_file.id)
    print(f"[SLACK-8] Celery task queued", flush=True)
    
    return {
        "message": f"Importing #{channel_name} ({len(messages)} messages)...",
        "file_id": new_file.id
    }

@app.get("/integrations/jira/connect")
async def jira_connect(token: str):
    """Redirect user to Atlassian OAuth consent page."""
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    auth_url = get_jira_auth_url(state=token)
    return RedirectResponse(url=auth_url)

@app.get("/integrations/jira/callback")
async def jira_callback(code: str, state: str, db: Session = Depends(get_db)):
    """Handle Atlassian's redirect — exchange code for tokens."""
    payload = decode_access_token(state)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid state token")
    
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        tokens = await jira_exchange_code(code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {str(e)}")
    
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_in = tokens.get("expires_in", 3600)
    
    if not access_token:
        raise HTTPException(status_code=400, detail="No access token returned")
    
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
    
    integration = db.query(Integration).filter(
        Integration.user_id == user.id,
        Integration.type == "jira"
    ).first()
    
    if integration:
        integration.access_token = access_token
        integration.refresh_token = refresh_token
        integration.expires_at = expires_at
        integration.status = "active"
    else:
        integration = Integration(
            user_id=user.id,
            type="jira",
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            status="active"
        )
        db.add(integration)
    
    db.commit()
    
    return RedirectResponse(url="http://localhost:5173/dashboard?jira=connected")

@app.get("/integrations/jira/sites")
async def jira_sites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all Jira sites the user has access to."""
    integration = db.query(Integration).filter(
        Integration.user_id == current_user.id,
        Integration.type == "jira",
        Integration.status == "active"
    ).first()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Jira not connected")
    
    token = await get_valid_jira_token(integration, db)
    
    try:
        sites = await jira_get_sites(token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list sites: {str(e)}")
    
    return [
        {
            "id": s.get("id"),
            "name": s.get("name"),
            "url": s.get("url"),
            "avatar_url": s.get("avatarUrl")
        }
        for s in sites
    ]

@app.get("/integrations/jira/projects")
async def jira_projects(
    cloud_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all projects in a specific Jira site."""
    integration = db.query(Integration).filter(
        Integration.user_id == current_user.id,
        Integration.type == "jira",
        Integration.status == "active"
    ).first()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Jira not connected")
    
    token = await get_valid_jira_token(integration, db)
    
    try:
        projects = await list_jira_projects(token, cloud_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list projects: {str(e)}")
    
    return [
        {
            "id": p.get("id"),
            "key": p.get("key"),
            "name": p.get("name"),
            "project_type": p.get("projectTypeKey")
        }
        for p in projects
    ]

@app.post("/integrations/jira/import")
async def jira_import(
    cloud_id: str,
    project_key: str,
    project_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Import all issues from a Jira project into the RAG pipeline."""
    if not current_user.active_project_id:
        raise HTTPException(status_code=400, detail="No active project. Please switch to a project first.")
    
    integration = db.query(Integration).filter(
        Integration.user_id == current_user.id,
        Integration.type == "jira",
        Integration.status == "active"
    ).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Jira not connected")
    
    token = await get_valid_jira_token(integration, db)
    print(f"[JIRA-1] Starting import for {project_key} ({project_name})", flush=True)
    
    # Fetch users for name resolution
    try:
        user_map = await list_jira_users(token, cloud_id)
        print(f"[JIRA-2] Fetched {len(user_map)} users", flush=True)
    except Exception as e:
        print(f"[JIRA-WARN] User fetch failed: {e}", flush=True)
        user_map = {}  # Non-fatal, continue with IDs
    
    # Fetch issues
    try:
        issues = await search_jira_issues(token, cloud_id, project_key)
        print(f"[JIRA-3] Fetched {len(issues)} issues", flush=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch issues: {str(e)}")
    
    if not issues:
        raise HTTPException(status_code=400, detail="Project has no issues to import")
    
    # Format for RAG
    try:
        formatted_text = format_issues_for_rag(issues, user_map, project_name)
        print(f"[JIRA-4] Formatted text length: {len(formatted_text)}", flush=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Format failed: {str(e)}")
    
    # Save as .txt file
    safe_name = "".join(c for c in project_key if c.isalnum() or c in "_-")[:40] or "project"
    file_name = f"jira_{safe_name}.txt"
    file_path = f"uploads/{file_name}"
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(formatted_text)
    print(f"[JIRA-5] File written: {file_path}", flush=True)
    
    # Create DB record
    new_file = FileModel(
        project_id=current_user.active_project_id,
        name=file_name,
        file_type="txt",
        source_type="jira",
        status="processing"
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    
    # Send to Celery
    ingest_file_task.delay(new_file.id)
    print(f"[JIRA-6] Queued for processing: file_id={new_file.id}", flush=True)
    
    return {
        "message": f"Importing {len(issues)} issues from {project_name}...",
        "file_id": new_file.id
    }

# ==========================================
# Integration Management
# ==========================================

@app.get("/integrations/list")
def list_all_integrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all integrations the current user has connected."""
    integrations = db.query(Integration).filter(
        Integration.user_id == current_user.id
    ).order_by(Integration.connected_at.desc()).all()
    
    return [
        {
            "id": i.id,
            "type": i.type,
            "status": i.status,
            "connected_at": i.connected_at,
            "expires_at": i.expires_at,
            "has_refresh_token": bool(i.refresh_token),
        }
        for i in integrations
    ]


@app.delete("/integrations/disconnect/{integration_type}")
def disconnect_integration(
    integration_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect an integration by type (e.g., 'google_drive', 'slack', 'notion', 'jira')."""
    integration = db.query(Integration).filter(
        Integration.user_id == current_user.id,
        Integration.type == integration_type
    ).first()
    
    if not integration:
        raise HTTPException(status_code=404, detail=f"No {integration_type} integration found")
    
    db.delete(integration)
    db.commit()
    
    return {"message": f"Disconnected {integration_type} successfully"}


# ==========================================
# Quiz Endpoints
# ==========================================

@app.post("/quiz/generate")
async def quiz_generate(
    project_id: int,
    num_questions: int = 5,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a quiz from a project's content."""
    # 1. Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 2. Fetch chunks from ChromaDB
    try:
        collection = get_collection(project_id)
        if collection.count() == 0:
            raise HTTPException(status_code=400, detail="No content in this project. Please upload files first.")
        
        all_data = collection.get()
        documents = all_data.get("documents") or []
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch content: {str(e)}")
    
    if not documents:
        raise HTTPException(status_code=400, detail="No content available for quiz generation")
    
    # 3. Sample random chunks (up to 10 for variety)
    sample_size = min(10, len(documents))
    sampled = random.sample(documents, sample_size)
    content = "\n\n---\n\n".join(sampled)
    
    # 4. Limit total content length to avoid token limits
    if len(content) > 8000:
        content = content[:8000]
    
    # 5. Generate quiz via LLM
    try:
        quiz_data = await generate_quiz(content, num_questions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")
    
    # 6. Validate structure
    if "questions" not in quiz_data or not isinstance(quiz_data["questions"], list):
        raise HTTPException(status_code=500, detail="LLM returned invalid quiz format")
    
    # 7. Save to DB
    new_quiz = Quiz(
        user_id=current_user.id,
        project_id=project_id,
        title=quiz_data.get("title", "Quiz"),
        questions=json.dumps(quiz_data["questions"])
    )
    db.add(new_quiz)
    db.commit()
    db.refresh(new_quiz)
    
    return {
        "quiz_id": new_quiz.id,
        "title": new_quiz.title,
        "questions": quiz_data["questions"]
    }


@app.post("/quiz/submit")
async def quiz_submit(
    quiz_id: int,
    answers: str,   # JSON string like "[0, 2, 1, 3, 0]"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit answers for a quiz and get the score."""
    # 1. Fetch the quiz
    quiz = db.query(Quiz).filter(
        Quiz.id == quiz_id,
        Quiz.user_id == current_user.id
    ).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # 2. Parse answers
    try:
        user_answers = json.loads(answers)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid answers format")
    
    # 3. Parse correct questions
    questions = json.loads(quiz.questions)
    if len(user_answers) != len(questions):
        raise HTTPException(status_code=400, detail="Answers length mismatch")
    
    # 4. Score
    score = 0
    details = []
    for i, q in enumerate(questions):
        is_correct = user_answers[i] == q.get("correct_index")
        if is_correct:
            score += 1
        details.append({
            "question": q.get("question"),
            "your_answer": user_answers[i],
            "correct_index": q.get("correct_index"),
            "correct_answer": q.get("options", [])[q.get("correct_index", 0)] if q.get("options") else "",
            "explanation": q.get("explanation", ""),
            "is_correct": is_correct
        })
    
    # 5. Save attempt
    attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_id=current_user.id,
        answers=json.dumps(user_answers),
        score=score,
        total_questions=len(questions)
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    
    return {
        "attempt_id": attempt.id,
        "score": score,
        "total_questions": len(questions),
        "details": details
    }


@app.get("/quiz/history/{project_id}")
def quiz_history(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get quiz attempt history for a project."""
    attempts = db.query(QuizAttempt).join(Quiz, QuizAttempt.quiz_id == Quiz.id).filter(
        Quiz.project_id == project_id,
        QuizAttempt.user_id == current_user.id
    ).order_by(QuizAttempt.completed_at.desc()).all()
    
    return [
        {
            "attempt_id": a.id,
            "quiz_id": a.quiz_id,
            "score": a.score,
            "total_questions": a.total_questions,
            "completed_at": a.completed_at
        }
        for a in attempts
    ]
# ==========================================
# Study Tools Endpoints
# ==========================================

@app.post("/study/generate")
async def study_generate(
    project_id: int,
    mode: str,                       # "flashcards" | "summary" | "eli5"
    question: str = "",              # only used for eli5 mode
    num_cards: int = 10,             # only used for flashcards mode
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate study tools (flashcards, summaries, or ELI5 explanations)."""
    # 1. Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 2. Fetch content from ChromaDB
    try:
        collection = get_collection(project_id)
        if collection.count() == 0:
            raise HTTPException(status_code=400, detail="No content in this project.")
        all_data = collection.get()
        documents = all_data.get("documents") or []
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch content: {str(e)}")
    
    if not documents:
        raise HTTPException(status_code=400, detail="No content available")
    
    # 3. Sample chunks and build content
    sample_size = min(10, len(documents))
    sampled = random.sample(documents, sample_size)
    content = "\n\n---\n\n".join(sampled)
    if len(content) > 8000:
        content = content[:8000]
    
    # 4. Dispatch based on mode
    try:
        if mode == "flashcards":
            cards = await generate_flashcards(content, num_cards)
            return {"mode": "flashcards", "cards": cards}
        
        elif mode == "summary":
            summary = await summarize_content(content)
            return {"mode": "summary", "summary": summary}
        
        elif mode == "eli5":
            if not question.strip():
                raise HTTPException(status_code=400, detail="Please provide a question for ELI5 mode.")
            answer = await explain_like_im_5(question, content)
            return {"mode": "eli5", "answer": answer}
        
        else:
            raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
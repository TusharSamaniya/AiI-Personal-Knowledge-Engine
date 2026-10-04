from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Project, File as FileModel, ChatHistory, Integration
from app.auth import hash_password, verify_password, get_current_user, require_role
from app.jwt_handler import create_access_token, decode_access_token
from app.storage import LocalStorage
from app.celery_worker import ingest_file_task
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from app.vector_store import search
from app.llm_service import generate_answer, stream_answer_async
import json
import logging
from datetime import datetime, timedelta
from app.integrations.drive import list_drive_files, download_drive_file
from app.integrations.notion import (
    get_notion_auth_url,
    exchange_code_for_token as notion_exchange_code,
    list_notion_pages,
    fetch_page_text
)

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
    
    context_chunks = [r["text"] for r in results]
    
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
    # 1. Find the user's active Drive integration
    integration = db.query(Integration).filter(
        Integration.user_id == current_user.id,
        Integration.type == "google_drive",
        Integration.status == "active"
    ).first()
    if not integration:
        raise HTTPException(status_code=404, detail="Google Drive not connected")
    
    # 2. List the files
    try:
        files = await list_drive_files(integration.access_token)
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


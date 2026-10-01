from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Project
from app.auth import hash_password, verify_password, get_current_user, require_role
from app.jwt_handler import create_access_token
from app.storage import LocalStorage
from app.celery_worker import dummy_ingestion_task
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv


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
    
    # NEW: Redirect to frontend with token in URL
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
# NEW: Project Management Endpoints
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

@app.post("/ingest/url")
def ingest_url(url: str, current_user: User = Depends(get_current_user)):
    # This is a temporary stub. Real logic comes in Task 2.
    return {"message": f"Received URL: {url}. Processing will be added in Task 2."}

# Re-add file upload endpoint (from Phase 1)
storage = LocalStorage()

@app.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    saved_path = storage.save_file(file)
    dummy_ingestion_task.delay(file.filename)
    return {"message": f"File saved at {saved_path} and sent to worker!"}
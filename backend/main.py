from fastapi import FastAPI, UploadFile, File, Depends
from sqlalchemy.orm import Session
from app.celery_worker import dummy_ingestion_task
from app.storage import LocalStorage
from app.database import SessionLocal
from app.models import User

app = FastAPI()
storage = LocalStorage()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Backend is running!"}

@app.get("/test-db")
def test_db(db: Session = Depends(get_db)):
    new_user = User(email="test@example.com", password_hash="fakehash", name="Test User")
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    found_user = db.query(User).filter(User.email == "test@example.com").first()
    return {"user_id": found_user.id, "email": found_user.email, "name": found_user.name}

@app.get("/test-full/{file_name}")
def test_full(file_name: str, db: Session = Depends(get_db)):
    new_user = User(email=f"{file_name}@test.com", password_hash="x", name=file_name)
    db.add(new_user)
    db.commit()
    dummy_ingestion_task.delay(file_name)
    return {"message": f"User {file_name} saved and task sent to worker!"}

@app.get("/test-task/{file_name}")
def test_task(file_name: str):
    dummy_ingestion_task.delay(file_name)
    return {"message": f"Task for {file_name} sent to background worker!"}

@app.post("/upload")
def upload_file(file: UploadFile = File(...)):
    saved_path = storage.save_file(file)
    dummy_ingestion_task.delay(file.filename)
    return {"message": f"File saved at {saved_path} and sent to worker!"}
from fastapi import FastAPI, UploadFile, File
from app.celery_worker import dummy_ingestion_task
from app.storage import LocalStorage

app = FastAPI()
storage = LocalStorage()

@app.get("/")
def read_root():
    return {"message": "Backend is running!"}

@app.get("/test-task/{file_name}")
def test_task(file_name: str):
    dummy_ingestion_task.delay(file_name)
    return {"message": f"Task for {file_name} sent to background worker!"}

@app.post("/upload")
def upload_file(file: UploadFile = File(...)):
    saved_path = storage.save_file(file)
    dummy_ingestion_task.delay(file.filename)
    return {"message": f"File saved at {saved_path} and sent to worker!"}
from fastapi import FastAPI
from app.celery_worker import dummy_ingestion_task

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Backend is running!"}

@app.get("/test-task/{file_name}")
def test_task(file_name: str):
    dummy_ingestion_task.delay(file_name)
    return {"message": f"Task for {file_name} sent to background worker!"}
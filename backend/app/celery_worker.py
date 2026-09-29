from celery import Celery
import time

celery_app = Celery(
    "worker",
    broker = "redis://redis:6379/0",
    backend="redis://redis:6379/0"
)

@celery_app.task
def dummy_ingestion_task(file_name: str):
    print(f"Starting to process {file_name}...")
    time.sleep(5)
    print(f"finished processing {file_name}!")
    return f"Success: {file_name}"
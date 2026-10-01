from celery import Celery
from app.database import SessionLocal
from app.models import File, Chunk
from app.parser import extract_text
from app.chunker import chunk_text

celery_app = Celery(
    "worker",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0"
)

@celery_app.task
def ingest_file_task(file_id: int):
    db = SessionLocal()
    
    try:
        # 1. Find the file record in the DB
        file_record = db.query(File).filter(File.id == file_id).first()
        if not file_record:
            return f"File with id {file_id} not found"
        
        # 2. Extract text from the file
        file_path = f"uploads/{file_record.name}"
        print(f"[INGEST] Starting: {file_record.name} (type: {file_record.file_type})")
        text = extract_text(file_path, file_record.file_type)
        print(f"[INGEST] Extracted {len(text)} characters from {file_record.name}")
        
        # 3. Split into chunks
        chunks = chunk_text(text)
        print(f"[INGEST] Split into {len(chunks)} chunks")
        
        # 4. Save each chunk to the database
        for i, chunk in enumerate(chunks):
            db.add(Chunk(file_id=file_record.id, text=chunk, chunk_index=i))
        
        # 5. Mark the file as processed
        file_record.status = "processed"
        db.commit()
        print(f"[INGEST] Completed: {file_record.name}")
        return f"Processed {len(chunks)} chunks from {file_record.name}"
    
    except Exception as e:
        # If anything fails, mark the file as failed
        if file_record:
            file_record.status = "failed"
            db.commit()
        print(f"[INGEST] Failed for file_id {file_id}: {str(e)}")
        return f"Failed: {str(e)}"
    
    finally:
        db.close()
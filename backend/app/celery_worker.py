from celery import Celery
from app.database import SessionLocal
from app.models import File, Chunk
from app.parser import extract_text
from app.chunker import chunk_text
from app.vector_store import embed_and_store

celery_app = Celery(
    "worker",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0"
)

@celery_app.task
def ingest_file_task(file_id: int):
    db = SessionLocal()
    
    try:
        file_record = db.query(File).filter(File.id == file_id).first()
        if not file_record:
            return f"File with id {file_id} not found"
        
        file_path = f"uploads/{file_record.name}"
        print(f"[INGEST] Starting: {file_record.name} (type: {file_record.file_type})")
        text = extract_text(file_path, file_record.file_type)
        print(f"[INGEST] Extracted {len(text)} characters")
        
        chunks = chunk_text(text)
        print(f"[INGEST] Split into {len(chunks)} chunks")
        
        for i, chunk in enumerate(chunks):
            new_chunk = Chunk(file_id=file_record.id, text=chunk, chunk_index=i)
            db.add(new_chunk)
            db.flush()  # Get the new_chunk.id BEFORE commit
            
            # Embed and store in ChromaDB
            vector_id = embed_and_store(
                project_id=file_record.project_id,
                chunk_id=new_chunk.id,
                text=chunk
            )
            new_chunk.vector_id = vector_id
            print(f"[INGEST] Embedded chunk {i+1}/{len(chunks)}")
        
        file_record.status = "processed"
        db.commit()
        print(f"[INGEST] Completed: {file_record.name}")
        return f"Processed {len(chunks)} chunks from {file_record.name}"
    
    except Exception as e:
        if file_record:
            file_record.status = "failed"
            db.commit()
        print(f"[INGEST] Failed for file_id {file_id}: {str(e)}")
        return f"Failed: {str(e)}"
    
    finally:
        db.close()
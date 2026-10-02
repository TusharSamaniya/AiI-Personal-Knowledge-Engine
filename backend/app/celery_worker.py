import logging
from celery import Celery
from app.database import SessionLocal
from app.models import File, Chunk
from app.parser import extract_text
from app.chunker import chunk_text
from app.vector_store import embed_and_store
from app.extractors.youtube_extractor import extract_youtube_text
from app.extractors.web_extractor import extract_web_text

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

celery_app = Celery(
    "worker",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0"
)

def get_text_from_source(file_record) -> str:
    """Unified text extraction based on source type"""
    if file_record.source_type == "youtube":
        return extract_youtube_text(file_record.name)
    elif file_record.source_type == "web":
        return extract_web_text(file_record.name)
    else:
        return extract_text(f"uploads/{file_record.name}", file_record.file_type)

@celery_app.task(bind=True, max_retries=3)
def ingest_file_task(self, file_id: int):
    db = SessionLocal()
    file_record = None
    
    try:
        file_record = db.query(File).filter(File.id == file_id).first()
        if not file_record:
            return f"File with id {file_id} not found"
        
        logger.info(f"[INGEST] Starting: {file_record.name} (source: {file_record.source_type})")
        text = get_text_from_source(file_record)
        logger.info(f"[INGEST] Extracted {len(text)} characters")
        
        if not text or len(text.strip()) < 50:
            raise ValueError("Extracted text is too short. Source may be empty or blocked.")
        
        chunks = chunk_text(text)
        logger.info(f"[INGEST] Split into {len(chunks)} chunks")
        
        for i, chunk in enumerate(chunks):
            new_chunk = Chunk(file_id=file_record.id, text=chunk, chunk_index=i)
            db.add(new_chunk)
            db.flush()
    
            vector_id = embed_and_store(
                project_id=file_record.project_id,
                chunk_id=new_chunk.id,
                text=chunk,
                metadata={
                    "file_id": file_record.id,
                    "chunk_index": i,
                    "source_type": file_record.source_type
                }
            )
            new_chunk.vector_id = vector_id
            logger.info(f"[INGEST] Embedded chunk {i+1}/{len(chunks)}")
        
        file_record.status = "processed"
        file_record.error_message = None
        db.commit()
        logger.info(f"[INGEST] Completed: {file_record.name}")
        return f"Processed {len(chunks)} chunks from {file_record.name}"
    
    except Exception as e:
        error_msg = str(e)
        logger.error(f"[INGEST] Failed for file_id {file_id}: {error_msg}")
        
        if file_record:
            file_record.status = "failed"
            file_record.error_message = error_msg[:1000]  # Truncate long errors
            db.commit()
        
        # Retry for temporary errors
        if self.request.retries < self.max_retries:
            logger.info(f"[INGEST] Retrying task {file_id}... (attempt {self.request.retries + 1})")
            raise self.retry(exc=e, countdown=10)
        
        return f"Failed after {self.max_retries} retries: {error_msg}"
    
    finally:
        db.close()
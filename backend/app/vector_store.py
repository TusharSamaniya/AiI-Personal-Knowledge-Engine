import os
import chromadb
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

# Initialize Azure OpenAI Client (this is safe, it doesn't touch the disk)
azure_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version="2024-10-21",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

# --- LAZY CHROMADB INITIALIZATION ---
_chroma_client = None

def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path="./chroma_data")
    return _chroma_client

def get_collection(project_id: int):
    client = get_chroma_client()
    return client.get_or_create_collection(name=f"project_{project_id}")

def embed_and_store(project_id: int, chunk_id: int, text: str):
    # 1. Get the embedding from Azure OpenAI
    response = azure_client.embeddings.create(
        input=text,
        model=os.getenv("AZURE_EMBEDDING_DEPLOYMENT_NAME")
    )
    embedding = response.data[0].embedding
    
    # 2. Store in ChromaDB
    collection = get_collection(project_id)
    vector_id = f"chunk_{chunk_id}"
    collection.add(
        ids=[vector_id],
        embeddings=[embedding],
        documents=[text]
    )
    return vector_id

def search(project_id: int, query: str, top_k: int = 5):
    response = azure_client.embeddings.create(
        input=query,
        model=os.getenv("AZURE_EMBEDDING_DEPLOYMENT_NAME")
    )
    query_embedding = response.data[0].embedding
    
    collection = get_collection(project_id)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )
    return results["documents"][0]
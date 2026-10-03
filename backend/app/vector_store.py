import os
import chromadb
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

# Initialize Azure OpenAI Client
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

def embed_and_store(project_id: int, chunk_id: int, text: str, metadata: dict = None):
    # 1. Get the embedding from Azure OpenAI
    response = azure_client.embeddings.create(
        input=text,
        model=os.getenv("AZURE_EMBEDDING_DEPLOYMENT_NAME")
    )
    embedding = response.data[0].embedding
    
    # 2. Store in ChromaDB WITH metadata
    collection = get_collection(project_id)
    vector_id = f"chunk_{chunk_id}"
    
    # Prepare metadata (ChromaDB requires flat string/int/float values)
    meta = metadata or {}
    meta = {k: v for k, v in meta.items() if v is not None}
    
    collection.add(
        ids=[vector_id],
        embeddings=[embedding],
        documents=[text],
        metadatas=[meta] if meta else None
    )
    return vector_id

def search(project_id: int, query: str, top_k: int = 5, max_distance: float = 2.0):
    # 1. Embed the query using Azure
    response = azure_client.embeddings.create(
        input=query,
        model=os.getenv("AZURE_EMBEDDING_DEPLOYMENT_NAME")
    )
    query_embedding = response.data[0].embedding
    
    # 2. Search ChromaDB
    collection = get_collection(project_id)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )
    
    # 3. Extract the parallel lists
    documents = results["documents"][0]
    distances = results["distances"][0]
    ids = results["ids"][0]
    metadatas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(documents)
    
    # 4. Filter by distance threshold
    filtered = []
    for doc, dist, vid, meta in zip(documents, distances, ids, metadatas):
        if dist <= max_distance:
            filtered.append({
                "text": doc,
                "vector_id": vid,
                "distance": round(dist, 3),
                "file_id": meta.get("file_id") if meta else None
            })
    
    return filtered
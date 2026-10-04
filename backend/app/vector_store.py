import os
import chromadb
from chromadb.config import Settings
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

# Azure OpenAI Client
azure_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version="2024-10-21",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

# HTTP client pointing to the chromadb service
CHROMA_HOST = os.getenv("CHROMA_HOST", "chromadb")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))

def get_chroma_client():
    return chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)

def get_collection(project_id: int):
    client = get_chroma_client()
    return client.get_or_create_collection(name=f"project_{project_id}")

def embed_and_store(project_id: int, chunk_id: int, text: str, metadata: dict = None):
    response = azure_client.embeddings.create(
        input=text,
        model=os.getenv("AZURE_EMBEDDING_DEPLOYMENT_NAME")
    )
    embedding = response.data[0].embedding
    
    collection = get_collection(project_id)
    vector_id = f"chunk_{chunk_id}"
    
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
    response = azure_client.embeddings.create(
        input=query,
        model=os.getenv("AZURE_EMBEDDING_DEPLOYMENT_NAME")
    )
    query_embedding = response.data[0].embedding
    
    collection = get_collection(project_id)
    
    if collection.count() == 0:
        return []
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count())
    )
    
    documents = results["documents"][0]
    distances = results["distances"][0]
    ids = results["ids"][0]
    metadatas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(documents)
    
    print("[SEARCH] Collection count:", collection.count())
    print("[SEARCH] Distances:", distances)
    print("[SEARCH] IDs:", ids)
    
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
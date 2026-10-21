import os
from pinecone import Pinecone
from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

# Azure OpenAI Client
azure_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version="2024-10-21",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

# Pinecone Client
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index("knowledge-engine")

def embed_and_store(project_id: int, chunk_id: int, text: str, metadata: dict = None):
    response = azure_client.embeddings.create(
        input=text,
        model=os.getenv("AZURE_EMBEDDING_DEPLOYMENT_NAME")
    )
    embedding = response.data[0].embedding
    
    meta = metadata or {}
    meta["text"] = text 
    
    index.upsert(
        vectors=[{
            "id": f"chunk_{chunk_id}",
            "values": embedding,
            "metadata": meta
        }],
        namespace=f"project_{project_id}"
    )
    return f"chunk_{chunk_id}"

# Added max_distance back to the arguments to fix the Chat 500 error
def search(project_id: int, query: str, top_k: int = 5, max_distance: float = 2.0):
    response = azure_client.embeddings.create(
        input=query,
        model=os.getenv("AZURE_EMBEDDING_DEPLOYMENT_NAME")
    )
    query_embedding = response.data[0].embedding
    
    results = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True,
        namespace=f"project_{project_id}"
    )
    
    filtered = []
    for match in results.matches:
        meta = match.metadata
        filtered.append({
            "text": meta.get("text", ""),
            "file_id": meta.get("file_id"),
            "vector_id": match.id,
            "distance": match.score 
        })
    return filtered

# Adapter for main.py to use .count() and .get()
class PineconeCollectionAdapter:
    def __init__(self, project_id):
        self.namespace = f"project_{project_id}"
        
    def count(self):
        try:
            stats = index.describe_index_stats()
            if "namespaces" in stats and self.namespace in stats["namespaces"]:
                return stats["namespaces"][self.namespace]["vector_count"]
            return 0
        except Exception:
            return 0

    def get(self):
        try:
            ids = []
            for ids_page in index.list(namespace=self.namespace):
                for item in ids_page:
                    ids.append(item.id if hasattr(item, 'id') else item)
                if len(ids) >= 100: 
                    break
            
            if not ids:
                return {"documents": []}

            fetch_response = index.fetch(ids=ids[:100], namespace=self.namespace)
            
            documents = []
            for vec in fetch_response.vectors.values():
                if vec.metadata and "text" in vec.metadata:
                    documents.append(vec.metadata["text"])
                    
            return {"documents": documents}
        except Exception as e:
            print(f"[PINECONE] Failed to get documents: {e}")
            return {"documents": []}

def get_collection(project_id: int):
    return PineconeCollectionAdapter(project_id)
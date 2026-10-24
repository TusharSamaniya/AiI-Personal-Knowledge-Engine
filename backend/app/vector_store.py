import os
import math
from pinecone import Pinecone
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# ── Gemini embeddings ────────────────────────────────────────────────
EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 1536          # must match your Pinecone index dimension
EMBED_BATCH_SIZE = 100    # Gemini allows up to 100 texts per request

gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# ── Pinecone ─────────────────────────────────────────────────────────
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index("knowledge-engine")


def _normalize(vec):
    # Gemini only returns pre-normalized vectors at 3072 dims.
    # For smaller sizes we normalize ourselves so similarity scores stay accurate.
    norm = math.sqrt(sum(x * x for x in vec))
    return [x / norm for x in vec] if norm else vec


def _embed(texts: list, task_type: str) -> list:
    """Embed a list of texts, returns a list of vectors in the same order."""
    all_vectors = []
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[i:i + EMBED_BATCH_SIZE]
        response = gemini_client.models.embed_content(
            model=EMBED_MODEL,
            contents=batch,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=EMBED_DIM,
            ),
        )
        all_vectors.extend(_normalize(e.values) for e in response.embeddings)
    return all_vectors


def embed_and_store(project_id: int, chunk_id: int, text: str, metadata: dict = None):
    embedding = _embed([text], "RETRIEVAL_DOCUMENT")[0]

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


def search(project_id: int, query: str, top_k: int = 5, max_distance: float = 2.0):
    query_embedding = _embed([query], "RETRIEVAL_QUERY")[0]

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
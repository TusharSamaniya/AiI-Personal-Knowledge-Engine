import os
from groq import Groq, AsyncGroq
from dotenv import load_dotenv

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
async_groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))


def generate_answer(question: str, context_chunks: list) -> str:
    context = "\n\n---\n\n".join(context_chunks)
    prompt = f"""You are a helpful assistant. Answer the user's question using ONLY the context below.
If the answer is not in the context, say "I don't know based on the provided documents."

Context:
{context}

Question: {question}

Answer:"""
    response = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )
    return response.choices[0].message.content


async def stream_answer_async(question: str, context_chunks: list):
    print(f"[LLM] Starting stream for: {question[:60]}...", flush=True)
    context = "\n\n---\n\n".join(context_chunks)
    prompt = f"""You are a helpful assistant. Answer the user's question using ONLY the context below.
If the answer is not in the context, say "I don't know based on the provided documents."

Context:
{context}

Question: {question}

Answer:"""
    print("[LLM] Calling Groq (async)...", flush=True)
    stream = await async_groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        stream=True
    )
    print("[LLM] Groq stream opened. Waiting for tokens...", flush=True)
    async for chunk in stream:
        token = chunk.choices[0].delta.content
        if token:
            yield token
    print("[LLM] Stream finished.", flush=True)
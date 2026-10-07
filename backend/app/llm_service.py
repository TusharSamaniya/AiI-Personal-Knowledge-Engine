import os
import asyncio
import logging
from groq import Groq, AsyncGroq
from dotenv import load_dotenv
import json

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
async_groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))


def generate_answer(question: str, context_chunks: list) -> str:
    context = "\n\n---\n\n".join(context_chunks)
    prompt = f"""You are a helpful assistant. Use the context below to answer the user's question.

Each piece of context starts with a [Source: filename] tag identifying which document it came from.

Rules:
- If the user mentions a specific document, use the [Source: ...] tags to find the right chunk.
- If the context contains information that answers the question (even if not word-for-word), provide a helpful, grounded answer.
- You may summarize, paraphrase, or synthesize information from the context.
- Only say "I don't know based on the provided documents" if none of the context chunks are related to the question.
- Do not make up facts that are not in the context.

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


async def stream_answer_async(question: str, context_chunks: list, max_retries: int = 3):
    """Streams tokens from Groq with retry logic for transient failures."""
    logger.info(f"[LLM] Starting stream for: {question[:60]}...")
    
    context = "\n\n---\n\n".join(context_chunks)
    prompt = f"""You are a helpful assistant. Answer the user's question using ONLY the context below.

The context is a list of chunks. Each chunk starts with a [Source: filename] tag telling you which document it came from.

IMPORTANT RULES:
1. If the user mentions a specific document name (like "Artificial intelligence" or "First Meeting"), ONLY use chunks whose [Source: ...] tag matches that name.
2. If the user's question is general, use ALL chunks but base your answer on the most relevant one.
3. Do NOT use chunks from a different document just because they mention similar words.
4. If the answer truly isn't in any chunk, say "I don't know based on the provided documents."

Context:
{context}

Question: {question}

Answer:"""

    last_error = None
    for attempt in range(max_retries):
        try:
            logger.info(f"[LLM] Calling Groq (attempt {attempt + 1}/{max_retries})...")
            stream = await async_groq_client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                stream=True
            )
            logger.info("[LLM] Groq stream opened. Yielding tokens...")
            
            async for chunk in stream:
                token = chunk.choices[0].delta.content
                if token:
                    yield token
            
            logger.info("[LLM] Stream finished successfully.")
            return  # Success!
        
        except Exception as e:
            last_error = e
            logger.warning(f"[LLM] Attempt {attempt + 1} failed: {str(e)}")
            
            # If we have more retries left, wait and try again
            if attempt < max_retries - 1:
                wait_time = 2 * (attempt + 1)  # 2s, 4s (linear backoff)
                logger.info(f"[LLM] Waiting {wait_time}s before retry...")
                await asyncio.sleep(wait_time)
    
    # All retries exhausted
    logger.error(f"[LLM] All {max_retries} attempts failed. Last error: {str(last_error)}")
    raise Exception(f"AI service unavailable after {max_retries} attempts. Please try again in a moment.")

async def generate_quiz(content: str, num_questions: int = 5) -> dict:
    """Generate a multiple-choice quiz from the given content.
    Returns a dict: {"title": ..., "questions": [{...}, ...]}
    """
    prompt = f"""You are a quiz generator. Based on the content below, generate exactly {num_questions} multiple-choice questions.

Return ONLY a valid JSON object with this exact structure:
{{
  "title": "A short quiz title (max 8 words)",
  "questions": [
    {{
      "question": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Why this answer is correct (1-2 sentences)"
    }}
  ]
}}

Rules:
- Each question MUST have exactly 4 options.
- "correct_index" must be 0, 1, 2, or 3.
- Make questions from the content only. Do not invent facts.
- Return exactly {num_questions} questions.

Content:
{content}
"""
    
    response = await async_groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        response_format={"type": "json_object"}
    )
    
    raw = response.choices[0].message.content
    return json.loads(raw)
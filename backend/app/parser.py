import pdfplumber
import docx

def extract_text(file_path: str, file_type: str) -> str:
    if file_type == "pdf":
        with pdfplumber.open(file_path) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    elif file_type == "docx":
        doc = docx.Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs)
    else:  # txt, csv
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
import os
import shutil
from fastapi import UploadFile

UPLOAD_DIR = "uploads"

class LocalStorage:
    def __init__(self):
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    def save_file(self, file: UploadFile):
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return file_path
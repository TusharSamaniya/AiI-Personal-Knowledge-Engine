import boto3
import os
import tempfile
from fastapi import UploadFile
from dotenv import load_dotenv

load_dotenv()

# Backblaze B2 S3-compatible endpoint
B2_ENDPOINT_URL = f"https://s3.{os.getenv('B2_REGION', 'us-west-004')}.backblazeb2.com"

s3_client = boto3.client(
    service_name="s3",
    endpoint_url=B2_ENDPOINT_URL,
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
    region_name=os.getenv('B2_REGION', 'us-west-004')
)

BUCKET = os.getenv('R2_BUCKET_NAME')


def _key(project_id: int, filename: str) -> str:
    # One folder per project so two projects can't overwrite each other's files
    return f"project_{project_id}/{os.path.basename(filename)}"


class LocalStorage:
    def save_file(self, file: UploadFile, project_id: int):
        key = _key(project_id, file.filename)
        s3_client.upload_fileobj(file.file, BUCKET, key)
        return f"s3://{BUCKET}/{key}"

    def download_to_temp(self, project_id: int, filename: str) -> str:
        """Download a file from B2 to a temp path and return that path."""
        suffix = os.path.splitext(filename)[1]
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.close()
        s3_client.download_file(BUCKET, _key(project_id, filename), tmp.name)
        return tmp.name
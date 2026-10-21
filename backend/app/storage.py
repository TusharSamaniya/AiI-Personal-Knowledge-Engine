import boto3
import os
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

class LocalStorage:
    def save_file(self, file: UploadFile):
        s3_client.upload_fileobj(
            file.file,
            os.getenv('R2_BUCKET_NAME'),
            file.filename
        )
        return f"s3://{os.getenv('R2_BUCKET_NAME')}/{file.filename}"
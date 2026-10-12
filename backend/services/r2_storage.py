import boto3
import uuid
import os
from botocore.config import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError
from boto3.exceptions import Boto3Error
from flask import current_app

STORAGE_ERRORS = (RuntimeError, OSError, BotoCoreError, ClientError, Boto3Error)

class R2Storage:
    def __init__(self, app=None):
        self.client = None
        if app:
            self.init_app(app)

    def init_app(self, app):
        self.client = None
        account_id = app.config.get("R2_ACCOUNT_ID")
        access_key = app.config.get("R2_ACCESS_KEY_ID")
        secret_key = app.config.get("R2_SECRET_ACCESS_KEY")
        self.bucket = app.config.get("R2_BUCKET_NAME")
        self.public_url = app.config.get("R2_PUBLIC_URL", "")

        if not all([account_id, access_key, secret_key, self.bucket]):
            app.logger.warning("R2 storage not fully configured. File uploads will fail.")
            return

        endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=BotoConfig(signature_version="s3v4", region_name="auto", connect_timeout=3, read_timeout=15,
                              retries={"max_attempts": 2, "mode": "standard"}),
        )

    def upload_file(self, file_obj, folder="papers", filename=None):
        if not self.client:
            raise RuntimeError("R2 storage is not configured")

        if filename is None:
            ext = file_obj.filename.rsplit(".", 1)[-1] if "." in file_obj.filename else "bin"
            filename = f"{uuid.uuid4().hex}.{ext}"

        key = f"{folder}/{filename}"
        self.client.upload_fileobj(file_obj, self.bucket, key, ExtraArgs={"ContentType": file_obj.content_type or "application/octet-stream"})
        return key

    def upload_from_path(self, file_path, folder="papers", filename=None):
        if not self.client:
            raise RuntimeError("R2 storage is not configured")

        if filename is None:
            filename = os.path.basename(file_path)

        key = f"{folder}/{filename}"
        self.client.upload_file(file_path, self.bucket, key)
        return key

    def get_url(self, key):
        if self.public_url:
            return f"{self.public_url}/{key}"
        if not self.client:
            return key
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=3600,
        )

    def download_file(self, key):
        if not self.client:
            raise RuntimeError("R2 storage is not configured")
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        body = response["Body"]
        try:
            limit = current_app.config["MAX_FILE_BYTES"]
            if response.get("ContentLength", 0) > limit:
                raise RuntimeError("Stored file exceeds the download limit.")
            data = body.read(limit + 1)
            if len(data) > limit:
                raise RuntimeError("Stored file exceeds the download limit.")
            return data
        finally:
            body.close()

    def delete_file(self, key):
        if not self.client:
            raise RuntimeError("R2 storage is not configured")
        self.client.delete_object(Bucket=self.bucket, Key=key)

r2_storage = R2Storage()

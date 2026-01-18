"""
Cloudflare R2 storage client using S3-compatible API.

Uploads generated images to R2 bucket and returns public URLs.
"""

import logging
from typing import Optional
import boto3
from botocore.client import Config
import uuid

from app.settings import settings


logger = logging.getLogger(__name__)


class R2Client:
    """Client for uploading files to Cloudflare R2."""
    
    def __init__(self):
        """Initialize R2 client with S3-compatible configuration."""
        if not settings.r2_access_key_id or not settings.r2_secret_access_key:
            raise ValueError("R2 credentials not configured (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)")
        
        if not settings.r2_endpoint:
            raise ValueError("R2_ENDPOINT not configured")
        
        # Create S3 client with R2-specific configuration
        self.s3_client = boto3.client(
            's3',
            endpoint_url=settings.r2_endpoint,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name='auto',  # Required by SDK but not used by R2
            config=Config(signature_version='s3v4')
        )
        
        self.bucket_name = settings.r2_bucket
        self.public_base_url = settings.r2_public_base_url
        
        logger.info(f"Initialized R2 client for bucket: {self.bucket_name}")
    
    def upload_bytes(
        self,
        data: bytes,
        content_type: str,
        extension: str,
        key_prefix: str
    ) -> tuple[str, str]:
        """
        Upload arbitrary bytes to R2 and return its public URL.
        
        Args:
            data: File bytes to upload
            content_type: MIME type of the file
            extension: File extension (without dot, e.g., "png", "glb")
            key_prefix: Prefix for the object key (folder-like structure)
            
        Returns:
            Tuple of (object_key, public_url)
            
        Raises:
            Exception: If upload fails
        """
        # Generate unique object key
        unique_id = uuid.uuid4().hex
        object_key = f"{key_prefix}/{unique_id}.{extension}"
        
        logger.info(f"Uploading to R2: bucket={self.bucket_name}, key={object_key}")
        
        try:
            # Upload to R2 using S3 API
            # Note: R2 does not support ACL parameters like public-read
            # Public access is controlled at the bucket level
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=data,
                ContentType=content_type
            )
            
            # Construct public URL
            # Format: https://pub-<bucket-id>.r2.dev/<object-key>
            public_url = f"{self.public_base_url.rstrip('/')}/{object_key}"
            
            logger.info(f"Successfully uploaded to R2: {public_url}")
            
            return object_key, public_url
            
        except Exception as e:
            logger.error(f"Failed to upload to R2: {e}")
            raise Exception(f"R2 upload failed: {e}")
    
    def upload_image(
        self,
        image_bytes: bytes,
        content_type: str = "image/png",
        key_prefix: str = "items"
    ) -> tuple[str, str]:
        """
        Upload an image to R2 and return its public URL.
        
        Args:
            image_bytes: Image file bytes to upload
            content_type: MIME type of the image
            key_prefix: Prefix for the object key (folder-like structure)
            
        Returns:
            Tuple of (object_key, public_url)
            
        Raises:
            Exception: If upload fails
        """
        # Extract file extension from content type
        file_extension = content_type.split('/')[-1]  # e.g., "png" from "image/png"
        
        return self.upload_bytes(
            data=image_bytes,
            content_type=content_type,
            extension=file_extension,
            key_prefix=key_prefix
        )
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # LLM Provider
    llm_provider: str = "openai"
    
    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-5.2"
    openai_temperature: float = 0.7
    openai_reasoning_effort: str = "low"
    openai_verbosity: str = "low"
    openai_max_output_tokens: int = 4000
    
    # Gemini (for Nano Banana image generation)
    gemini_api_key: str = ""
    gemini_image_model: str = "gemini-2.5-flash-image"
    
    # Cloudflare R2 (object storage)
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_account_id: str = ""
    r2_endpoint: str = ""  # e.g., https://<ACCOUNT_ID>.r2.cloudflarestorage.com
    r2_bucket: str = "deja-view"
    r2_public_base_url: str = ""  # e.g., https://pub-16db5fa34f6c44358a6ad41118051522.r2.dev
    
    # Service defaults
    max_pins_default: int = 50
    page_size_default: int = 50
    pinterest_api_base_url: str = "https://api.pinterest.com/v5"
    
    # HTTP client
    request_timeout_seconds: int = 30
    max_retries: int = 3


# Global settings instance
settings = Settings()

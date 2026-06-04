from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Anthropic / LLM Configuration
    ANTHROPIC_API_KEY: str = ""  
    ANTHROPIC_MODEL: str = "claude-haiku-4-5-20251001"
    ANTHROPIC_MAX_TOKENS: int = 1024

    # JWT Configuration
    JWT_SECRET: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # Database Configuration
    DATABASE_URL: str = "sqlite:///./data.db"

    # Environment Configuration
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    FRONTEND_URL: str = "http://localhost:5173"

    # Optional API Keys
    OPENAI_API_KEY: Optional[str] = None

    # File Configuration
    JOBS_DATA_DIR: str = "./jobs_data"
    REDIS_URL: str = "redis://localhost:6379"
    UPLOAD_DIR: str = "./uploads"

    class Config:
        env_file = ".env"
        case_sensitive = False  

settings = Settings()


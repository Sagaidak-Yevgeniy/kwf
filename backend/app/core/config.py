from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_name: str = "KWF Tournament Platform"
    database_url: str = "sqlite:///./kwf.db"
    jwt_secret: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    access_token_expire_min: int = 60 * 12
    cookie_secure: bool = False
    cors_origins: str = "http://localhost:5173"

settings = Settings()

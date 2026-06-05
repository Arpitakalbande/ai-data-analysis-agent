from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Data Analysis Agent - Minimal API")

# Keep CORS configuration conservative for dev; adjust in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Health check endpoint - retained for monitoring.

    Note: several previously defined endpoints (slide generation & RAG processing)
    were removed because they depend on external/absent modules (`llm.*`, `parsers.*`).
    Remove them from the codebase until implementations are available.
    """
    return {"status": "ok", "message": "API is running (minimal)"}

















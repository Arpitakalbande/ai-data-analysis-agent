from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import upload, analyze, charts, insights, dashboard, export, status, connect, auth
from app.core.database import init_db

app = FastAPI(title="DataViz AI API", version="1.0.0")


init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(upload.router, prefix="/upload", tags=["Upload"])
app.include_router(analyze.router, prefix="/analyze", tags=["Analysis"])
app.include_router(charts.router, prefix="/charts", tags=["Charts"])
app.include_router(insights.router, prefix="/insights", tags=["Insights"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(export.router, prefix="/export", tags=["Export"])
app.include_router(connect.router, prefix="/connect-db", tags=["Database"])
app.include_router(status.router, prefix="/status", tags=["Status"])

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "message": "DataViz AI API is running. Use /health for health checks and /docs for API docs.",
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

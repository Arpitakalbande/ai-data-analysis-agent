from fastapi import APIRouter, UploadFile, File, HTTPException
from app.agents.file_processor import process_file
from app.core.job_manager_file import create_job
import uuid

router = APIRouter()

@router.post("")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files supported")

    job_id = str(uuid.uuid4())
    content = await file.read()

    create_job(job_id)

    try:
        if hasattr(process_file, "apply_async"):
            try:
                process_file.apply_async(args=[job_id, content, file.filename], task_id=job_id)
            except TypeError:
                process_file(job_id, content, file.filename)
        else:
            process_file(job_id, content, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload processing failed: {exc}") from exc

    return {
        "job_id": job_id,
        "message": "File uploaded successfully. Processing has started."
    }

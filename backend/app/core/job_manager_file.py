import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import Optional, Dict, Any


JOBS_DIR = Path("./jobs_data")
JOBS_DIR.mkdir(exist_ok=True)





def _get_job_file(job_id: str) -> Path:
    return JOBS_DIR / f"{job_id}.json"





def _load_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Load job data from JSON file"""
    file_path = _get_job_file(job_id)
    if not file_path.exists():
        return None

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        
        print(f"[job_manager_file] Corrupted JSON for job '{job_id}', resetting file")
        return None
    except Exception as e:
        print(f"[job_manager_file] Failed to load job '{job_id}': {e}")
        return None
    




def _save_job(job_id: str, data: Dict[str, Any]):
    """Save job data to JSON file"""
    file_path = _get_job_file(job_id)
    temp_file_path = file_path.with_suffix(".json.tmp")

    def _json_default(value):
        if isinstance(value, (datetime, date)):
            return value.isoformat()

        try:
            import numpy as np

            if isinstance(value, np.generic):
                return value.item()
        except Exception:
            pass

        return str(value)

    with open(temp_file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, default=_json_default)

    os.replace(temp_file_path, file_path)






def create_job(job_id: str):
    """Create a new job entry"""
    data = {
        "status": "pending",
        "progress": 0,
    }
    _save_job(job_id, data)




def update_job_status(job_id: str, status: str, progress: int):
    """Update job status and progress"""
    data = _load_job(job_id) or {}
    data.update({
        "status": status,
        "progress": progress,
    })
    _save_job(job_id, data)




def save_job_data(job_id: str, data: dict):
    """Save processed data for a job"""
    job = _load_job(job_id) or {}
    job["data"] = data
    job["status"] = "completed"
    job["progress"] = 100
    _save_job(job_id, job)





def get_job_data(job_id: str) -> Optional[Dict[str, Any]]:
    """Get job data"""
    job = _load_job(job_id)
    return job.get("data") if job else None




def create_analysis(analysis_id: str, job_id: str = None, user_id: str = None):
    """Create a new analysis entry"""
    data = {
        "status": "pending",
        "progress": 0,
    }
    if job_id:
        data["job_id"] = job_id
    if user_id:
        data["user_id"] = user_id
    _save_job(f"analysis_{analysis_id}", data)





def save_analysis(analysis_id: str, eda_result: dict):
    """Save EDA analysis results"""
    analysis = _load_job(f"analysis_{analysis_id}") or {}
    analysis["eda"] = eda_result
    analysis["status"] = "completed"
    analysis["progress"] = 100
    _save_job(f"analysis_{analysis_id}", analysis)




def update_analysis_status(analysis_id: str, status: str, progress: int):
    """Update analysis status"""
    analysis = _load_job(f"analysis_{analysis_id}") or {}
    analysis.update({
        "status": status,
        "progress": progress,
    })
    _save_job(f"analysis_{analysis_id}", analysis)





def save_charts(analysis_id: str, charts: list):
    """Save generated charts"""
    analysis = _load_job(f"analysis_{analysis_id}") or {}
    analysis["charts"] = charts
    _save_job(f"analysis_{analysis_id}", analysis)




def save_insights(analysis_id: str, insights: dict):
    """Save AI-generated insights"""
    analysis = _load_job(f"analysis_{analysis_id}") or {}
    
    if isinstance(insights, dict):
        analysis["insights"] = insights.get("insights", "")
    else:
        analysis["insights"] = insights
    _save_job(f"analysis_{analysis_id}", analysis)






def get_analysis(analysis_id: str) -> Optional[Dict[str, Any]]:
    """Get complete analysis data"""
    return _load_job(f"analysis_{analysis_id}")




def get_status(entity_id: str, entity_type: str = "job") -> Dict[str, Any]:
    """Get status of a job or analysis"""
    prefix = "analysis_" if entity_type == "analysis" else ""
    data = _load_job(f"{prefix}{entity_id}")
    
    if not data:
        return {
            "status": "not_found",
            "progress": 0,
            "message": f"{entity_type.capitalize()} not found"
        }
    
    return {
        "status": data.get("status", "unknown"),
        "progress": data.get("progress", 0),
    }

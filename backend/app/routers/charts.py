# app/routers/charts.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.agents.chart_agent import generate_charts
from app.core.job_manager_file import get_analysis

router = APIRouter()


class ChartRequest(BaseModel):
    analysis_id: str


@router.post("")
def create_charts(request: ChartRequest):
    analysis = get_analysis(request.analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    try:
        
        result = generate_charts(request.analysis_id)
        print(f"Charts generated: {len(result) if isinstance(result, list) else 'unknown'}")
    except Exception as e:
        print(f"Error generating charts: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "analysis_id": request.analysis_id,
            "charts": [],
            "error": str(e)
        }
    
    # Fetch and return the generated charts
    updated_analysis = get_analysis(request.analysis_id)
    return {
        "analysis_id": request.analysis_id,
        "charts": updated_analysis.get("charts", [])
    }


@router.get("/{analysis_id}")
def get_charts(analysis_id: str):
    analysis = get_analysis(analysis_id)
    if not analysis or "charts" not in analysis:
        raise HTTPException(status_code=404, detail="Charts not available yet")

    return {
        "analysis_id": analysis_id,
        "charts": analysis["charts"]
    }

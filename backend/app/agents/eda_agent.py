from celery import shared_task
import pandas as pd
import numpy as np


@shared_task(bind=True)
def run_eda(self, analysis_id: str):
    from app.core.job_manager_file import (
        get_analysis,
        get_job_data,
        update_analysis_status,
        save_analysis,
    )

  
    analysis = get_analysis(analysis_id)
    if not analysis or "job_id" not in analysis:
        raise ValueError(f"Invalid analysis_id={analysis_id}")

    job_id = analysis["job_id"]
    job = get_job_data(job_id)

    if not job or "data" not in job:
        raise ValueError(f"Job data not found for job_id={job_id}")

    update_analysis_status(analysis_id, "running", progress=10)

    if isinstance(job["data"], dict):
        df = pd.DataFrame.from_dict(job["data"])
    else:
        df = pd.DataFrame(job["data"])

    if df.empty:
        raise ValueError("Failed to load dataframe")


    df = df.replace(r"^\s*$", np.nan, regex=True)
    for col in df.select_dtypes(include=["object", "string"]).columns:
        normalized = df[col].astype(str).str.strip().str.lower()
        missing_like = normalized.isin({"na", "n/a", "none", "null", "nan"})
        df.loc[missing_like, col] = np.nan

    original_rows = len(df)
    original_duplicates = df.duplicated().sum()
    original_missing = df.isnull().sum().sum()

    
    df = df.drop_duplicates()
    duplicates_removed = original_rows - len(df)

  
    rows_with_any_missing = df.isnull().any(axis=1).sum()
    df = df.dropna(how="any")
    missing_rows_removed = rows_with_any_missing

    preprocessing_info = {
        "original_rows": original_rows,
        "original_total_missing_cells": int(original_missing),
        "duplicates_found": int(original_duplicates), 
        "duplicates_removed": int(duplicates_removed),
        "rows_with_missing_removed": int(missing_rows_removed),
        "cleaned_rows": len(df),
        "data_quality_score": round(100 * (len(df) / original_rows), 2) if original_rows > 0 else 0
    }

    if df.empty:
        raise ValueError("No data remaining after preprocessing (all rows had missing values or were duplicates)")


    eda = {}

    
    eda["row_count"] = len(df)
    eda["column_count"] = len(df.columns)
    eda["columns"] = list(df.columns)
    eda["dtypes"] = {col: str(dtype) for col, dtype in df.dtypes.items()}
    eda["preprocessing"] = preprocessing_info

    update_analysis_status(analysis_id, "running", progress=30)

    eda["missing_values"] = {
        col: int(df[col].isnull().sum()) for col in df.columns
    }
    eda["missing_percentage"] = {
        col: round(100 * df[col].isnull().sum() / len(df), 2) for col in df.columns
    }

    update_analysis_status(analysis_id, "running", progress=50)

  
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    eda["numeric_columns"] = numeric_cols
    eda["numeric_stats"] = {}

    def safe_float(value, default=0.0):
        """Convert to float, replacing NaN/Inf with default"""
        try:
            val = float(value)
            if np.isnan(val) or np.isinf(val):
                return default
            return round(val, 4)
        except (ValueError, TypeError):
            return default

    for col in numeric_cols:
     
        if df[col].notna().sum() == 0:
            eda["numeric_stats"][col] = {
                "mean": 0.0,
                "median": 0.0,
                "std": 0.0,
                "min": 0.0,
                "max": 0.0,
                "q25": 0.0,
                "q75": 0.0,
                "skewness": 0.0,
                "kurtosis": 0.0,
            }
        else:
            eda["numeric_stats"][col] = {
                "mean": safe_float(df[col].mean()),
                "median": safe_float(df[col].median()),
                "std": safe_float(df[col].std()),
                "min": safe_float(df[col].min()),
                "max": safe_float(df[col].max()),
                "q25": safe_float(df[col].quantile(0.25)),
                "q75": safe_float(df[col].quantile(0.75)),
                "skewness": safe_float(df[col].skew()),
                "kurtosis": safe_float(df[col].kurtosis()),
            }

    update_analysis_status(analysis_id, "running", progress=70)


    categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    eda["categorical_columns"] = categorical_cols
    eda["categorical_stats"] = {}

    for col in categorical_cols:
        value_counts = df[col].value_counts()
        eda["categorical_stats"][col] = {
            "unique_count": int(df[col].nunique()),
            "top_value": str(value_counts.index[0]) if len(value_counts) > 0 else None,
            "top_value_count": int(value_counts.iloc[0]) if len(value_counts) > 0 else 0,
            "mode": str(df[col].mode()[0]) if len(df[col].mode()) > 0 else None,
        }

    if len(numeric_cols) > 1:
        corr_matrix = df[numeric_cols].corr()

        corr_matrix = corr_matrix.fillna(0.0).replace([np.inf, -np.inf], 0.0)
        eda["correlation"] = {
            col: {k: safe_float(v) for k, v in row.items()}
            for col, row in corr_matrix.to_dict().items()
        }

  
    eda["data_quality"] = {
        "completeness": round(100 * (1 - (sum(eda["missing_values"].values()) / (len(df) * len(df.columns)))), 2) if len(df) > 0 else 100,
        "uniqueness": round(100 * (1 - (duplicates_removed / original_rows)), 2) if original_rows > 0 else 100,
        "consistency_score": preprocessing_info["data_quality_score"]
    }

    update_analysis_status(analysis_id, "running", progress=85)

    
    cleaned_job_payload = {
        "filename": job.get("filename"),
        "data": df.to_dict(orient="list"),
    }
    from app.core.job_manager_file import save_job_data
    save_job_data(job_id, cleaned_job_payload)

    
    save_analysis(analysis_id, eda)

    update_analysis_status(analysis_id, "completed", progress=100)

    return {"analysis_id": analysis_id, "eda": eda, "preprocessing": preprocessing_info}

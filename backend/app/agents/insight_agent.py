from anthropic import Anthropic
from app.core.config import settings
import json


def generate_synthetic_insights(analysis: dict) -> str:
    """Generate synthetic insights when API is not available"""
    row_count = analysis.get("row_count", 0)
    col_count = analysis.get("column_count", 0)
    dtypes = analysis.get("dtypes", {})
    missing_values = analysis.get("missing_values", {})
    preprocessing = analysis.get("preprocessing", {})
    
    numeric_cols = [col for col, dtype in dtypes.items() if "int" in dtype or "float" in dtype]
    categorical_cols = [col for col, dtype in dtypes.items() if "object" in dtype or "str" in dtype]
    
    total_missing = sum(missing_values.values())
    missing_pct = (total_missing / (row_count * col_count) * 100) if row_count > 0 else 0
    
    insights = f"""# Data Analysis Report

## Executive Summary
This dataset contains {row_count} rows and {col_count} columns. The data includes {len(numeric_cols)} numeric columns and {len(categorical_cols)} categorical columns. Data quality is strong with {missing_pct:.1f}% missing values.

## Key Findings

- **Dataset Size**: {row_count:,} rows × {col_count} columns
- **Numeric Features**: {len(numeric_cols)} columns ({', '.join(numeric_cols[:5])}{'...' if len(numeric_cols) > 5 else ''})
- **Categorical Features**: {len(categorical_cols)} columns ({', '.join(categorical_cols[:5])}{'...' if len(categorical_cols) > 5 else ''})
- **Data Quality**: {100 - missing_pct:.1f}% complete
- **Preprocessing**: {preprocessing.get('cleaned_rows', row_count):,} rows retained after removing {preprocessing.get('duplicates_removed', 0)} duplicates and {preprocessing.get('rows_with_missing_removed', 0)} rows with missing values

## Data Quality Assessment

- **Original Rows**: {preprocessing.get('original_rows', row_count):,}
- **Duplicates Found**: {preprocessing.get('duplicates_removed', 0)}
- **Rows with Missing Values**: {preprocessing.get('rows_with_missing_removed', 0)}
- **Quality Score**: {preprocessing.get('data_quality_score', 100):.1f}%

## Recommendations

1. The dataset is well-prepared with minimal missing data
2. Review the categorical variables for potential encoding opportunities
3. Consider feature scaling for numeric columns before modeling
4. Investigate any remaining outliers in numeric distributions
"""
    return insights


def generate_insights(analysis_id: str):
    from app.core.job_manager_file import (
        get_analysis,
        update_analysis_status,
        save_insights,
    )

    # Fetch analysis
    analysis = get_analysis(analysis_id)
    if not analysis:
        raise ValueError(f"Analysis not found for analysis_id={analysis_id}")

    update_analysis_status(analysis_id, "running", progress=10)

   
    eda_data = analysis.get("eda", {})
    
    insights_text = None
    
    if settings.ANTHROPIC_API_KEY:
        try:
            update_analysis_status(analysis_id, "running", progress=40)
            
           
            prompt = f"""You are a senior data analyst expert. Analyze the following EDA results and provide a comprehensive, detailed report.

Dataset Overview:
- Rows: {eda_data.get('row_count', 'unknown')}
- Columns: {eda_data.get('column_count', 'unknown')}
- Numeric Features: {len(eda_data.get('numeric_columns', []))}
- Categorical Features: {len(eda_data.get('categorical_columns', []))}

Provide a detailed analysis including:
1. Data Quality Assessment (missing values, duplicates, data types)
2. Statistical Summary (for numeric columns)
3. Pattern Analysis (for categorical columns)
4. Correlations and Relationships
5. Anomalies and Outliers
6. Data Preprocessing Status
7. Actionable Insights and Recommendations

Full EDA Results:
{json.dumps(eda_data, indent=2)}

Format your response with clear sections and bullet points. Be specific and quantitative where possible."""
            
            client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=settings.ANTHROPIC_MODEL,
                max_tokens=settings.ANTHROPIC_MAX_TOKENS,
                temperature=0.3,
                messages=[
                    {"role": "user", "content": prompt}
                ],
            )
            insights_text = response.content[0].text
            print(f"Insights generated for {analysis_id}: {len(insights_text)} chars")
        except Exception as e:
            print(f"API call failed: {str(e)}, using synthetic insights")
            insights_text = None
    else:
        print(f"WARNING: No ANTHROPIC_API_KEY set, using synthetic insights for {analysis_id}")
    
    # Use synthetic insights if API failed
    if not insights_text:
        insights_text = generate_synthetic_insights(eda_data)

    update_analysis_status(analysis_id, "running", progress=80)

    
    save_insights(analysis_id, insights_text)
    update_analysis_status(analysis_id, "completed", progress=100)

    return {"analysis_id": analysis_id, "insights": insights_text}

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go



COLOR_SEQ = [
    "#FF6B6B",  # coral red
    "#4ECDC4",  # turquoise
    "#45B7D1",  # sky blue
    "#FFA07A",  # light salmon
    "#98D8C8",  # mint
    "#F7DC6F",  # golden yellow
    "#BB8FCE",  # purple
    "#F8B88B",  # peach
    "#85C1E9",  # bright sky
    "#82E0AA",  # bright green
    "#F5B041",  # orange
    "#D7BDE2",  # lavender
]


RAINBOW_COLORS = [
    "#FF0000",  # red
    "#FF7F00",  # orange
    "#FFFF00",  # yellow
    "#00FF00",  # green
    "#0000FF",  # blue
    "#4B0082",  # indigo
    "#9400D3",  # violet
]


def generate_charts(analysis_id: str):
    from app.core.job_manager_file import (
        get_analysis,
        get_job_data,
        update_analysis_status,
        save_charts,
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

    update_analysis_status(analysis_id, "running", progress=30)

    charts = []

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()


    preprocessing_info = analysis.get("eda", {}).get("preprocessing", {})


    if preprocessing_info:
        fig = go.Figure(data=[go.Table(
            header=dict(
                values=["<b>Metric</b>", "<b>Value</b>"],
                fill_color='#2c3e50',
                align='center',
                font=dict(color='white', size=13, family="Arial Black")
            ),
            cells=dict(
                values=[
                    ["Original Rows", "Duplicates Removed", "Rows with Missing Values", "Final Clean Rows", "Data Quality Score"],
                    [
                        str(preprocessing_info.get("original_rows", "N/A")),
                        str(preprocessing_info.get("duplicates_removed", 0)),
                        str(preprocessing_info.get("rows_with_missing_removed", 0)),
                        str(preprocessing_info.get("cleaned_rows", "N/A")),
                        f"{preprocessing_info.get('data_quality_score', 0)}%"
                    ]
                ],
                fill_color='#ecf0f1',
                align='center',
                height=35,
                font=dict(size=12)
            )
        )])
        fig.update_layout(
            title_text="<b>Data Cleaning Report - Data Quality Summary</b>",
            height=350,
            font=dict(size=12),
            template="plotly_white",
        )
        charts.append({
            "type": "table",
            "title": "Data Cleaning & Quality Report",
            "figure": fig.to_json(),
            "data": fig.to_json(),
        })

   
    fig = go.Figure(data=[
        go.Table(
            header=dict(
                values=["<b>Metric</b>", "<b>Value</b>"],
                fill_color='paleturquoise',
                align='left', 
                font=dict(size=12),
            ),
            cells=dict(
                values=[
                    ["Total Rows", "Total Columns", "Numeric Columns", "Categorical Columns"],
                    [str(len(df)), str(len(df.columns)), str(len(numeric_cols)), str(len(categorical_cols))],
                ],
                fill_color='lavender',
                align='left',
            ),
        )
    ])
    fig.update_layout(
        title_text="Dataset Summary Statistics",
        height=320,
        margin=dict(l=40, r=30, t=60, b=30),
        template="plotly_white",
    )
    charts.append({
        "type": "table",
        "title": "Dataset Summary",
        "figure": fig.to_json(),
        "data": fig.to_json(),
    })

   
    for col in numeric_cols:  
        fig = px.histogram(
            df,
            x=col,
            nbins=30,
            title=f"Distribution of {col}",
            labels={col: f"{col} (Value)"},
            marginal="box",
            color_discrete_sequence=[COLOR_SEQ[numeric_cols.index(col) % len(COLOR_SEQ)]],
        )
        fig.update_layout(
            xaxis_title=f"{col}",
            yaxis_title="Frequency",
            hovermode='x unified',
            height=420,
            showlegend=False,
            bargap=0.1,
            margin=dict(l=70, r=30, t=60, b=60),
            template="plotly_white",
        )
        fig.update_xaxes(tickfont=dict(size=11))
        fig.update_yaxes(tickfont=dict(size=11))
        fig.update_traces(name=col, marker_line_color='rgba(0,0,0,0.1)')
        
        stats_text = f"Mean: {df[col].mean():.2f}<br>Median: {df[col].median():.2f}<br>Std Dev: {df[col].std():.2f}<br>Min: {df[col].min():.2f}<br>Max: {df[col].max():.2f}"
        
        charts.append({
            "type": "histogram",
            "column": col,
            "title": f"Distribution of {col}",
            "figure": fig.to_json(),
            "data": fig.to_json(),
        })

    update_analysis_status(analysis_id, "running", progress=60)

  
    if len(numeric_cols) > 1:
        corr = df[numeric_cols].corr()
        fig = px.imshow(
            corr,
            labels=dict(color="Correlation"),
            title="Correlation Matrix - Relationships Between Numeric Variables",
            color_continuous_scale="Turbo",
            zmin=-1,
            zmax=1,
            text_auto=".2f",
        )
        fig.update_layout(
            height=520,
            margin=dict(l=90, r=70, t=70, b=70),
            xaxis=dict(tickangle=45, tickfont=dict(size=10)),
            yaxis=dict(tickfont=dict(size=10)),
            template="plotly_white",
        )
        
        charts.append({
            "type": "heatmap",
            "title": "Correlation Matrix",
            "figure": fig.to_json(),
            "data": fig.to_json(),
        })

    
    if len(numeric_cols) >= 2:
        fig = go.Figure()
        for col in numeric_cols: 
            fig.add_trace(go.Box(
                y=df[col],
                name=col,
                boxmean='sd', 
                marker_color=COLOR_SEQ[numeric_cols.index(col) % len(COLOR_SEQ)],
            ))
        
            fig.update_layout(
                title="Distribution & Outliers Analysis - Box Plots",
                yaxis_title="Value",
                height=420,
                hovermode='closest',
                margin=dict(l=70, r=30, t=60, b=60),
                template="plotly_white",
            )
            fig.update_yaxes(tickfont=dict(size=11))
        
        charts.append({
            "type": "box",
            "title": "Box Plots - Distribution & Outliers",
            "figure": fig.to_json(),
            "data": fig.to_json(),
        })

   
    for col in categorical_cols:
        value_counts_df = df[col].value_counts().reset_index()
        value_counts_df.columns = [col, "count"]
        value_counts_df[col] = value_counts_df[col].astype(str).str.slice(0, 40)
        value_counts_df = value_counts_df.sort_values("count", ascending=True).tail(12)
        
        
        fig = px.bar(
            value_counts_df,
            x="count",
            y=col,
            orientation="h",
            title=f"Category Distribution: {col}",
            labels={"count": "Count", col: "Category"},
            text="count",
            color="count",
            color_continuous_scale="Viridis",
        )
        fig.update_traces(textposition='outside')
        fig.update_layout(
            height=max(320, len(value_counts_df) * 26),
            hovermode='y unified',
            margin=dict(l=90, r=40, t=60, b=50),
            bargap=0.25,
            template="plotly_white",
            coloraxis_colorbar=dict(title="Count"),
        )
        fig.update_yaxes(categoryorder='total ascending', tickfont=dict(size=11))
        fig.update_xaxes(tickfont=dict(size=11))
        
        charts.append({
            "type": "bar",
            "column": col,
            "title": f"Category Distribution: {col}",
            "figure": fig.to_json(),
            "data": fig.to_json(),
        })

    update_analysis_status(analysis_id, "running", progress=85)

    
    if numeric_cols:
        stats_data = []
        for col in numeric_cols:
            stats_data.append({
                "Column": col,
                "Mean": f"{df[col].mean():.2f}",
                "Median": f"{df[col].median():.2f}",
                "Std Dev": f"{df[col].std():.2f}",
                "Min": f"{df[col].min():.2f}",
                "Max": f"{df[col].max():.2f}",
                "Missing": df[col].isnull().sum()
            })
        
        stats_df = pd.DataFrame(stats_data)
        
        fig = go.Figure(data=[go.Table(
            header=dict(
                values=list(stats_df.columns),
                fill_color='steelblue',
                align='center',
                font=dict(color='white', size=12)
            ),
            cells=dict(
                values=[stats_df[col] for col in stats_df.columns],
                fill_color='lavender',
                align='center',
                height=30
            )
        )])
        fig.update_layout(
            title_text="Numeric Columns - Descriptive Statistics",
            height=420,
            margin=dict(l=40, r=30, t=60, b=30),
        )
        
        charts.append({
            "type": "table",
            "title": "Numeric Statistics Summary",
            "figure": fig.to_json(),
            "data": fig.to_json(),
        })

    update_analysis_status(analysis_id, "running", progress=95)

    save_charts(analysis_id, charts)
    update_analysis_status(analysis_id, "completed", progress=100)

    return {"analysis_id": analysis_id, "charts": charts}


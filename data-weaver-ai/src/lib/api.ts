// API Client for FastAPI Backend
// Configure the base URL here when your FastAPI backend is deployed

const API_BASE_URL = (import.meta.env.VITE_FASTAPI_URL || import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : 'https://data-analytics-agent-7w17.onrender.com')).replace(/\/$/, '');

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { error: errorData.detail || `HTTP error ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  // Upload file for analysis
  async uploadFile(file: File): Promise<ApiResponse<{ job_id: string; message: string }>> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${this.baseUrl}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { error: errorData.detail || `HTTP error ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  // Connect to external database
  async connectDatabase(connectionString: string, dbType: string): Promise<ApiResponse<{ tables: string[] }>> {
    return this.request('/connect-db', {
      method: 'POST',
      body: JSON.stringify({ connection_string: connectionString, db_type: dbType }),
    });
  }

  // Trigger EDA analysis
  async analyze(jobId: string, options?: { columns?: string[] }): Promise<ApiResponse<{ analysis_id: string }>> {
    return this.request('/analyze', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, ...options }),
    });
  }

  // Generate charts
  async generateCharts(analysisId: string): Promise<ApiResponse<{ charts: ChartData[] }>> {
    return this.request('/charts', {
      method: 'POST',
      body: JSON.stringify({ analysis_id: analysisId }),
    });
  }

  // Get AI insights
  async getInsights(analysisId: string): Promise<ApiResponse<{ insights: string; key_findings?: string[] }>> {
    return this.request(`/insights/${analysisId}`);
  }

  // Build dashboard
  async buildDashboard(analysisId: string): Promise<ApiResponse<DashboardConfig>> {
    return this.request('/dashboard', {
      method: 'POST',
      body: JSON.stringify({ analysis_id: analysisId }),
    });
  }

  // Export code
  async exportCode(analysisId: string, format: 'python' | 'sql'): Promise<ApiResponse<{ code: string; filename: string }>> {
    return this.request('/export', {
      method: 'POST',
      body: JSON.stringify({ analysis_id: analysisId, format }),
    });
  }

  // Poll job status
  async getStatus(jobId: string): Promise<ApiResponse<JobStatus>> {
    return this.request(`/status/job/${jobId}`);
  }
}

// Types for API responses
export interface ChartData {
  id: string;
  type: 'bar' | 'line' | 'scatter' | 'pie' | 'heatmap' | 'histogram';
  title: string;
  data: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

export interface DashboardConfig {
  id: string;
  name: string;
  charts: ChartData[];
  kpis: KPI[];
  layout: LayoutItem[];
}

export interface KPI {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
}

export interface LayoutItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface JobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  result?: Record<string, unknown>;
}

export interface EDAResult {
  summary: {
    rows: number;
    columns: number;
    memory_usage: string;
  };
  columns: ColumnInfo[];
  statistics: Record<string, ColumnStats>;
  correlations: number[][];
  missing_values: Record<string, number>;
}

export interface ColumnInfo {
  name: string;
  dtype: string;
  non_null: number;
  unique: number;
}

export interface ColumnStats {
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  median?: number;
  mode?: string | number;
}

export const api = new ApiClient(API_BASE_URL);

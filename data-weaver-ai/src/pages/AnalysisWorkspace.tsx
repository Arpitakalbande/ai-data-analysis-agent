import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { 
  BarChart3, 
  Brain, 
  Download, 
  Lightbulb, 
  Loader2,
  Table2,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Navbar } from '@/components/layout/Navbar';
import { useToast } from '@/hooks/use-toast';
import { getAnalysisStatus } from '@/api/status';
import { generateCharts, getCharts } from '@/api/charts';
import { generateInsights, getInsights } from "@/api/insights";
import { getAnalysisResults } from '@/api/analyze';
import { getDataPreview } from '@/api/preview';
import { exportPythonCode } from '@/api/export';


import Plot from 'react-plotly.js';


interface EDAResult {
  row_count: number;
  column_count: number;
  columns: string[];
  dtypes: Record<string, string>;
  preprocessing?: {
    original_rows: number;
    original_total_missing_cells?: number;
    duplicates_found?: number;
    duplicates_removed: number;
    rows_with_missing_removed: number;
    cleaned_rows: number;
    data_quality_score: number;
  };
  missing_values: Record<string, number>;
  missing_percentage: Record<string, number>;
  numeric_columns: string[];
  numeric_stats: Record<string, {
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    q25: number;
    q75: number;
    skewness: number;
    kurtosis: number;
  }>;
  categorical_columns: string[];
  categorical_stats?: Record<string, any>;
  correlation?: Record<string, Record<string, number>>;
  data_quality?: {
    completeness: number;
    uniqueness: number;
    consistency_score: number;
  };
}

interface AnalysisMeta {
  id: string;
  name: string;
  source_type: string;
  source_name: string | null;
  status: string;
}

interface ChartPayload {
  id?: string;
  type: string;
  title: string;
  column?: string;
  figure?: string;
  data?: string;
}

interface InsightPayload {
  insights: string | string[];
  key_findings?: string[];
}

interface JobStatus {
  job_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
}

interface DataPreview {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  total_rows: number;
}

// Helper to safely parse EDA results from database JSON
function parseEDAResult(data: unknown): EDAResult | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  
  // Check for new EDA structure
  if (obj.row_count && obj.column_count && obj.columns && obj.dtypes) {
    const result = data as EDAResult;
    
    // Calculate missing percentage if not provided
    if (!result.missing_percentage) {
      result.missing_percentage = {};
      for (const col of result.columns) {
        const missingCount = result.missing_values[col] || 0;
        result.missing_percentage[col] = (missingCount / result.row_count) * 100;
      }
    }
    
    return result;
  }
  return null;
}

export default function AnalysisWorkspace() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const locationState = location.state as { sourceName?: string; jobId?: string } | undefined;
  const [analysis, setAnalysis] = useState<AnalysisMeta | null>(null);
  const [edaResults, setEdaResults] = useState<EDAResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingStatus, setProcessingStatus] = useState<JobStatus | null>(null);
  const [charts, setCharts] = useState<ChartPayload[]>([]);
  const [insights, setInsights] = useState<InsightPayload | null>(null);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  const { toast } = useToast();

  const keyFindings = useMemo(() => {
    if (insights?.key_findings?.length) return insights.key_findings;
    if (Array.isArray(insights?.insights)) {
      const lines = insights.insights
        .map((line) => String(line).trim())
        .filter((line) => line);
      return lines.slice(0, 8);
    }
    if (typeof insights?.insights === 'string') {
      const lines = insights.insights
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line);
      return lines.slice(0, 8);
    }
    return [];
  }, [insights]);

  const insightText = useMemo(() => {
    if (Array.isArray(insights?.insights)) return insights.insights.join('\n');
    if (typeof insights?.insights === 'string') return insights.insights;
    return '';
  }, [insights]);

  const memoryUsageLabel = useMemo(() => {
    if (!edaResults) return '';
    // For new structure, calculate memory dynamically
    return `${edaResults.column_count} columns × ${edaResults.row_count} rows`;
  }, [edaResults]);

  useEffect(() => {
    if (!id) return;

    const meta: AnalysisMeta = {
      id,
      name: locationState?.sourceName || `Analysis ${id.slice(0, 8)}`,
      source_type: 'file',
      source_name: locationState?.sourceName || 'Uploaded file',
      status: 'pending',
    };
    setAnalysis(meta);
    setLoading(true);

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      pollTimer = setInterval(async () => {
        try {
          const status = await getAnalysisStatus(id);
          setProcessingStatus(status);
          setAnalysis((prev) => prev ? { ...prev, status: status.status } : prev);

          if (status.status === 'completed') {
            if (pollTimer) clearInterval(pollTimer);
            await fetchResults();
            await ensureCharts();
            await ensureInsights();
            await fetchPreview();
            setActiveAgents([]);
            setLoading(false);
          } else {
            setActiveAgents(['EDA Agent']);
          }
        } catch (error) {
          setActiveAgents([]);
          if (pollTimer) clearInterval(pollTimer);
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to poll analysis status',
            variant: 'destructive',
          });
          setLoading(false);
        }
      }, 1200);
    };

    // initial fetch
    (async () => {
      try {
        const status = await getAnalysisStatus(id);
        setProcessingStatus(status);
        setAnalysis((prev) => prev ? { ...prev, status: status.status } : prev);

        if (status.status === 'completed') {
          await fetchResults();
          await ensureCharts();
          await ensureInsights();
          await fetchPreview();
          setActiveAgents([]);
          setLoading(false);
        } else {
          startPolling();
          setLoading(false);
        }
      } catch (error) {
        toast({
          title: 'Error loading analysis',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
        setLoading(false);
      }
    })();

    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [id, locationState?.sourceName, toast]);

  const fetchResults = async () => {
    const result = await getAnalysisResults(id!);
    if (result?.eda) {
      const parsed = parseEDAResult(result.eda);
      if (parsed) {
        setEdaResults(parsed);
      }
    }
  };

  const normalizeInsightsPayload = (res: any): InsightPayload => ({
    insights:
      Array.isArray(res?.insights) || typeof res?.insights === 'string'
        ? res.insights
        : res?.insights
          ? String(res.insights)
          : '',
    key_findings: Array.isArray(res?.key_findings) ? res.key_findings : undefined,
  });

  const ensureCharts = async () => {
    try {
      const res = await getCharts(id!);
      if (res?.charts?.length) {
        setCharts(res.charts as ChartPayload[]);
        return;
      }
    } catch (error) {
     
    }

    setActiveAgents((prev) => Array.from(new Set([...prev, 'Visualization Agent'])));
    await generateCharts(id!);
    const res = await getCharts(id!);
    setCharts(res.charts as ChartPayload[]);
  };

  const ensureInsights = async () => {
    try {
      const res = await getInsights(id!);
      if (res?.insights !== undefined) {
        setInsights(normalizeInsightsPayload(res));
        return;
      }
    } catch (error) {
      // generate below
    }

    setActiveAgents((prev) => Array.from(new Set([...prev, 'Insight Agent'])));
    await generateInsights(id!);
    const res = await getInsights(id!);
    if (res?.insights !== undefined) {
      setInsights(normalizeInsightsPayload(res));
    }
  };

  const fetchPreview = async () => {
    try {
      const preview = await getDataPreview(id!);
      setDataPreview(preview);
    } catch (error) {
      // optional: silent if preview not available
    }
  };

  const parsePlotFigure = (figure?: string) => {
    if (!figure) return { data: [], layout: {} };
    try {
      const parsed = JSON.parse(figure);
      return {
        data: parsed.data || [],
        layout: parsed.layout || {},
      };
    } catch (error) {
      return { data: [], layout: {} };
    }
  };

  const handleExportCode = async () => {
    if (!id) return;
    
    try {
      await exportPythonCode(id);
      toast({
        title: 'Success',
        description: 'Python code downloaded successfully!',
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export code',
        variant: 'destructive',
      });
    }
  };

  const getCurrentMissingValuesTotal = (): number => {
    if (!edaResults?.missing_values) return 0;
    return Object.values(edaResults.missing_values).reduce((a, b) => a + b, 0);
  };

  const getOriginalMissingValuesTotal = (): number | null => {
    if (edaResults?.preprocessing?.original_total_missing_cells !== undefined) {
      return edaResults.preprocessing.original_total_missing_cells;
    }
    return null;
  };

  const getRemovedMissingValuesTotal = (): number | null => {
    const original = getOriginalMissingValuesTotal();
    if (original === null) return null;
    return Math.max(original - getCurrentMissingValuesTotal(), 0);
  };

  const getDuplicatesRemovedTotal = (): number => {
    if (!edaResults?.preprocessing?.duplicates_removed) return 0;
    return Math.max(edaResults.preprocessing.duplicates_removed, 0);
  };

  const getRowsRemovedForMissingTotal = (): number => {
    if (!edaResults?.preprocessing?.rows_with_missing_removed) return 0;
    return Math.max(edaResults.preprocessing.rows_with_missing_removed, 0);
  };

  const isLegacyPreprocessingResult = (): boolean => {
    const originalMissing = getOriginalMissingValuesTotal();
    if (!edaResults?.preprocessing || originalMissing === null) return false;
    return (
      originalMissing > 0 &&
      getCurrentMissingValuesTotal() > 0 &&
      getRowsRemovedForMissingTotal() === 0
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-12 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Analysis not found</h1>
        </div>
      </div>
    );
  }

  const isProcessing = analysis.status === 'pending' || analysis.status === 'processing';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">{analysis.name}</h1>
            <p className="text-muted-foreground">
              {analysis.source_type === 'file' ? 'File Analysis' : 'Database Analysis'} • {analysis.source_name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExportCode()}>
              <Download className="mr-2 h-4 w-4" />
              Export Python
            </Button>
          </div>
        </div>

        {/* Processing Status */}
        {isProcessing && processingStatus && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">{processingStatus.message || 'Processing...'}</span>
              </div>
              <Progress value={processingStatus.progress} className="h-2" />
              <div className="flex gap-2 mt-4">
                {activeAgents.map((agent) => (
                  <Badge key={agent} className="gradient-primary text-primary-foreground">
                    <Brain className="mr-1 h-3 w-3" />
                    {agent}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="charts">Visualizations</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
            <TabsTrigger value="data">Data Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {edaResults && (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary text-primary-foreground">
                          <Table2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Rows</p>
                          <p className="text-2xl font-bold">{edaResults.row_count.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-secondary text-primary-foreground">
                          <BarChart3 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Columns</p>
                          <p className="text-2xl font-bold">{edaResults.column_count}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-accent text-primary-foreground">
                          <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Missing Cells (After)</p>
                          <p className="text-2xl font-bold">{getCurrentMissingValuesTotal().toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Removed: {getRemovedMissingValuesTotal() !== null
                              ? getRemovedMissingValuesTotal()!.toLocaleString()
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <Brain className="h-5 w-5 text-foreground" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Memory</p>
                          <p className="text-2xl font-bold">{memoryUsageLabel || '—'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Preprocessing Summary */}
                {edaResults.preprocessing && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Data Preprocessing Summary</CardTitle>
                      <CardDescription>Before and after data cleaning comparison</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* BEFORE Preprocessing */}
                        <div>
                          <div className="mb-4 pb-4 border-b">
                            <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider">Before Cleaning</h3>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                              <span className="font-medium">Total Rows</span>
                              <span className="font-bold text-red-700 dark:text-red-400">{edaResults.preprocessing.original_rows.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                              <span className="font-medium">Duplicates Found</span>
                              <span className="font-bold text-orange-600">
                                {edaResults.preprocessing.duplicates_found !== undefined
                                  ? edaResults.preprocessing.duplicates_found.toLocaleString()
                                  : '—'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                              <span className="font-medium">Cells with Missing Values</span>
                              <span className="font-bold text-orange-600">
                                {getOriginalMissingValuesTotal() !== null
                                  ? getOriginalMissingValuesTotal()!.toLocaleString()
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* AFTER Preprocessing */}
                        <div>
                          <div className="mb-4 pb-4 border-b">
                            <h3 className="text-sm font-bold text-green-600 uppercase tracking-wider">After Cleaning</h3>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                              <span className="font-medium">Final Rows</span>
                              <span className="font-bold text-green-700 dark:text-green-400">{edaResults.preprocessing.cleaned_rows.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                              <span className="font-medium">Duplicates Removed</span>
                              <span className="font-bold text-orange-500">
                                {getDuplicatesRemovedTotal() > 0
                                  ? `-${getDuplicatesRemovedTotal().toLocaleString()}`
                                  : '0'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                              <span className="font-medium">Rows Removed (Any Missing Value)</span>
                              <span className="font-bold text-orange-500">
                                {getRowsRemovedForMissingTotal() > 0
                                  ? `-${getRowsRemovedForMissingTotal().toLocaleString()}`
                                  : '0'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                              <span className="font-medium">Current Missing Cells</span>
                              <span className={`font-bold ${getCurrentMissingValuesTotal() === 0 ? 'text-green-700 dark:text-green-400' : 'text-orange-600'}`}>
                                {getCurrentMissingValuesTotal().toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                              <span className="font-medium">Missing Cells Removed</span>
                              <span className="font-bold text-green-700 dark:text-green-400">
                                {getRemovedMissingValuesTotal() !== null
                                  ? getRemovedMissingValuesTotal()!.toLocaleString()
                                  : '—'}
                              </span>
                            </div>
                            {getCurrentMissingValuesTotal() === 0 && (
                              <div className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-sm text-green-700 dark:text-green-300">
                                No missing values remain after preprocessing.
                              </div>
                            )}
                            {isLegacyPreprocessingResult() && (
                              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-800 dark:text-amber-200">
                                This analysis appears to be from an older preprocessing run. Please run a new analysis to apply the latest missing-value cleanup.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quality Metrics */}
                      <div className="mt-6 pt-6 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2">Data Retention</p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <Progress 
                                value={(edaResults.preprocessing.cleaned_rows / edaResults.preprocessing.original_rows) * 100} 
                                className="h-2"
                              />
                            </div>
                            <span className="font-bold text-lg">
                              {((edaResults.preprocessing.cleaned_rows / edaResults.preprocessing.original_rows) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2">Data Quality Score</p>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <Progress 
                                value={edaResults.preprocessing.data_quality_score} 
                                className="h-2"
                              />
                            </div>
                            <span className="font-bold text-lg">
                              {edaResults.preprocessing.data_quality_score.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2">Rows Removed</p>
                          <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                            <span className="font-bold text-lg text-orange-700 dark:text-orange-400">
                              {(edaResults.preprocessing.duplicates_removed + edaResults.preprocessing.rows_with_missing_removed).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Column Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Column Information</CardTitle>
                    <CardDescription>Data types and statistics for each column</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium">Column</th>
                            <th className="text-left p-3 font-medium">Type</th>
                            <th className="text-right p-3 font-medium">Missing</th>
                            <th className="text-right p-3 font-medium">Missing %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {edaResults.columns.map((colName) => (
                            <tr key={colName} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="p-3 font-medium">{colName}</td>
                              <td className="p-3">
                                <Badge variant="outline">{edaResults.dtypes[colName]}</Badge>
                              </td>
                              <td className="p-3 text-right">{(edaResults.missing_values[colName] || 0).toLocaleString()}</td>
                              <td className="p-3 text-right">{(edaResults.missing_percentage[colName] || 0).toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="charts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
              {charts.length > 0 ? (
                charts.map((chart, idx) => {
                  const fig = parsePlotFigure(chart.figure || chart.data);
                  return (
                    <Card key={`${chart.title}-${idx}`} className="w-full overflow-hidden flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-lg">{chart.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="w-full overflow-hidden flex-1">
                        <div className="w-full h-full overflow-hidden">
                          <Plot
                            data={fig.data}
                            layout={{
                              autosize: true,
                              height: 380,
                              width: undefined,
                              margin: { l: 60, r: 30, t: 40, b: 60 },
                              paper_bgcolor: 'transparent',
                              plot_bgcolor: 'transparent',
                              xaxis: { automargin: true },
                              yaxis: { automargin: true },
                              ...fig.layout,
                            }}
                            style={{ width: '100%', height: '100%' }}
                            config={{ responsive: true, displayModeBar: true }}
                          />
                      </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Charts will appear once generation completes.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="insights">
            {insights ? (
              <div className="space-y-6 w-full">
                {/* Enhanced AI Analysis Summary Card */}
                <Card className="w-full overflow-hidden shadow-xl border-0">
                  <div className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 p-8 text-white relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl bg-white/20"></div>
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
                          <Brain className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold">AI Analysis Summary</h2>
                          <p className="text-sm text-white/70">Intelligent insights from Claude</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-8">
                    <div className="space-y-6">
                      {/* Parse and format the insight text into sections */}
                      {insightText.split('\n\n').map((section, idx) => {
                        const lines = section.split('\n').filter(l => l.trim());
                        const firstLine = lines[0];
                        
                        // Check if it looks like a header
                        const isHeader = firstLine && (
                          firstLine.includes(':') || 
                          firstLine.includes('**') ||
                          firstLine.length < 80
                        );

                        if (lines.length === 0) return null;

                        return (
                          <div key={idx} className="group">
                            {isHeader && (
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-1 h-full bg-gradient-to-b from-primary to-primary/40 rounded-full min-h-16"></div>
                                <div className="flex-1">
                                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                                    {firstLine.replace(/\*\*/g, '').replace(':', '').trim()}
                                  </h3>
                                  {lines.length > 1 && (
                                    <p className="text-sm text-foreground/70 leading-7 mt-2">
                                      {lines.slice(1).join('\n')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                            {!isHeader && (
                              <div className="bg-muted/40 border-l-4 border-primary/50 rounded-r-lg p-4 hover:bg-muted/60 transition-colors">
                                <p className="text-sm leading-7 text-foreground/80">
                                  {section}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Key Findings Grid */}
                {keyFindings.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <Lightbulb className="h-5 w-5 text-warning" />
                        Key Findings
                      </h3>
                    </div>
                    {keyFindings.map((finding, i) => (
                      <Card key={i} className="overflow-hidden border-l-4 border-l-warning hover:shadow-lg transition-all">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full gradient-primary text-xs font-bold text-white shadow-md">
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm leading-6 text-foreground/80 font-medium break-words">
                                {finding}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {isProcessing ? 'AI is analyzing your data...' : 'No insights available yet.'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="data">
            <Card>
              <CardHeader>
                <CardTitle>Data Preview</CardTitle>
                <CardDescription>First 100 rows of your dataset</CardDescription>
              </CardHeader>
              <CardContent>
                {dataPreview ? (
                  <ScrollArea className="h-[400px]">
                    <div className="min-w-full">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            {dataPreview.columns.map((col) => (
                              <th key={col} className="text-left p-2 font-medium">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dataPreview.rows.map((row, idx) => (
                            <tr key={idx} className="border-b border-border/60 hover:bg-muted/30">
                              {dataPreview.columns.map((col) => (
                                <td key={col} className="p-2 align-top">
                                  {String(row[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="text-center text-muted-foreground py-8">
                      <Table2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Data preview will load once analysis is ready.</p>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

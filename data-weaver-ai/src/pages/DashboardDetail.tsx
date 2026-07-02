import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Brain,
  LayoutDashboard,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/Navbar';
import { backend } from '@/api/backend';

interface DashboardPayload {
  analysis_id: string;
  dashboard: {
    summary?: Record<string, unknown>;
    charts?: Array<Record<string, unknown>>;
    insights?: unknown;
  };
  message?: string;
}

export default function DashboardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadDashboard = async () => {
      try {
        const response = await backend.get(`/dashboard/${id}`);
        if (isMounted) {
          setDashboard(response.data as DashboardPayload);
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
        if (isMounted) {
          setDashboard(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const summaryEntries = Object.entries(dashboard?.dashboard?.summary ?? {}) as Array<[string, unknown]>;

  const renderValue = (value: unknown) => {
    if (typeof value === 'number') return value.toLocaleString();
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join(', ');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return String(value ?? '—');
  };

  const renderInsights = (insights: unknown) => {
    if (typeof insights === 'string') {
      return <p className="text-sm leading-7 text-muted-foreground">{insights}</p>;
    }

    if (Array.isArray(insights)) {
      return (
        <ul className="space-y-2 text-sm leading-7 text-muted-foreground">
          {insights.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2">
              <Sparkles className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <span>{String(item)}</span>
            </li>
          ))}
        </ul>
      );
    }

    if (insights && typeof insights === 'object') {
      const record = insights as Record<string, unknown>;
      const message = record.insights;
      if (typeof message === 'string') {
        return <p className="text-sm leading-7 text-muted-foreground">{message}</p>;
      }
    }

    return <p className="text-sm text-muted-foreground">No insights were returned for this analysis yet.</p>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container py-12">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <LayoutDashboard className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h1 className="text-2xl font-semibold">Dashboard not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                The selected analysis does not have a dashboard yet, or it could not be loaded.
              </p>
              <Link to="/dashboard" className="mt-6 inline-flex">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to="/dashboard" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Link>
            <h1 className="text-3xl font-bold">Insights Dashboard</h1>
            <p className="text-muted-foreground">
              Analysis {dashboard.analysis_id.slice(0, 8)} • Auto-generated summary and insights
            </p>
          </div>
          <Badge className="gradient-primary text-primary-foreground">
            <Brain className="mr-2 h-4 w-4" />
            AI generated
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Key summary</CardTitle>
              <CardDescription>High-level findings from the selected analysis</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryEntries.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {summaryEntries.map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                      <p className="text-sm font-medium capitalize text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                      <p className="mt-2 text-lg font-semibold">{renderValue(value)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No summary details were available for this analysis.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI insights</CardTitle>
              <CardDescription>What the recent analysis highlights</CardDescription>
            </CardHeader>
            <CardContent>{renderInsights(dashboard.dashboard.insights)}</CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Visualizations</CardTitle>
              <CardDescription>Charts associated with this analysis</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.dashboard.charts && dashboard.dashboard.charts.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.dashboard.charts.map((chart, index) => (
                    <div key={`${chart.title ?? 'chart'}-${index}`} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{String(chart.title ?? `Chart ${index + 1}`)}</p>
                        <p className="text-sm text-muted-foreground">{String(chart.type ?? 'Visualization')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Charts will appear here once they are generated for this analysis.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next step</CardTitle>
              <CardDescription>Continue working from the analysis workspace</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-7 text-muted-foreground">
                This page now opens the dashboard view for your recent analysis so you can review the AI-generated summary and insights without hitting a 404.
              </p>
              <Link to={`/analysis/${dashboard.analysis_id}`}>
                <Button className="w-full">
                  Open full analysis workspace
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

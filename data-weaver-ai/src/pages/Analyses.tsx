import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/Navbar';
import { backend } from '@/api/backend';
import { getUserId } from '@/lib/sessionUtils';
import { useAuth } from '@/hooks/useAuth';

interface Analysis {
  id: string;
  name: string;
  source_name: string | null;
  status: string;
  created_at: string;
}

export default function AnalysesPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchAnalyses();
  }, [user?.id, user?.email]);

  const fetchAnalyses = async () => {
    try {
      const userId = getUserId(user?.id, user?.email ?? null);
      const res = await backend.get('/status/analyses?limit=100', {
        params: { user_id: userId }
      });
      if (res.data?.analyses) {
        setAnalyses(res.data.analyses);
      }
    } catch (error) {
      console.error('Error fetching analyses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success/10 text-success';
      case 'processing': return 'bg-warning/10 text-warning';
      case 'failed': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8">
        <div className="mb-8">
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">All Analyses</h1>
          <p className="text-muted-foreground mt-2">
            View all your data analysis projects
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : analyses.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No analyses yet</p>
                <Link to="/upload">
                  <Button>Create Your First Analysis</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {analyses.map((analysis) => (
                  <Link key={analysis.id} to={`/analysis/${analysis.id}`}>
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                          <FileSpreadsheet className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{analysis.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            {formatDate(analysis.created_at)}
                          </div>
                        </div>
                      </div>
                      <Badge className={getStatusColor(analysis.status || 'pending')}>
                        {analysis.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

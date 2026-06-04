import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CheckCircle2, Clock3, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { backend } from '@/api/backend';
import { getUserId } from '@/lib/UserSession';
import { useAuth } from '@/hooks/useAuth';

interface Analysis {
  id: string;
  name: string;
  source_name: string | null;
  source_type: string;
  status: string;
  created_at: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const userId = getUserId(user?.id, user?.email ?? null);
        const res = await backend.get('/status/analyses?limit=200', {
          params: { user_id: userId },
        });

        const list = Array.isArray(res.data?.analyses) ? res.data.analyses : [];
        setAnalyses(list);
      } catch (error) {
        console.error('Error loading profile analyses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user?.id, user?.email]);

  const sortedAnalyses = useMemo(() => {
    return [...analyses].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [analyses]);

  const stats = useMemo(() => {
    const total = analyses.length;
    const completed = analyses.filter((a) => a.status === 'completed').length;
    const inProgress = analyses.filter((a) => a.status === 'processing' || a.status === 'pending').length;

    return { total, completed, inProgress };
  }, [analyses]);

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success/10 text-success';
      case 'processing':
        return 'bg-warning/10 text-warning';
      case 'failed':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatDate = (value: string) => {
    return new Date(value).toLocaleString('en-US', {
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

      <main className="container py-8 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground mt-1">
              {user?.email || 'User account'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Viewing data for: {user?.email || 'anonymous user'}
            </p>
          </div>
          <Link to="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Analyses</p>
                <p className="text-3xl font-bold mt-1">{stats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center">
                <BarChart3 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold mt-1">{stats.completed}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-success/20 text-success flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-3xl font-bold mt-1">{stats.inProgress}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-warning/20 text-warning flex items-center justify-center">
                <Clock3 className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Analyses</CardTitle>
            <CardDescription>
              Latest analysis activity for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : sortedAnalyses.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No analyses found</p>
                <Link to="/upload">
                  <Button>Create First Analysis</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedAnalyses.slice(0, 20).map((analysis) => (
                  <Link key={analysis.id} to={`/analysis/${analysis.id}`}>
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{analysis.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {analysis.source_name || analysis.source_type} • {formatDate(analysis.created_at)}
                        </p>
                      </div>
                      <Badge className={getStatusClass(analysis.status || 'pending')}>
                        {analysis.status || 'pending'}
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

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart3, 
  FileSpreadsheet, 
  Plus, 
  TrendingUp, 
  Clock,
  LayoutDashboard,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { backend } from '@/api/backend';
import { getUserId } from '@/lib/sessionUtils';

interface Analysis {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  source_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user?.id, user?.email]);

  const fetchData = async () => {
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
    });
  };

  const stats = [
    {
      label: 'Total Analyses',
      value: analyses.length,
      icon: BarChart3,
      gradient: 'from-primary to-secondary',
    },
    {
      label: 'Dashboards',
      value: dashboards.length,
      icon: LayoutDashboard,
      gradient: 'from-secondary to-accent',
    },
    {
      label: 'Completed',
      value: analyses.filter(a => a.status === 'completed').length,
      icon: TrendingUp,
      gradient: 'from-success to-primary',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back! Here's an overview of your analyses.
            </p>
          </div>
          <Link to="/upload">
            <Button className="gradient-primary">
              <Plus className="mr-2 h-4 w-4" />
              New Analysis
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${stat.gradient} text-primary-foreground`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Analyses */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Analyses</CardTitle>
                <CardDescription>Your latest data analysis projects</CardDescription>
              </div>
              <Link to="/analyses">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : analyses.length === 0 ? (
                <div className="text-center py-8">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No analyses yet</p>
                  <Link to="/upload">
                    <Button variant="outline">Upload Your First File</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {analyses.slice(0, 5).map((analysis) => (
                    <Link key={analysis.id} to={`/analysis/${analysis.id}`}>
                      <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <FileSpreadsheet className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{analysis.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
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

          {/* Recent Dashboards */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Dashboards</CardTitle>
                <CardDescription>Your saved dashboard configurations</CardDescription>
              </div>
              <Link to="/dashboards">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : dashboards.length === 0 ? (
                <div className="text-center py-8">
                  <LayoutDashboard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No dashboards yet</p>
                  <p className="text-sm text-muted-foreground">
                    Complete an analysis to generate dashboards
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboards.map((dashboard) => (
                    <Link key={dashboard.id} to={`/dashboard/${dashboard.id}`}>
                      <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-secondary text-primary-foreground">
                            <LayoutDashboard className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{dashboard.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDate(dashboard.created_at)}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link to="/upload">
                <div className="p-6 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all text-center group">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl gradient-primary text-primary-foreground mb-4 group-hover:shadow-glow transition-shadow">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <p className="font-medium">Upload File</p>
                  <p className="text-sm text-muted-foreground">CSV, Excel</p>
                </div>
              </Link>
              <Link to="/upload?tab=database">
                <div className="p-6 rounded-xl border border-border/50 hover:border-secondary/50 hover:bg-muted/30 transition-all text-center group">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl gradient-secondary text-primary-foreground mb-4 group-hover:shadow-lg transition-shadow">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <p className="font-medium">Connect Database</p>
                  <p className="text-sm text-muted-foreground">SQL, PostgreSQL</p>
                </div>
              </Link>
              <div className="p-6 rounded-xl border border-border/50 hover:border-accent/50 hover:bg-muted/30 transition-all text-center group cursor-pointer">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl gradient-accent text-primary-foreground mb-4 group-hover:shadow-lg transition-shadow">
                  <LayoutDashboard className="h-6 w-6" />
                </div>
                <p className="font-medium">View Templates</p>
                <p className="text-sm text-muted-foreground">Pre-built dashboards</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

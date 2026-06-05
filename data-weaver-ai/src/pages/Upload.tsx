import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Database, FileSpreadsheet, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Navbar } from '@/components/layout/Navbar';
import { uploadFile } from '@/api/upload';
import { startAnalysis } from '@/api/analyze';
import { getJobStatus } from '@/api/status';
import { backend } from '@/api/backend';
import { getUserId } from '@/lib/sessionUtils';
import { useAuth } from '@/hooks/useAuth';

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dbType, setDbType] = useState('postgresql');
  const [connectionString, setConnectionString] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file)) {
      setUploadedFile(file);
    } else {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV or Excel file.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isValidFile(file)) {
      setUploadedFile(file);
    } else {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV or Excel file.',
        variant: 'destructive',
      });
    }
  };

  const isValidFile = (file: File) => {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    return validTypes.includes(file.type) || file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
  };

  const handleUpload = async () => {
    if (!uploadedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 5, 90));
    }, 300);

    try {
      // Step 1: upload file to backend
      const uploadRes = await uploadFile(uploadedFile);
      const jobId = uploadRes.job_id;

      // Step 2: poll job status until file is parsed
      let attempts = 0;
      let jobDone = false;
      while (attempts < 120 && !jobDone) { // up to ~60s
        const status = await getJobStatus(jobId);
        setUploadProgress(status.progress);

        if (status.status === 'completed') {
          jobDone = true;
          break;
        }
        if (status.status === 'failed') {
          throw new Error('File processing failed');
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        attempts += 1;
      }

      if (!jobDone) {
        throw new Error('File processing timed out');
      }

      // Step 3: start analysis (EDA)
      const scopedUserId = getUserId(user?.id, user?.email ?? null);
      const analysisRes = await startAnalysis(jobId, scopedUserId);
      clearInterval(progressInterval);
      setUploadProgress(100);

      toast({
        title: 'File uploaded successfully!',
        description: 'Starting analysis...',
      });

      // Step 4: navigate to analysis workspace with context
      navigate(`/analysis/${analysisRes.analysis_id}`, {
        state: {
          sourceName: uploadedFile.name,
          jobId,
        },
      });
    } catch (error) {
      clearInterval(progressInterval);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDatabaseConnect = async () => {
    if (!connectionString) return;

    setIsConnecting(true);

    try {
      const res = await backend.post('/connect-db', {
        connection_string: connectionString,
        db_type: dbType,
      });

      const tablesList = (res.data?.tables as string[]) || [];
      setTables(tablesList);
      toast({
        title: 'Connected successfully!',
        description: tablesList.length ? `Found ${tablesList.length} tables` : (res.data?.message || 'Connection validated.'),
      });
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-2">Upload Your Data</h1>
            <p className="text-muted-foreground">
              Upload a file or connect to a database to start your analysis
            </p>
          </div>

          <Tabs defaultValue="file" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                File Upload
              </TabsTrigger>
              <TabsTrigger value="database" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Database
              </TabsTrigger>
            </TabsList>

            <TabsContent value="file">
              <Card>
                <CardHeader>
                  <CardTitle>Upload CSV or Excel File</CardTitle>
                  <CardDescription>
                    Drag and drop your file or click to browse. Supports .csv, .xlsx, and .xls formats.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Drop zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                      relative rounded-xl border-2 border-dashed p-12 transition-all duration-200 text-center
                      ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                      ${uploadedFile ? 'border-success bg-success/5' : ''}
                    `}
                  >
                    {uploadedFile ? (
                      <div className="space-y-4">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                          <Check className="h-8 w-8 text-success" />
                        </div>
                        <div>
                          <p className="font-medium">{uploadedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button variant="outline" onClick={() => setUploadedFile(null)}>
                          Choose Different File
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="mt-4">
                          <p className="font-medium">
                            {isDragging ? 'Drop your file here' : 'Drag and drop your file here'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">or</p>
                        </div>
                        <Button variant="outline" className="mt-4" asChild>
                          <label>
                            Browse Files
                            <input
                              type="file"
                              className="sr-only"
                              accept=".csv,.xlsx,.xls"
                              onChange={handleFileSelect}
                            />
                          </label>
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Progress bar */}
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full gradient-primary transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full gradient-primary"
                    size="lg"
                    disabled={!uploadedFile || isUploading}
                    onClick={handleUpload}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Start Analysis'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="database">
              <Card>
                <CardHeader>
                  <CardTitle>Connect to Database</CardTitle>
                  <CardDescription>
                    Connect to your MySQL, PostgreSQL, or other databases.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Database Type</Label>
                      <Select value={dbType} onValueChange={setDbType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="postgresql">PostgreSQL</SelectItem>
                          <SelectItem value="mysql">MySQL</SelectItem>
                          <SelectItem value="sqlite">SQLite</SelectItem>
                          <SelectItem value="mssql">Microsoft SQL Server</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Connection String</Label>
                      <Input
                        placeholder={`${dbType}://user:password@host:port/database`}
                        value={connectionString}
                        onChange={(e) => setConnectionString(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Your connection string is sent securely to the analysis backend.
                      </p>
                    </div>
                  </div>

                  <Button
                    className="w-full gradient-primary"
                    size="lg"
                    disabled={!connectionString || isConnecting}
                    onClick={handleDatabaseConnect}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect & Analyze'
                    )}
                  </Button>

                  {/* Tables list and selection */}
                  {tables.length > 0 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Select Table</Label>
                        <Select value={selectedTable} onValueChange={setSelectedTable}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {tables.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        variant="outline"
                        disabled={!selectedTable}
                        onClick={async () => {
                          try {
                            const res = await backend.post('/connect-db/load-table', {
                              connection_string: connectionString,
                              db_type: dbType,
                              table: selectedTable,
                              limit: 10000,
                            });
                            const jobId = res.data?.job_id;
                            if (!jobId) throw new Error('No job_id returned');
                            const scopedUserId = getUserId(user?.id, user?.email ?? null);
                            const analyzeRes = await backend.post('/analyze', {
                              job_id: jobId,
                              user_id: scopedUserId,
                            });
                            const analysisId = analyzeRes.data?.analysis_id;
                            if (!analysisId) throw new Error('No analysis_id returned');
                            navigate(`/analysis/${analysisId}`);
                          } catch (error) {
                            toast({
                              title: 'Failed to analyze table',
                              description: error instanceof Error ? error.message : 'An error occurred',
                              variant: 'destructive',
                            });
                          }
                        }}
                      >
                        Analyze Selected Table
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

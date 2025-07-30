import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SQLQueryInput } from "@/components/SQLQueryInput";
import { ErrorMessage } from "@/components/ErrorMessage";
import {
  parseSQL,
  getTableLockAnalysis,
  TableLockInfo,
} from "@/lib/sqlParser";
import {
  compareQueries,
  getComparisonSummary,
  QueryComparisonResult,
  QueryAnalysisInput,
} from "@/lib/queryComparison";
import { GitCompare, Users, Shield, AlertTriangle } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const QueryComparison = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query1, setQuery1] = useState("");
  const [query2, setQuery2] = useState("");
  const [query1Analysis, setQuery1Analysis] = useState<QueryAnalysisInput | null>(null);
  const [query2Analysis, setQuery2Analysis] = useState<QueryAnalysisInput | null>(null);
  const [comparisonResult, setComparisonResult] = useState<QueryComparisonResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeQueries = useCallback(async () => {
    if (!query1.trim() || !query2.trim()) {
      return;
    }

    setIsAnalyzing(true);
    setComparisonResult(null);

    try {
      // Small delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Parse both queries in parallel
      const [parsed1, parsed2] = await Promise.all([
        parseSQL(query1),
        parseSQL(query2),
      ]);

      // Analyze locks for both queries
      let analysis1: QueryAnalysisInput;
      let analysis2: QueryAnalysisInput;

      if (parsed1.isValid && parsed1.tables.length > 0) {
        const lockAnalysis1 = getTableLockAnalysis(parsed1.tables, parsed1.command);
        analysis1 = {
          query: query1,
          tables: lockAnalysis1,
          isValid: true,
        };
      } else {
        analysis1 = {
          query: query1,
          tables: [],
          error: parsed1.error || "No tables found in query",
          isValid: false,
        };
      }

      if (parsed2.isValid && parsed2.tables.length > 0) {
        const lockAnalysis2 = getTableLockAnalysis(parsed2.tables, parsed2.command);
        analysis2 = {
          query: query2,
          tables: lockAnalysis2,
          isValid: true,
        };
      } else {
        analysis2 = {
          query: query2,
          tables: [],
          error: parsed2.error || "No tables found in query",
          isValid: false,
        };
      }

      setQuery1Analysis(analysis1);
      setQuery2Analysis(analysis2);

      // Compare the queries
      const comparison = compareQueries(analysis1, analysis2);
      setComparisonResult(comparison);

      setIsAnalyzing(false);
    } catch (error) {
      console.error("Analysis failed:", error);
      setIsAnalyzing(false);
    }
  }, [query1, query2]);

  // Update URL when queries change
  const updateURL = useCallback((newQuery1: string, newQuery2: string) => {
    const params = new URLSearchParams();
    if (newQuery1.trim()) {
      params.set('q1', encodeURIComponent(newQuery1));
    }
    if (newQuery2.trim()) {
      params.set('q2', encodeURIComponent(newQuery2));
    }
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  const handleQuery1Change = useCallback((value: string) => {
    setQuery1(value);
    updateURL(value, query2);
  }, [query2, updateURL]);

  const handleQuery2Change = useCallback((value: string) => {
    setQuery2(value);
    updateURL(query1, value);
  }, [query1, updateURL]);

  // Initialize state from URL on mount
  useEffect(() => {
    const urlQuery1 = searchParams.get('q1');
    const urlQuery2 = searchParams.get('q2');
    
    if (urlQuery1) {
      setQuery1(decodeURIComponent(urlQuery1));
    }
    if (urlQuery2) {
      setQuery2(decodeURIComponent(urlQuery2));
    }

    // Auto-analyze if both queries are present in URL
    if (urlQuery1 && urlQuery2) {
      const decodedQuery1 = decodeURIComponent(urlQuery1);
      const decodedQuery2 = decodeURIComponent(urlQuery2);
      if (decodedQuery1.trim() && decodedQuery2.trim()) {
        // Small delay to ensure state is set
        setTimeout(() => {
          analyzeQueries();
        }, 100);
      }
    }
  }, [searchParams, analyzeQueries]);

  // Keyboard shortcut listener for Ctrl+Enter / Cmd+Enter
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (query1.trim() && query2.trim() && !isAnalyzing) {
          analyzeQueries();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [query1, query2, isAnalyzing, analyzeQueries]);

  const handleExamplePair = (example1: string, example2: string) => {
    setQuery1(example1);
    setQuery2(example2);
    updateURL(example1, example2);
  };

  const exampleQueryPairs = [
    {
      label: "Compatible Queries",
      description: "Different tables - no conflicts",
      query1: "SELECT * FROM users;",
      query2: "SELECT * FROM products;",
    },
    {
      label: "Conflicting Queries",
      description: "Same table with conflicting locks",
      query1: "UPDATE users SET active = true WHERE id = 1;",
      query2: "CREATE INDEX CONCURRENTLY idx_users_email ON users(email);",
    },
    {
      label: "Compatible on Same Table",
      description: "Same table with compatible locks",
      query1: "SELECT * FROM orders WHERE status = 'pending';",
      query2: "SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '1 day';",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-3 mb-4">
            <img
              src="/android-chrome-512x512.png"
              alt="PostgreSQL Lock Analyzer Logo"
              className="h-12 w-12 object-contain"
            />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Query Comparison
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Compare two PostgreSQL queries to determine if they can run concurrently or if they will conflict due to incompatible table locks.
          </p>
        </div>

        {/* Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-primary" />
                Query 1
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SQLQueryInput
                value={query1}
                onChange={handleQuery1Change}
                placeholder="Enter your first PostgreSQL query here..."
              />
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-accent" />
                Query 2
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SQLQueryInput
                value={query2}
                onChange={handleQuery2Change}
                placeholder="Enter your second PostgreSQL query here..."
              />
            </CardContent>
          </Card>
        </div>

        {/* Analyze Button */}
        <div className="flex justify-center mb-8">
          <Button
            onClick={analyzeQueries}
            disabled={!query1.trim() || !query2.trim() || isAnalyzing}
            className="bg-gradient-to-r from-primary to-accent hover:shadow-glow hover:scale-[1.02] hover:brightness-110 transition-all duration-300"
            size="lg"
          >
            <GitCompare className="h-4 w-4 mr-2" />
            {isAnalyzing ? "Analyzing..." : "Compare Queries"}
          </Button>
        </div>

        {/* Error Messages */}
        {query1Analysis && !query1Analysis.isValid && (
          <div className="mb-6">
            <ErrorMessage message={`Query 1: ${query1Analysis.error}`} />
          </div>
        )}
        {query2Analysis && !query2Analysis.isValid && (
          <div className="mb-6">
            <ErrorMessage message={`Query 2: ${query2Analysis.error}`} />
          </div>
        )}

        {/* Comparison Results */}
        {comparisonResult && query1Analysis && query2Analysis && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Main Results */}
            <div className="lg:col-span-2 space-y-6">
              {/* Status Banner */}
              <Card className={`shadow-elegant border-2 ${
                comparisonResult.isCompatible 
                  ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' 
                  : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
              }`}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    {comparisonResult.isCompatible ? (
                      <Shield className="h-8 w-8 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-8 w-8 text-red-600" />
                    )}
                    <div>
                      <h2 className={`text-2xl font-bold ${
                        comparisonResult.isCompatible ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                      }`}>
                        {comparisonResult.isCompatible ? 'Queries are Compatible' : 'Queries will Conflict'}
                      </h2>
                      <p className="text-muted-foreground">
                        {getComparisonSummary(comparisonResult)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Conflict Details */}
              {comparisonResult.conflictingTables.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-600 dark:text-red-400">
                      Conflicting Tables
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {comparisonResult.conflictingTables.map((conflict, index) => (
                        <div key={index} className="p-3 border rounded-lg bg-red-50 dark:bg-red-950/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{conflict.table}</span>
                            <Badge variant="destructive">Conflict</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Query 1: <Badge variant="outline">{conflict.query1Lock}</Badge>
                            {" vs "}
                            Query 2: <Badge variant="outline">{conflict.query2Lock}</Badge>
                          </div>
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            {conflict.conflictReason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Compatible Tables */}
              {comparisonResult.compatibleTables.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-green-600 dark:text-green-400">
                      Compatible Tables
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {comparisonResult.compatibleTables.map((compatible, index) => (
                        <div key={index} className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{compatible.table}</span>
                            <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                              Compatible
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Query 1: <Badge variant="outline">{compatible.query1Lock}</Badge>
                            {" + "}
                            Query 2: <Badge variant="outline">{compatible.query2Lock}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar with Examples */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5" />
                    Example Query Pairs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {exampleQueryPairs.map((example, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="w-full justify-start text-left h-auto p-3 group"
                      onClick={() => handleExamplePair(example.query1, example.query2)}
                    >
                      <div className="w-full">
                        <div className="font-medium text-sm">{example.label}</div>
                        <div className="text-xs text-muted-foreground group-hover:text-accent-foreground mt-1">
                          {example.description}
                        </div>
                      </div>
                    </Button>
                  ))}
                </CardContent>
              </Card>

              {/* Individual Query Analysis */}
              {query1Analysis.isValid && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Query 1 Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {query1Analysis.tables.map((table, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span>{table.table}</span>
                          <Badge variant="secondary">{table.lockMode}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {query2Analysis.isValid && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Query 2 Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {query2Analysis.tables.map((table, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span>{table.table}</span>
                          <Badge variant="secondary">{table.lockMode}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueryComparison;
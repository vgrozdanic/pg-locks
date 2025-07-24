import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SQLQueryInput } from "@/components/SQLQueryInput";
import {
  LockAnalysisResults,
  LockAnalysis,
} from "@/components/LockAnalysisResults";
import { ErrorMessage } from "@/components/ErrorMessage";
import {
  parseSQL,
  getLockAnalysis,
  getTableLockAnalysis,
} from "@/lib/sqlParser";
import { getQueryFromUrl, updateUrlWithQuery } from "@/lib/urlUtils";
import { Lock, Zap } from "lucide-react";

const Index = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LockAnalysis[]>([]);
  const [error, setError] = useState<string>("");
  const [queryType, setQueryType] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load query from URL on component mount
  useEffect(() => {
    const urlQuery = getQueryFromUrl();
    if (urlQuery) {
      setQuery(urlQuery);
      // Auto-analyze if query exists in URL
      setTimeout(() => {
        analyzeQueryWithValue(urlQuery);
      }, 100);
    }
  }, []);

  // Update URL when query changes (but skip initial load and empty queries)
  useEffect(() => {
    updateUrlWithQuery(query);
  }, [query]);

  const analyzeQueryWithValue = async (queryToAnalyze: string) => {
    setIsAnalyzing(true);
    setError("");
    setResults([]);

    try {
      // Small delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 200));

      const parsed = await parseSQL(queryToAnalyze);

      if (!parsed.isValid) {
        setError(parsed.error || "Failed to parse SQL query");
        setIsAnalyzing(false);
        return;
      }

      if (parsed.tables.length === 0) {
        setError("No tables found in the query");
        setIsAnalyzing(false);
        return;
      }

      // Use the new getTableLockAnalysis function for individual table lock modes
      const analysisResults: LockAnalysis[] = getTableLockAnalysis(
        parsed.tables,
        parsed.command
      );

      if (analysisResults.length === 0) {
        setError(`Lock analysis not available for command: ${parsed.command}`);
        setIsAnalyzing(false);
        return;
      }

      setResults(analysisResults);
      setQueryType(parsed.command);
      setIsAnalyzing(false);
    } catch (error) {
      setError(
        `Analysis failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setIsAnalyzing(false);
    }
  };

  const analyzeQuery = async () => {
    await analyzeQueryWithValue(query);
  };

  const handleExampleQuery = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  const exampleQueries = [
    {
      label: "SELECT Query",
      query: "SELECT * FROM users;",
    },
    {
      label: "UPDATE Query",
      query:
        "UPDATE employees SET salary = salary * 1.10 WHERE department = 'Sales';",
    },
    {
      label: "SELECT with JOIN",
      query:
        "SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id;",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-3 mb-4">
            <img
              src="/android-chrome-512x512.png"
              alt="PostgreSQL Lock Analyzer Logo"
              className="h-12 w-12 object-contain"
            />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              PostgreSQL Lock Analyzer
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Analyze your PostgreSQL queries to understand what locks on each
            table will be acquired. Enter an SQL query below and get detailed
            lock analysis.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  SQL Query Input
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SQLQueryInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Enter your PostgreSQL query here... (e.g., SELECT * FROM users WHERE active = true;)"
                />
                <Button
                  onClick={analyzeQuery}
                  disabled={!query.trim() || isAnalyzing}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-glow hover:scale-[1.02] hover:brightness-110 transition-all duration-300"
                  size="lg"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {isAnalyzing ? "Analyzing..." : "Analyze Locks"}
                </Button>
              </CardContent>
            </Card>

            {/* Error Message */}
            {error && <ErrorMessage message={error} />}

            {/* Results */}
            {results.length > 0 && (
              <LockAnalysisResults results={results} queryType={queryType} />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Example Queries */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Example Queries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {exampleQueries.map((example, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full justify-start text-left h-auto p-3 group"
                    onClick={() => handleExampleQuery(example.query)}
                  >
                    <div className="w-full">
                      <div className="font-medium text-sm">{example.label}</div>
                      <div className="text-xs text-muted-foreground group-hover:text-accent-foreground mt-1 break-words whitespace-normal">
                        {example.query.length > 60
                          ? example.query.substring(0, 60) + "..."
                          : example.query}
                      </div>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

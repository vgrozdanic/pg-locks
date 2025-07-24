import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SQLQueryInput } from "@/components/SQLQueryInput";
import { LockAnalysisResults, LockAnalysis } from "@/components/LockAnalysisResults";
import { ErrorMessage } from "@/components/ErrorMessage";
import { parseSQL, getLockAnalysis } from "@/lib/sqlParser";
import { Database, Lock, Zap } from "lucide-react";

const Index = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LockAnalysis[]>([]);
  const [error, setError] = useState<string>("");
  const [queryType, setQueryType] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeQuery = () => {
    setIsAnalyzing(true);
    setError("");
    setResults([]);
    
    // Small delay for better UX
    setTimeout(() => {
      const parsed = parseSQL(query);
      
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

      const lockInfo = getLockAnalysis(parsed.command);
      if (!lockInfo) {
        setError(`Lock analysis not available for command: ${parsed.command}`);
        setIsAnalyzing(false);
        return;
      }

      const analysisResults: LockAnalysis[] = parsed.tables.map(table => ({
        table,
        lockMode: lockInfo.lockMode,
        description: lockInfo.description,
        conflicts: lockInfo.conflicts
      }));

      setResults(analysisResults);
      setQueryType(parsed.command);
      setIsAnalyzing(false);
    }, 500);
  };

  const handleExampleQuery = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  const exampleQueries = [
    {
      label: "SELECT Query",
      query: "SELECT * FROM employees JOIN departments ON employees.dept_id = departments.id WHERE salary > 50000;"
    },
    {
      label: "UPDATE Query", 
      query: "UPDATE employees SET salary = salary * 1.10 WHERE department = 'Sales';"
    },
    {
      label: "CREATE INDEX",
      query: "CREATE INDEX CONCURRENTLY idx_employee_salary ON employees(salary);"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white shadow-glow">
              <Database className="h-8 w-8" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              PostgreSQL Lock Analyzer
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Analyze your PostgreSQL queries to understand what table-level locks will be acquired. 
            Enter a SQL query below and get detailed lock analysis.
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
                  className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-glow transition-all duration-300"
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
                    className="w-full justify-start text-left h-auto p-3"
                    onClick={() => handleExampleQuery(example.query)}
                  >
                    <div>
                      <div className="font-medium text-sm">{example.label}</div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {example.query.substring(0, 50)}...
                      </div>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Lock Types Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Common Lock Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <strong className="text-primary">ACCESS SHARE:</strong> SELECT queries
                </div>
                <div>
                  <strong className="text-primary">ROW EXCLUSIVE:</strong> INSERT, UPDATE, DELETE
                </div>
                <div>
                  <strong className="text-accent">SHARE:</strong> CREATE INDEX
                </div>
                <div>
                  <strong className="text-destructive">ACCESS EXCLUSIVE:</strong> DROP, TRUNCATE, most ALTER TABLE
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

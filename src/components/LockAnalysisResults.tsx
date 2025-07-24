import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Database, Shield, AlertTriangle } from "lucide-react";

export interface LockAnalysis {
  table: string;
  lockMode: string;
  description: string;
  conflicts: string[];
}

interface LockAnalysisResultsProps {
  results: LockAnalysis[];
  queryType?: string;
}

export const LockAnalysisResults = ({
  results,
  queryType,
}: LockAnalysisResultsProps) => {
  if (results.length === 0) {
    return null;
  }

  // Helper function to get lock description by lock mode
  const getLockDescription = (lockMode: string) => {
    // Find a result with this lock mode to get its description
    const lockResult = results.find((r) => r.lockMode === lockMode);
    if (lockResult) {
      return lockResult.description;
    }

    // Fallback descriptions for conflict locks that might not be in results
    switch (lockMode) {
      case "ACCESS SHARE":
        return "Table-level lock. Acquired by SELECT statements and other read-only operations. Only conflicts with ACCESS EXCLUSIVE lock.";
      case "ROW SHARE":
        return "Table-level lock. Acquired by SELECT FOR UPDATE/SHARE/etc. Conflicts with EXCLUSIVE and ACCESS EXCLUSIVE locks.";
      case "ROW EXCLUSIVE":
        return "Table-level lock. Acquired by UPDATE, DELETE, INSERT, and MERGE statements. Conflicts with SHARE and stronger locks.";
      case "SHARE UPDATE EXCLUSIVE":
        return "Table-level lock. Protects against concurrent schema changes and VACUUM runs. Acquired by VACUUM (without FULL), ANALYZE, CREATE INDEX CONCURRENTLY.";
      case "SHARE":
        return "Table-level lock. Protects against concurrent data changes. Acquired by CREATE INDEX (without CONCURRENTLY).";
      case "SHARE ROW EXCLUSIVE":
        return "Table-level lock. Protects against concurrent data changes and is self-exclusive. Acquired by CREATE TRIGGER and some ALTER TABLE forms.";
      case "EXCLUSIVE":
        return "Table-level lock. Allows only concurrent ACCESS SHARE locks (reads only). Acquired by REFRESH MATERIALIZED VIEW CONCURRENTLY.";
      case "ACCESS EXCLUSIVE":
        return "Table-level lock. Guarantees holder is the only transaction accessing the table. Acquired by DROP TABLE, TRUNCATE, REINDEX, VACUUM FULL.";
      default:
        return "PostgreSQL table-level lock mode.";
    }
  };

  const getLockBadgeVariant = (lockMode: string) => {
    switch (lockMode) {
      case "ACCESS SHARE":
        return "secondary";
      case "ROW SHARE":
        return "default";
      case "ROW EXCLUSIVE":
        return "default";
      case "SHARE UPDATE EXCLUSIVE":
        return "outline";
      case "SHARE":
        return "secondary";
      case "SHARE ROW EXCLUSIVE":
        return "destructive";
      case "EXCLUSIVE":
        return "destructive";
      case "ACCESS EXCLUSIVE":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">
            Lock Analysis Results
          </h2>
        </div>

        {queryType && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Query Type:</span>
                <Badge variant="default" className="bg-primary">
                  {queryType}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {results.map((result, index) => (
            <Card key={index} className="shadow-elegant">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Database className="h-5 w-5 text-database-blue" />
                    Table:{" "}
                    <code className="font-mono text-primary">
                      {result.table}
                    </code>
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={getLockBadgeVariant(result.lockMode)}
                        className="font-mono text-xs cursor-help"
                      >
                        {result.lockMode}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{result.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">
                    Description
                  </h4>
                  <p className="text-sm">{result.description}</p>
                </div>

                {result.conflicts.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      Conflicts With
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {result.conflicts.map((conflict, i) => (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="text-xs cursor-help"
                            >
                              {conflict}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              {getLockDescription(conflict)}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};


import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileQuestion, Database, AlertTriangle } from "lucide-react";
import { useState } from "react";

// Simple tooltip component that definitely works
const SimpleTooltip = ({
  children,
  content,
}: {
  children: React.ReactNode;
  content: string;
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-[9999] w-80">
          <div className="bg-gray-900 text-white text-sm rounded py-2 px-3 shadow-lg leading-relaxed">
            {content}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
};

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
        return "Conflicts with ACCESS EXCLUSIVE lock mode only. Can be held by multiple transactions simultaneously. Acquired by SELECT and other read-only operations. Held until end of transaction. This is the least restrictive table-level lock.";
      case "ROW SHARE":
        return "Conflicts with EXCLUSIVE and ACCESS EXCLUSIVE lock modes. Acquired by SELECT with FOR UPDATE, FOR NO KEY UPDATE, FOR SHARE, or FOR KEY SHARE options. Also acquires row-level locks on selected rows, preventing them from being modified or deleted by other transactions until the current transaction ends. Held until end of transaction.";
      case "ROW EXCLUSIVE":
        return "Conflicts with SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE lock modes. Acquired by UPDATE, DELETE, INSERT, and MERGE commands on the target table (other referenced tables get ACCESS SHARE locks). Held until end of transaction.";
      case "SHARE UPDATE EXCLUSIVE":
        return "Conflicts with SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE lock modes. Self-conflicting - only one transaction can hold this lock at a time. Protects against concurrent schema changes and VACUUM runs. Acquired by VACUUM (without FULL), ANALYZE, CREATE INDEX CONCURRENTLY, CREATE STATISTICS, COMMENT ON, REINDEX CONCURRENTLY, and certain ALTER INDEX and ALTER TABLE variants. Held until end of transaction.";
      case "SHARE":
        return "Conflicts with ROW EXCLUSIVE, SHARE UPDATE EXCLUSIVE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE lock modes. Protects a table against concurrent data changes - blocks all data modifications while allowing concurrent reads. Acquired by CREATE INDEX (without CONCURRENTLY). Held until end of transaction.";
      case "SHARE ROW EXCLUSIVE":
        return "Conflicts with ROW EXCLUSIVE, SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE lock modes. Self-exclusive - only one session can hold this lock at a time. Protects against concurrent data changes. Acquired by CREATE TRIGGER and some forms of ALTER TABLE. Held until end of transaction.";
      case "EXCLUSIVE":
        return "Conflicts with ROW SHARE, ROW EXCLUSIVE, SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE lock modes. Allows only concurrent ACCESS SHARE locks - only reads from the table can proceed in parallel. Acquired by REFRESH MATERIALIZED VIEW CONCURRENTLY. Held until end of transaction.";
      case "ACCESS EXCLUSIVE":
        return "Conflicts with locks of all modes - most restrictive lock. Guarantees that the holder is the only transaction accessing the table in any way. Only ACCESS EXCLUSIVE blocks simple SELECT statements. Acquired by DROP TABLE, TRUNCATE, REINDEX, CLUSTER, VACUUM FULL, REFRESH MATERIALIZED VIEW (without CONCURRENTLY), many forms of ALTER INDEX and ALTER TABLE. Default for LOCK TABLE statements. Held until end of transaction.";
      default:
        return "PostgreSQL table-level lock mode. Held until end of transaction.";
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">
        Lock Analysis Results
      </h2>

      {queryType && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-primary" />
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
                  <code className="font-mono text-primary">{result.table}</code>
                </CardTitle>
                <SimpleTooltip content={result.description}>
                  <Badge
                    variant={getLockBadgeVariant(result.lockMode)}
                    className="font-mono text-xs cursor-help"
                  >
                    {result.lockMode}
                  </Badge>
                </SimpleTooltip>
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
                      <SimpleTooltip
                        key={i}
                        content={getLockDescription(conflict)}
                      >
                        <Badge
                          variant="outline"
                          className="text-xs cursor-help"
                        >
                          {conflict}
                        </Badge>
                      </SimpleTooltip>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

export const LockAnalysisResults = ({ results, queryType }: LockAnalysisResultsProps) => {
  if (results.length === 0) {
    return null;
  }

  const getLockBadgeVariant = (lockMode: string) => {
    switch (lockMode) {
      case 'ACCESS SHARE':
        return 'secondary';
      case 'ROW SHARE':
        return 'default';
      case 'ROW EXCLUSIVE':
        return 'default';
      case 'SHARE UPDATE EXCLUSIVE':
        return 'outline';
      case 'SHARE':
        return 'secondary';
      case 'SHARE ROW EXCLUSIVE':
        return 'destructive';
      case 'EXCLUSIVE':
        return 'destructive';
      case 'ACCESS EXCLUSIVE':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getLockTooltip = (lockMode: string) => {
    switch (lockMode) {
      case 'ACCESS SHARE':
        return 'Table-level lock. Weakest lock mode. Only blocked by ACCESS EXCLUSIVE. Allows concurrent reads.';
      case 'ROW SHARE':
        return 'Table-level lock. Acquired by SELECT FOR UPDATE/SHARE. Allows concurrent reads and most operations.';
      case 'ROW EXCLUSIVE':
        return 'Table-level lock. Acquired by data modification statements (INSERT, UPDATE, DELETE). Blocks most schema changes.';
      case 'SHARE UPDATE EXCLUSIVE':
        return 'Table-level lock. Prevents concurrent schema changes and VACUUM. Self-conflicting.';
      case 'SHARE':
        return 'Table-level lock. Prevents concurrent data changes. Allows concurrent reads.';
      case 'SHARE ROW EXCLUSIVE':
        return 'Table-level lock. Prevents concurrent data changes. Self-exclusive - only one session can hold it.';
      case 'EXCLUSIVE':
        return 'Table-level lock. Only allows concurrent reads (ACCESS SHARE). Very restrictive.';
      case 'ACCESS EXCLUSIVE':
        return 'Table-level lock. Strongest lock mode. Blocks all other access to the table.';
      default:
        return 'Unknown lock mode';
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Lock Analysis Results</h2>
        </div>

        {queryType && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Query Type:</span>
                <Badge variant="default" className="bg-primary">{queryType}</Badge>
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
                    Table: <code className="font-mono text-primary">{result.table}</code>
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
                      <p className="max-w-xs">{getLockTooltip(result.lockMode)}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-2">Description</h4>
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
                        <Badge key={i} variant="outline" className="text-xs">
                          {conflict}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-muted bg-muted/30">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Row-level locks may also be acquired on specific rows being modified. 
              The analysis above shows table-level locks only.
            </p>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};
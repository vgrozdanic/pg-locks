import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface SQLQueryInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SQLQueryInput = ({ value, onChange, placeholder }: SQLQueryInputProps) => {
  return (
    <div className="space-y-3">
      <Label htmlFor="sql-query" className="text-base font-semibold text-foreground">
        SQL Query
      </Label>
      <Textarea
        id="sql-query"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Enter your PostgreSQL query here..."}
        className="min-h-[200px] font-mono text-sm bg-card border-sql-border focus:border-primary transition-colors resize-none"
        style={{
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        }}
      />
    </div>
  );
};
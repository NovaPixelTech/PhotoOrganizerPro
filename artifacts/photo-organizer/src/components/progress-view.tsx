import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, HardDrive } from "lucide-react";

interface ProgressViewProps {
  label: string;
  current: number;
  total: number;
  currentFile: string;
}

export function ProgressView({ label, current, total, currentFile }: ProgressViewProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full max-w-xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <Card className="border-border/50 shadow-lg">
        <CardContent className="p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <HardDrive className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{label}</h2>
            <p className="text-muted-foreground text-sm">Please keep this window open.</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-sm font-medium">
              <span>{pct}% Complete</span>
              <span>{current} / {total} files</span>
            </div>
            <Progress value={pct} className="h-3" />
            {currentFile && (
              <div className="bg-muted/30 rounded-md p-3 text-xs font-mono text-muted-foreground truncate" title={currentFile}>
                {currentFile}
              </div>
            )}
          </div>

          {!total && (
            <div className="flex justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect } from "react";
import { useGetSession, getGetSessionQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, HardDrive } from "lucide-react";

interface ProgressViewProps {
  sessionId: string;
  onComplete: () => void;
}

export function ProgressView({ sessionId, onComplete }: ProgressViewProps) {
  const { data: session, isLoading } = useGetSession(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getGetSessionQueryKey(sessionId),
      refetchInterval: (query) => {
        const state = query.state.data;
        if (state?.status === "complete" || state?.status === "error") {
          return false; // Stop polling
        }
        return 2000; // Poll every 2s
      }
    }
  });

  useEffect(() => {
    if (session?.status === "complete") {
      onComplete();
    }
  }, [session?.status, onComplete]);

  if (isLoading || !session) {
    return (
      <div className="w-full max-w-md mx-auto text-center space-y-4 animate-in fade-in">
        <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
        <h2 className="text-xl font-semibold">Initializing process...</h2>
      </div>
    );
  }

  const { totalFiles, processedFiles, currentFile, status } = session;
  const progressPercent = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0;

  return (
    <div className="w-full max-w-xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <Card className="border-border/50 shadow-lg">
        <CardContent className="p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <HardDrive className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Organizing Files</h2>
            <p className="text-muted-foreground text-sm">Please keep this window open while we work.</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-sm font-medium">
              <span>{progressPercent}% Complete</span>
              <span>{processedFiles} / {totalFiles} files</span>
            </div>
            
            <Progress value={progressPercent} className="h-3" />
            
            <div className="bg-muted/30 rounded-md p-3 text-xs font-mono text-muted-foreground truncate" title={currentFile || "Processing..."}>
              {currentFile ? `Processing: ${currentFile}` : "Preparing files..."}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

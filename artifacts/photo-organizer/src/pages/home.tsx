import { useState } from "react";
import { UploadZone } from "@/components/upload-zone";
import { ScanResults } from "@/components/scan-results";
import { ProgressView } from "@/components/progress-view";
import { SummaryView } from "@/components/summary-view";
import { ProcessingDialog } from "@/components/processing-dialog";
import { ScanResponse } from "@workspace/api-client-react/src/generated/api.schemas";
import { useQueryClient } from "@tanstack/react-query";

export type AppState = "upload" | "scan_results" | "processing" | "complete";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scanResponse, setScanResponse] = useState<ScanResponse | null>(null);
  const [isProcessingDialogOpen, setProcessingDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  const handleUploadComplete = (sid: string) => {
    setSessionId(sid);
    // Move to scanning, the actual scan happens via useScanFiles in the child or we do it here.
    // Wait, useScanFiles should be triggered after upload. 
    // Actually, UploadZone will call useUploadFiles, then call useScanFiles, then call handleScanComplete.
  };

  const handleScanComplete = (res: ScanResponse) => {
    setSessionId(res.sessionId);
    setScanResponse(res);
    setAppState("scan_results");
  };

  const handleProcessStart = () => {
    setProcessingDialogOpen(false);
    setAppState("processing");
  };

  const handleStartOver = () => {
    setSessionId(null);
    setScanResponse(null);
    setAppState("upload");
    if (sessionId) {
      queryClient.removeQueries({ queryKey: getGetSessionQueryKey(sessionId) });
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full animate-in fade-in duration-500">
      {appState === "upload" && (
        <div className="flex-1 flex flex-col justify-center items-center py-12">
          <div className="w-full max-w-2xl">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold tracking-tight mb-2">Organize Your Memories</h2>
              <p className="text-muted-foreground">
                Drop your messy folders here. We'll extract dates and GPS locations to sort everything perfectly into year/month/location folders.
              </p>
            </div>
            <UploadZone onScanComplete={handleScanComplete} onUploadStart={(sid) => setSessionId(sid)} />
          </div>
        </div>
      )}

      {appState === "scan_results" && scanResponse && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <ScanResults 
            scanData={scanResponse} 
            onProcessClick={() => setProcessingDialogOpen(true)}
            onStartOver={handleStartOver}
          />
        </div>
      )}

      {appState === "processing" && sessionId && (
        <div className="flex-1 flex flex-col justify-center py-12">
          <ProgressView 
            sessionId={sessionId} 
            onComplete={() => setAppState("complete")}
          />
        </div>
      )}

      {appState === "complete" && sessionId && (
        <div className="flex-1 flex flex-col justify-center py-12">
          <SummaryView 
            sessionId={sessionId} 
            onStartOver={handleStartOver}
          />
        </div>
      )}

      {sessionId && (
        <ProcessingDialog 
          sessionId={sessionId}
          open={isProcessingDialogOpen}
          onOpenChange={setProcessingDialogOpen}
          onProcessStarted={handleProcessStart}
        />
      )}
    </div>
  );
}

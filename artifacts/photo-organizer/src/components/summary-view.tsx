import { getDownloadOrganizedUrl } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Download, RefreshCcw, FolderTree, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ProcessResponse } from "@workspace/api-client-react/src/generated/api.schemas";

interface SummaryViewProps {
  sessionId: string;
  processResult: ProcessResponse;
  onStartOver: () => void;
}

export function SummaryView({ sessionId, processResult, onStartOver }: SummaryViewProps) {
  const isDryRun = processResult.dryRun;

  return (
    <div className="w-full max-w-3xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
      <Card className="border-border/50 shadow-xl overflow-hidden">
        <div className="bg-primary/10 p-8 flex flex-col items-center justify-center border-b border-border/50">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-lg mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {isDryRun ? "Dry Run Complete" : "All Done!"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {isDryRun
              ? "Preview only — no files were moved or copied."
              : `Your files have been successfully ${processResult.action}d into organized folders.`}
          </p>
        </div>

        <CardContent className="p-8 space-y-6">
          {isDryRun && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Dry Run Mode</AlertTitle>
              <AlertDescription>
                This was a simulation. No files were actually moved or copied. Review the log below then run again without Dry Run to apply the changes.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Action</p>
              <p className="text-xl font-medium capitalize">
                {processResult.action}
                {isDryRun ? " (Dry)" : ""}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Processed</p>
              <p className="text-xl font-medium text-emerald-500">{processResult.processedCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Skipped</p>
              <p className="text-xl font-medium">{processResult.skippedCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Errors</p>
              <p className="text-xl font-medium text-destructive">{processResult.errorCount}</p>
            </div>
          </div>

          {processResult.summary.locations.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Locations detected</p>
              <div className="flex flex-wrap gap-2">
                {processResult.summary.locations.map((loc) => (
                  <span
                    key={loc}
                    className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                  >
                    {loc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {processResult.errorCount > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Some files had issues</AlertTitle>
              <AlertDescription>
                {processResult.errorCount} files could not be processed. Check the log below for details.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-primary" />
              Operation Log
            </h3>
            <ScrollArea className="h-48 bg-muted/20 border border-border/50 rounded-md p-4">
              <div className="space-y-1 font-mono text-xs">
                {processResult.log.map((entry, i) => (
                  <div
                    key={i}
                    className={`pb-1 border-b border-border/20 last:border-0 ${
                      entry.startsWith("ERROR")
                        ? "text-destructive"
                        : entry.startsWith("SKIP")
                        ? "text-muted-foreground/60"
                        : "text-muted-foreground"
                    }`}
                  >
                    {entry}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </CardContent>

        <CardFooter className="bg-muted/10 p-6 flex justify-between border-t border-border/50">
          <Button variant="outline" onClick={onStartOver} className="gap-2">
            <RefreshCcw className="w-4 h-4" />
            Process More
          </Button>

          {!isDryRun && (
            <Button asChild size="lg" className="gap-2 shadow-md">
              <a href={getDownloadOrganizedUrl({ sessionId })} download>
                <Download className="w-4 h-4" />
                Download ZIP Archive
              </a>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

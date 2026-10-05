import { useEffect, useRef } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Download, RefreshCcw, FolderTree, AlertCircle, Info } from "lucide-react";
import type { ProcessResult } from "@/pages/home";

interface SummaryViewProps {
  result: ProcessResult;
  onStartOver: () => void;
}

export function SummaryView({ result, onStartOver }: SummaryViewProps) {
  const zipUrl = useRef<string | null>(null);

  useEffect(() => {
    if (result.zipBlob) {
      const url = URL.createObjectURL(result.zipBlob);
      zipUrl.current = url;
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    return undefined;
  }, [result.zipBlob]);

  const downloadZip = () => {
    if (!zipUrl.current) return;
    const a = document.createElement("a");
    a.href = zipUrl.current;
    a.download = "organized-photos.zip";
    a.click();
  };

  return (
    <div className="w-full max-w-3xl mx-auto animate-in slide-in-from-bottom-8 duration-500">
      <Card className="border-border/50 shadow-xl overflow-hidden">
        <div className="bg-primary/10 p-8 flex flex-col items-center border-b border-border/50">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-lg mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            {result.dryRun ? "Dry Run Complete" : "All Done!"}
          </h2>
          <p className="text-muted-foreground mt-2 text-center">
            {result.dryRun
              ? "Preview only — no files were written."
              : result.zipBlob
              ? "Your ZIP archive is ready to download and extract."
              : `Files written directly to the folder you selected.`}
          </p>
        </div>

        <CardContent className="p-8 space-y-6">
          {result.dryRun && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Dry Run Mode</AlertTitle>
              <AlertDescription>
                No files were actually written. Review the log below, then run again without Dry Run to apply.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Action", value: result.action + (result.dryRun ? " (dry)" : "") },
              { label: "Processed", value: result.processedCount, green: true },
              { label: "Skipped", value: result.skippedCount },
              { label: "Errors", value: result.errorCount, red: result.errorCount > 0 },
            ].map(({ label, value, green, red }) => (
              <div key={label} className="space-y-1">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={`text-xl font-medium capitalize ${green ? "text-emerald-500" : red ? "text-destructive" : ""}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {result.locations.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Locations detected</p>
              <div className="flex flex-wrap gap-2">
                {result.locations.map((loc) => (
                  <span key={loc} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {loc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.errorCount > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Some files had issues</AlertTitle>
              <AlertDescription>{result.errorCount} files could not be processed. See the log below.</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <FolderTree className="w-4 h-4 text-primary" /> Operation Log
            </h3>
            <ScrollArea className="h-52 bg-muted/20 border border-border/50 rounded-md p-4">
              <div className="space-y-1 font-mono text-xs">
                {result.log.map((entry, i) => (
                  <div key={i} className={`pb-1 border-b border-border/20 last:border-0 ${
                    entry.startsWith("ERROR") ? "text-destructive" :
                    entry.startsWith("SKIP")  ? "text-muted-foreground/60" :
                    "text-muted-foreground"}`}>
                    {entry}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </CardContent>

        <CardFooter className="bg-muted/10 p-6 flex justify-between border-t border-border/50 gap-4">
          <Button variant="outline" onClick={onStartOver} className="gap-2">
            <RefreshCcw className="w-4 h-4" /> Process More
          </Button>

          {!result.dryRun && result.zipBlob && (
            <Button size="lg" className="gap-2 shadow-md" onClick={downloadZip}>
              <Download className="w-4 h-4" /> Download ZIP Archive
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

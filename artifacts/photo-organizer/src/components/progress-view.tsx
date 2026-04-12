import { Loader2, HardDrive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ProgressViewProps {
  sessionId: string;
}

export function ProgressView({ sessionId: _sessionId }: ProgressViewProps) {
  return (
    <div className="w-full max-w-xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <Card className="border-border/50 shadow-lg">
        <CardContent className="p-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <HardDrive className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Organizing Files</h2>
            <p className="text-muted-foreground text-sm">
              Please keep this window open while we work.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              Copying and sorting your files into folders...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

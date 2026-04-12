import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useProcessFiles } from "@workspace/api-client-react";
import type { ProcessRequestAction, ProcessResponse } from "@workspace/api-client-react/src/generated/api.schemas";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProcessingDialogProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProcessStarted: () => void;
  onProcessComplete: (result: ProcessResponse) => void;
}

export function ProcessingDialog({
  sessionId,
  open,
  onOpenChange,
  onProcessStarted,
  onProcessComplete,
}: ProcessingDialogProps) {
  const [action, setAction] = useState<ProcessRequestAction>("copy");
  const [dryRun, setDryRun] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processMutation = useProcessFiles();
  const { toast } = useToast();

  const handleStartProcess = async () => {
    setIsProcessing(true);
    // Close dialog and show progress view immediately
    onProcessStarted();

    try {
      const result = await processMutation.mutateAsync({
        data: {
          sessionId,
          action,
          dryRun,
        },
      });
      // When the backend returns, hand off the result
      onProcessComplete(result);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "error" in err
          ? String((err as { error: { error?: string } }).error?.error)
          : "Unknown error occurred.";
      toast({
        title: "Processing Failed",
        description: msg,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Organize Files</DialogTitle>
          <DialogDescription>
            Choose how you want to organize the processed files.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-6">
          <div className="space-y-4">
            <Label className="text-base">Action</Label>
            <RadioGroup
              defaultValue={action}
              onValueChange={(v) => setAction(v as ProcessRequestAction)}
              className="flex flex-col space-y-2"
            >
              <div className="flex items-center space-x-3 space-y-0 rounded-md border p-4 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="copy" id="action-copy" />
                <Label htmlFor="action-copy" className="flex-1 cursor-pointer font-normal">
                  <span className="block font-semibold">Copy Files</span>
                  <span className="text-sm text-muted-foreground">
                    Keep originals safe, create organized copies.
                  </span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 space-y-0 rounded-md border p-4 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="move" id="action-move" />
                <Label htmlFor="action-move" className="flex-1 cursor-pointer font-normal">
                  <span className="block font-semibold text-destructive">Move Files</span>
                  <span className="text-sm text-muted-foreground">
                    Move files directly to their new folders.
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="dry-run" className="text-base font-semibold">
                Dry Run
              </Label>
              <p className="text-sm text-muted-foreground">
                Simulate the process without actually copying or moving files.
              </p>
            </div>
            <Switch id="dry-run" checked={dryRun} onCheckedChange={setDryRun} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleStartProcess} disabled={isProcessing}>
            {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Start Organizing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { ProcessRequestAction } from "@workspace/api-client-react/src/generated/api.schemas";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProcessingDialogProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProcessStarted: () => void;
}

export function ProcessingDialog({ sessionId, open, onOpenChange, onProcessStarted }: ProcessingDialogProps) {
  const [action, setAction] = useState<ProcessRequestAction>("copy");
  const [dryRun, setDryRun] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  
  const processMutation = useProcessFiles();
  const { toast } = useToast();

  const handleStartProcess = async () => {
    setIsStarting(true);
    try {
      // We don't await this fully to unblock the UI since it runs in the background.
      // Actually, wait, useProcessFiles POST triggers the processing in the backend.
      // The backend returns a response once started or completed?
      // The API spec implies it processes and returns ProcessResponse, which means it blocks?
      // Wait, if it blocks, the progress UI polling won't work well if we await it here.
      // But we have to await it or call it and let it run while we switch to progress view.
      
      // Let's fire the mutation and immediately switch state, but catch errors.
      processMutation.mutate({
        data: {
          sessionId,
          action,
          dryRun
        }
      }, {
        onError: (err) => {
          toast({
            title: "Processing Failed",
            description: err.error?.error || "Unknown error occurred.",
            variant: "destructive"
          });
        }
      });
      
      onProcessStarted();
    } catch (error) {
      console.error(error);
    } finally {
      setIsStarting(false);
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
            <RadioGroup defaultValue={action} onValueChange={(v) => setAction(v as ProcessRequestAction)} className="flex flex-col space-y-2">
              <div className="flex items-center space-x-3 space-y-0 rounded-md border p-4 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="copy" id="action-copy" />
                <Label htmlFor="action-copy" className="flex-1 cursor-pointer font-normal">
                  <span className="block font-semibold">Copy Files</span>
                  <span className="text-sm text-muted-foreground">Keep originals safe, create organized copies. Requires more disk space.</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 space-y-0 rounded-md border p-4 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="move" id="action-move" />
                <Label htmlFor="action-move" className="flex-1 cursor-pointer font-normal">
                  <span className="block font-semibold text-destructive">Move Files</span>
                  <span className="text-sm text-muted-foreground">Move files directly to their new folders. Original folders will be emptied.</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="dry-run" className="text-base font-semibold">Dry Run</Label>
              <p className="text-sm text-muted-foreground">Simulate the process without actually moving or copying files on disk.</p>
            </div>
            <Switch 
              id="dry-run" 
              checked={dryRun}
              onCheckedChange={setDryRun}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleStartProcess} disabled={isStarting}>
            {isStarting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Start Organizing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

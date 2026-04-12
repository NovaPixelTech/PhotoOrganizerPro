import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FolderOpen, Download, Info } from "lucide-react";

interface ProcessingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (action: "copy" | "move", dryRun: boolean) => void;
  supportsDirectWrite: boolean;
}

export function ProcessingDialog({ open, onOpenChange, onConfirm, supportsDirectWrite }: ProcessingDialogProps) {
  const [action, setAction] = useState<"copy" | "move">("copy");
  const [dryRun, setDryRun] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Organize Files</DialogTitle>
          <DialogDescription>
            Choose how to handle your files.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Action</Label>
            <RadioGroup value={action} onValueChange={(v) => setAction(v as "copy" | "move")} className="flex flex-col space-y-2">
              <div className="flex items-center gap-3 rounded-md border p-4 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="copy" id="act-copy" />
                <Label htmlFor="act-copy" className="flex-1 cursor-pointer font-normal">
                  <span className="block font-semibold">Copy</span>
                  <span className="text-sm text-muted-foreground">Originals stay untouched. Organized copies go to a new folder.</span>
                </Label>
              </div>
              <div className="flex items-center gap-3 rounded-md border p-4 hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="move" id="act-move" />
                <Label htmlFor="act-move" className="flex-1 cursor-pointer font-normal">
                  <span className="block font-semibold text-destructive">Move</span>
                  <span className="text-sm text-muted-foreground">Files are written to the new organized structure only.</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between rounded-md border p-4">
            <div>
              <Label htmlFor="dry-run" className="text-base font-semibold">Dry Run</Label>
              <p className="text-sm text-muted-foreground">Preview the plan without writing any files.</p>
            </div>
            <Switch id="dry-run" checked={dryRun} onCheckedChange={setDryRun} />
          </div>

          {!dryRun && (
            <Alert className="border-primary/30 bg-primary/5">
              {supportsDirectWrite ? (
                <>
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    <strong>Direct folder write supported.</strong> After clicking Start, your browser will ask you to pick an output folder. Files will be saved there directly — no download needed.
                  </AlertDescription>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    <strong>ZIP download.</strong> Your browser doesn't support direct folder writing (try Chrome on desktop for that). The organized files will be packaged into a ZIP you can save and extract anywhere.
                  </AlertDescription>
                </>
              )}
            </Alert>
          )}

          {!dryRun && !supportsDirectWrite && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                For iPhones and Safari: download the ZIP, open the Files app, tap the ZIP to extract it — your organized folder structure will appear there.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onConfirm(action, dryRun)}>
            {dryRun ? "Preview Plan" : supportsDirectWrite ? "Pick Output Folder & Start" : "Build ZIP & Start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

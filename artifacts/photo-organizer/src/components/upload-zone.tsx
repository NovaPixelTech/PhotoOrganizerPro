import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UploadCloud, FolderUp, FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getFileKind } from "@/lib/exif-extractor";

const ACCEPTED_KINDS = new Set(["image", "video"]);

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
}

export function UploadZone({ onFiles }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const submit = useCallback(
    (raw: FileList | File[]) => {
      const all = Array.from(raw).filter((f) => ACCEPTED_KINDS.has(getFileKind(f.name)));
      if (!all.length) {
        toast({
          title: "No supported files found",
          description: "Please select JPG, HEIC, PNG, MOV, MP4, or other common photo/video formats.",
          variant: "destructive",
        });
        return;
      }
      onFiles(all);
    },
    [onFiles, toast]
  );

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) submit(e.dataTransfer.files);
  }, [submit]);

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) submit(e.target.files);
    e.target.value = "";
  };

  return (
    <div className="w-full">
      <Card
        className={`relative border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center p-12 text-center
          ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="w-20 h-20 mb-6 rounded-full bg-secondary flex items-center justify-center text-primary">
          <UploadCloud className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Drag & Drop files or a folder here</h3>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm">
          JPG, HEIC, PNG, MOV, MP4 and more. EXIF dates and GPS coordinates are read directly in your browser — nothing is uploaded to any server.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <input type="file" multiple className="hidden" ref={fileInputRef} onChange={onInput}
            accept="image/*,video/*" />
          <input type="file"
            // @ts-expect-error webkitdirectory is non-standard
            webkitdirectory="true"
            multiple className="hidden" ref={folderInputRef} onChange={onInput} />

          <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto"
            onClick={() => fileInputRef.current?.click()}>
            <FileImage className="w-4 h-4" /> Select Files
          </Button>
          <Button variant="default" size="lg" className="gap-2 w-full sm:w-auto"
            onClick={() => folderInputRef.current?.click()}>
            <FolderUp className="w-4 h-4" /> Select Folder
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground/60">
          Your files stay on your device. All processing happens locally in the browser.
        </p>
      </Card>
    </div>
  );
}

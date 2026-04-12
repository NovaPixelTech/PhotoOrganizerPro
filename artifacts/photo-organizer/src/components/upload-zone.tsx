import { useState, useRef, useCallback } from "react";
import { useUploadFiles, useScanFiles } from "@workspace/api-client-react";
import type { ScanResponse } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UploadCloud, FolderUp, FileImage, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadZoneProps {
  onScanComplete: (res: ScanResponse) => void;
}

export function UploadZone({ onScanComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadFilesMutation = useUploadFiles();
  const scanFilesMutation = useScanFiles();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setProgressText(`Uploading ${files.length} file${files.length !== 1 ? "s" : ""}...`);

    try {
      const fileArray = Array.from(files);

      const uploadRes = await uploadFilesMutation.mutateAsync({
        data: { files: fileArray },
      });

      const { sessionId } = uploadRes;
      setProgressText("Extracting metadata and GPS locations...");

      const scanRes = await scanFilesMutation.mutateAsync({
        data: { sessionId },
      });

      onScanComplete(scanRes);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error processing files",
        description: "There was a problem uploading or scanning your files. Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    // Reset so same folder can be re-selected
    e.target.value = "";
  };

  return (
    <div className="w-full">
      <Card
        className={`relative overflow-hidden border-2 border-dashed transition-all duration-200 ease-in-out flex flex-col items-center justify-center p-12 text-center
          ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
          ${isUploading ? "pointer-events-none opacity-80" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <h3 className="text-xl font-semibold">{progressText}</h3>
            <p className="text-sm text-muted-foreground">This might take a moment for large folders.</p>
          </div>
        ) : (
          <>
            <div className="w-20 h-20 mb-6 rounded-full bg-secondary flex items-center justify-center text-primary">
              <UploadCloud className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Drag & Drop files or folders here</h3>
            <p className="text-sm text-muted-foreground mb-8 max-w-sm">
              Supported formats: JPG, HEIC, PNG, MOV, MP4. We extract EXIF data, dates, and GPS coordinates automatically.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
              {/* Individual file selection */}
              <input
                type="file"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileInput}
                accept="image/jpeg,image/png,image/heic,image/heif,image/webp,video/mp4,video/quicktime,video/avi"
              />
              {/* Folder selection — webkitdirectory is non-standard but widely supported */}
              <input
                type="file"
                // @ts-expect-error webkitdirectory is non-standard
                webkitdirectory="true"
                multiple
                className="hidden"
                ref={folderInputRef}
                onChange={handleFileInput}
              />

              <Button
                variant="outline"
                size="lg"
                className="gap-2 w-full sm:w-auto"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileImage className="w-4 h-4" />
                Select Files
              </Button>

              <Button
                variant="default"
                size="lg"
                className="gap-2 w-full sm:w-auto"
                onClick={() => folderInputRef.current?.click()}
              >
                <FolderUp className="w-4 h-4" />
                Select Folder
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

import { useState, useRef, useCallback } from "react";
import { extractFileMeta, type FileMeta } from "@/lib/exif-extractor";
import { reverseGeocode, buildTargetFolder } from "@/lib/geocoder";
import { UploadZone } from "@/components/upload-zone";
import { ScanResults } from "@/components/scan-results";
import { ProcessingDialog } from "@/components/processing-dialog";
import { ProgressView } from "@/components/progress-view";
import { SummaryView } from "@/components/summary-view";

export type AppState = "upload" | "scanning" | "scan_results" | "processing" | "complete";

export interface ProcessResult {
  action: "copy" | "move";
  dryRun: boolean;
  processedCount: number;
  skippedCount: number;
  errorCount: number;
  locations: string[];
  log: string[];
  zipBlob: Blob | null;
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, label: "" });
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0, label: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);

  // Abort controller so we can cancel in-flight scans
  const abortRef = useRef<AbortController | null>(null);

  const handleFiles = useCallback(async (rawFiles: File[]) => {
    if (!rawFiles.length) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setFiles([]);
    setAppState("scanning");
    setScanProgress({ current: 0, total: rawFiles.length, label: "Starting…" });

    const results: FileMeta[] = [];
    const seenSizes = new Map<string, number>(); // "size-ext" -> count

    for (let i = 0; i < rawFiles.length; i++) {
      if (ctrl.signal.aborted) return;
      const f = rawFiles[i];
      setScanProgress({ current: i + 1, total: rawFiles.length, label: f.name });

      const meta = await extractFileMeta(f);

      // Geocode if GPS is available
      if (meta.lat !== null && meta.lon !== null) {
        meta.location = await reverseGeocode(meta.lat, meta.lon);
      }

      // Build target folder path
      meta.targetFolder = buildTargetFolder({
        location: meta.location,
        year: meta.year,
        month: meta.month,
        kind: meta.kind,
      });

      // Duplicate detection: same size + extension
      const dupKey = `${f.size}-${meta.ext}`;
      const prev = seenSizes.get(dupKey);
      if (prev !== undefined && prev === f.size) {
        meta.isDuplicate = true;
      } else {
        seenSizes.set(dupKey, f.size);
      }

      results.push(meta);
    }

    if (ctrl.signal.aborted) return;
    setFiles(results);
    setAppState("scan_results");
  }, []);

  const handleProcess = useCallback(
    async (action: "copy" | "move", dryRun: boolean) => {
      setDialogOpen(false);
      setAppState("processing");
      setProcessProgress({ current: 0, total: files.length, label: "" });

      const log: string[] = [];
      let processed = 0;
      let skipped = 0;
      let errors = 0;
      const locationsSet = new Set<string>();

      // Try File System Access API for direct folder write (Chrome desktop only)
      let outDirHandle: FileSystemDirectoryHandle | null = null;
      const supportsFilePicker = typeof window !== "undefined" && "showDirectoryPicker" in window;

      if (!dryRun && supportsFilePicker) {
        try {
          outDirHandle = await (window as Window & { showDirectoryPicker: (o?: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({
            mode: "readwrite",
            startIn: "documents",
            id: "photo-organizer-output",
          });
        } catch {
          // User cancelled picker — fall back to ZIP
          outDirHandle = null;
        }
      }

      // If direct write isn't available, build a ZIP
      let JSZip: typeof import("jszip") | null = null;
      let zip: InstanceType<typeof import("jszip")> | null = null;
      if (!dryRun && !outDirHandle) {
        const mod = await import("jszip");
        JSZip = mod.default;
        zip = new JSZip();
      }

      for (let i = 0; i < files.length; i++) {
        const meta = files[i];
        setProcessProgress({ current: i + 1, total: files.length, label: meta.file.name });

        if (meta.isDuplicate) {
          skipped++;
          log.push(`SKIP (duplicate): ${meta.originalName}`);
          continue;
        }

        const destPath = `${meta.targetFolder}/${meta.file.name}`;

        if (dryRun) {
          log.push(`DRY RUN ${action.toUpperCase()}: ${meta.originalName} → ${destPath}`);
          processed++;
          if (meta.location) locationsSet.add(meta.location);
          continue;
        }

        try {
          const arrayBuf = await meta.file.arrayBuffer();

          if (outDirHandle) {
            // Write directly to user's local folder
            const pathParts = destPath.split("/");
            let dirHandle: FileSystemDirectoryHandle = outDirHandle;
            for (let p = 0; p < pathParts.length - 1; p++) {
              dirHandle = await dirHandle.getDirectoryHandle(pathParts[p], { create: true });
            }
            const fileHandle = await dirHandle.getFileHandle(pathParts[pathParts.length - 1], { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(arrayBuf);
            await writable.close();
            log.push(`${action === "copy" ? "COPY" : "MOVE"}: ${meta.originalName} → ${destPath}`);
          } else if (zip) {
            // Add to ZIP
            zip.file(destPath, arrayBuf);
            log.push(`${action === "copy" ? "COPY" : "MOVE"}: ${meta.originalName} → ${destPath}`);
          }

          processed++;
          if (meta.location) locationsSet.add(meta.location);
        } catch (err) {
          errors++;
          log.push(`ERROR: ${meta.originalName} — ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      let zipBlob: Blob | null = null;
      if (zip) {
        zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "STORE", // no compression — preserves image quality and is fast
        });
      }

      setProcessResult({
        action,
        dryRun,
        processedCount: processed,
        skippedCount: skipped,
        errorCount: errors,
        locations: Array.from(locationsSet),
        log,
        zipBlob,
      });
      setAppState("complete");
    },
    [files]
  );

  const handleStartOver = useCallback(() => {
    abortRef.current?.abort();
    setFiles([]);
    setProcessResult(null);
    setAppState("upload");
  }, []);

  return (
    <div className="flex-1 flex flex-col w-full h-full animate-in fade-in duration-500">
      {appState === "upload" && (
        <div className="flex-1 flex flex-col justify-center items-center py-12">
          <div className="w-full max-w-2xl">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold tracking-tight mb-2">Organize Your Memories</h2>
              <p className="text-muted-foreground">
                Select photos and videos — we'll read their EXIF dates and GPS locations and sort them into neat folders on your device.
              </p>
            </div>
            <UploadZone onFiles={handleFiles} />
          </div>
        </div>
      )}

      {appState === "scanning" && (
        <div className="flex-1 flex flex-col justify-center py-12">
          <ProgressView
            label="Reading metadata…"
            current={scanProgress.current}
            total={scanProgress.total}
            currentFile={scanProgress.label}
          />
        </div>
      )}

      {appState === "scan_results" && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <ScanResults
            files={files}
            onProcessClick={() => setDialogOpen(true)}
            onStartOver={handleStartOver}
          />
        </div>
      )}

      {appState === "processing" && (
        <div className="flex-1 flex flex-col justify-center py-12">
          <ProgressView
            label="Organizing files…"
            current={processProgress.current}
            total={processProgress.total}
            currentFile={processProgress.label}
          />
        </div>
      )}

      {appState === "complete" && processResult && (
        <div className="flex-1 flex flex-col justify-center py-12">
          <SummaryView result={processResult} onStartOver={handleStartOver} />
        </div>
      )}

      <ProcessingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleProcess}
        supportsDirectWrite={typeof window !== "undefined" && "showDirectoryPicker" in window}
      />
    </div>
  );
}

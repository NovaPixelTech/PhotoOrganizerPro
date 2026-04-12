import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import archiver from "archiver";
import { createSession, getSession, updateSession, toSessionDetails } from "../lib/sessions";
import { extractMetadata } from "../lib/metadata";
import { reverseGeocode, buildOrganizedPath } from "../lib/geocoder";
import type { FileMetadata, ScanSummary } from "@workspace/api-zod";
import { ScanFilesBody, ProcessFilesBody, GetSessionParams } from "@workspace/api-zod";

const router = Router();

const UPLOAD_BASE = path.join(os.tmpdir(), "photo-organizer");
fs.mkdirSync(UPLOAD_BASE, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_BASE);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

/**
 * POST /api/organize/upload
 * Upload files for a session
 */
router.post("/upload", upload.array("files", 5000), async (req, res): Promise<void> => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }

  const uploadDir = path.join(UPLOAD_BASE, `session-${Date.now()}`);
  fs.mkdirSync(uploadDir, { recursive: true });

  for (const file of files) {
    const origName = file.originalname || file.filename;
    const dest = path.join(uploadDir, origName);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(file.path, dest);
  }

  const session = createSession(uploadDir);
  session.totalFiles = files.length;

  req.log.info({ sessionId: session.sessionId, fileCount: files.length }, "Files uploaded");

  res.json({
    sessionId: session.sessionId,
    fileCount: files.length,
    message: `${files.length} files uploaded successfully`,
  });
});

/**
 * POST /api/organize/scan
 * Scan all uploaded files and extract metadata
 */
router.post("/scan", async (req, res): Promise<void> => {
  const parsed = ScanFilesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.message });
    return;
  }

  const { sessionId } = parsed.data;
  const session = getSession(sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  updateSession(sessionId, { status: "scanning", processedFiles: 0 });

  const uploadDir = session.uploadDir;

  const getAllFiles = (dir: string): string[] => {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...getAllFiles(fullPath));
        } else {
          results.push(fullPath);
        }
      }
    } catch {
      /* ignore */
    }
    return results;
  };

  const allFiles = getAllFiles(uploadDir);

  const scannedFiles: FileMetadata[] = [];
  const seenHashes = new Map<string, string>();
  let images = 0, videos = 0, unknown = 0;
  let withGps = 0, withDate = 0, duplicates = 0, errors = 0;
  const locationsSet = new Set<string>();

  for (let i = 0; i < allFiles.length; i++) {
    const filePath = allFiles[i];
    const originalName = path.relative(uploadDir, filePath);

    updateSession(sessionId, {
      processedFiles: i,
      currentFile: originalName,
    });

    let meta: FileMetadata;
    try {
      const extracted = await extractMetadata(filePath);

      let location: string | null = null;
      if (extracted.latitude !== null && extracted.longitude !== null) {
        withGps++;
        location = await reverseGeocode(extracted.latitude, extracted.longitude);
        if (location) locationsSet.add(location);
      }

      if (extracted.year) withDate++;

      const targetPath = buildOrganizedPath({
        location,
        year: extracted.year,
        month: extracted.month,
        fileType: extracted.fileType,
      });

      let isDuplicate = false;
      let fileHash: string | undefined;
      try {
        const stat = fs.statSync(filePath);
        const hashKey = `${stat.size}-${path.basename(filePath)}`;
        if (seenHashes.has(hashKey)) {
          isDuplicate = true;
          duplicates++;
        } else {
          seenHashes.set(hashKey, filePath);
        }
      } catch {
        /* ignore */
      }

      if (extracted.fileType === "image") images++;
      else if (extracted.fileType === "video") videos++;
      else unknown++;

      meta = {
        originalName,
        fileType: extracted.fileType,
        extension: extracted.extension,
        year: extracted.year,
        month: extracted.month,
        latitude: extracted.latitude,
        longitude: extracted.longitude,
        location,
        targetPath,
        isDuplicate,
        error: null,
        sizeBytes: extracted.sizeBytes,
      };
    } catch (err) {
      errors++;
      unknown++;
      meta = {
        originalName,
        fileType: "unknown",
        extension: path.extname(filePath).toLowerCase(),
        year: null,
        month: null,
        latitude: null,
        longitude: null,
        location: null,
        targetPath: "Organized/Unknown/UnknownDate/Other",
        isDuplicate: false,
        error: err instanceof Error ? err.message : String(err),
        sizeBytes: 0,
      };
    }

    scannedFiles.push(meta);
  }

  const summary: ScanSummary = {
    images,
    videos,
    unknown,
    withGps,
    withDate,
    duplicates,
    locations: Array.from(locationsSet),
    errors,
  };

  updateSession(sessionId, {
    status: "complete",
    files: scannedFiles,
    summary,
    totalFiles: scannedFiles.length,
    processedFiles: scannedFiles.length,
    currentFile: null,
  });

  req.log.info({ sessionId, totalFiles: scannedFiles.length }, "Scan complete");

  res.json({
    sessionId,
    totalFiles: scannedFiles.length,
    files: scannedFiles,
    summary,
  });
});

/**
 * POST /api/organize/process
 * Organize files into the target structure (copy or move), supports dry run
 */
router.post("/process", async (req, res): Promise<void> => {
  const parsed = ProcessFilesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.message });
    return;
  }

  const { sessionId, action, dryRun } = parsed.data;
  const session = getSession(sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (!session.files.length) {
    res.status(400).json({ error: "No scanned files found. Run scan first." });
    return;
  }

  updateSession(sessionId, { status: "processing" });

  const outputBase = path.join(UPLOAD_BASE, `organized-${sessionId}`);
  if (!dryRun) {
    fs.mkdirSync(outputBase, { recursive: true });
  }

  let processedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const log: string[] = [];

  for (let i = 0; i < session.files.length; i++) {
    const fileMeta = session.files[i];

    updateSession(sessionId, {
      processedFiles: i,
      currentFile: fileMeta.originalName,
    });

    if (fileMeta.isDuplicate) {
      skippedCount++;
      log.push(`SKIP (duplicate): ${fileMeta.originalName}`);
      continue;
    }

    const srcPath = path.join(session.uploadDir, fileMeta.originalName);
    const destDir = path.join(outputBase, fileMeta.targetPath);
    const destPath = path.join(destDir, path.basename(fileMeta.originalName));

    if (dryRun) {
      log.push(`DRY RUN ${action === "copy" ? "COPY" : "MOVE"}: ${fileMeta.originalName} → ${fileMeta.targetPath}/${path.basename(fileMeta.originalName)}`);
      processedCount++;
      continue;
    }

    try {
      if (!fs.existsSync(srcPath)) {
        log.push(`ERROR: Source not found: ${fileMeta.originalName}`);
        errorCount++;
        continue;
      }

      fs.mkdirSync(destDir, { recursive: true });

      let finalDestPath = destPath;
      if (fs.existsSync(finalDestPath)) {
        const ext = path.extname(finalDestPath);
        const base = path.basename(finalDestPath, ext);
        finalDestPath = path.join(destDir, `${base}_${Date.now()}${ext}`);
      }

      if (action === "copy") {
        fs.copyFileSync(srcPath, finalDestPath);
        log.push(`COPY: ${fileMeta.originalName} → ${fileMeta.targetPath}/${path.basename(finalDestPath)}`);
      } else {
        fs.renameSync(srcPath, finalDestPath);
        log.push(`MOVE: ${fileMeta.originalName} → ${fileMeta.targetPath}/${path.basename(finalDestPath)}`);
      }

      processedCount++;
    } catch (err) {
      errorCount++;
      log.push(`ERROR: ${fileMeta.originalName} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const processResult = {
    sessionId,
    success: errorCount === 0,
    processedCount,
    errorCount,
    skippedCount,
    dryRun: dryRun ?? false,
    action: action ?? "copy",
    log,
    summary: session.summary ?? {
      images: 0, videos: 0, unknown: 0, withGps: 0, withDate: 0,
      duplicates: 0, locations: [], errors: 0,
    },
  };

  updateSession(sessionId, {
    status: "complete",
    processedFiles: session.files.length,
    currentFile: null,
    outputDir: dryRun ? null : outputBase,
    processResult,
  });

  req.log.info({ sessionId, processedCount, errorCount, dryRun }, "Processing complete");

  res.json(processResult);
});

/**
 * GET /api/organize/download
 * Download organized files as a ZIP archive
 */
router.get("/download", async (req, res): Promise<void> => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ error: "sessionId query param required" });
    return;
  }

  const session = getSession(sessionId);
  if (!session || !session.outputDir) {
    res.status(404).json({ error: "Session not found or no output available. Did you run process (non-dry-run)?" });
    return;
  }

  const outputDir = session.outputDir;

  if (!fs.existsSync(outputDir)) {
    res.status(404).json({ error: "Output directory not found" });
    return;
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="organized-photos-${sessionId.slice(0, 8)}.zip"`);

  const archive = archiver("zip", { zlib: { level: 5 } });
  archive.on("error", (err) => {
    req.log.error({ err }, "Archiver error");
    res.status(500).end();
  });

  archive.pipe(res);
  archive.directory(outputDir, "Organized");
  await archive.finalize();
});

/**
 * GET /api/organize/session/:sessionId
 * Get session status
 */
router.get("/session/:sessionId", (req, res): void => {
  const parsed = GetSessionParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const session = getSession(parsed.data.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(toSessionDetails(session));
});

export default router;

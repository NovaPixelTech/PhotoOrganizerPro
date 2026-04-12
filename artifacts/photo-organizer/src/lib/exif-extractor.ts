import exifr from "exifr";
import { extractVideoMeta } from "./video-meta";

export type FileKind = "image" | "video" | "unknown";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tiff", ".tif", ".bmp"]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".avi", ".mkv", ".m4v", ".3gp", ".wmv"]);

export function getFileKind(name: string): FileKind {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  return "unknown";
}

export function getExt(name: string): string {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

export interface FileMeta {
  file: File;
  originalName: string;
  kind: FileKind;
  ext: string;
  year: string | null;
  month: string | null;
  lat: number | null;
  lon: number | null;
  location: string | null;
  targetFolder: string | null;
  isDuplicate: boolean;
  error: string | null;
}

/** Parse date/GPS from a File, entirely in the browser. */
export async function extractFileMeta(file: File): Promise<FileMeta> {
  const kind = getFileKind(file.name);
  const ext  = getExt(file.name);
  const base: FileMeta = {
    file,
    originalName: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    kind,
    ext,
    year: null,
    month: null,
    lat: null,
    lon: null,
    location: null,
    targetFolder: null,
    isDuplicate: false,
    error: null,
  };

  // ── Videos: binary QuickTime/ISOBMFF parser ──────────────────────────────
  if (kind === "video") {
    const vmeta = await extractVideoMeta(file);
    if (vmeta.lat !== null) base.lat = vmeta.lat;
    if (vmeta.lon !== null) base.lon = vmeta.lon;
    if (vmeta.year)  base.year  = vmeta.year;
    if (vmeta.month) base.month = vmeta.month;

    // Fall back to filename date, then file.lastModified
    if (!base.year) applyDateFallback(file, base);
    return base;
  }

  // ── Images: exifr ────────────────────────────────────────────────────────

  // GPS — use the dedicated exifr.gps() which returns decimal floats directly,
  // avoiding the DMS-array issue that appears when using parse() + pick().
  try {
    const gps = await exifr.gps(file);
    if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
      base.lat = gps.latitude;
      base.lon  = gps.longitude;
    }
  } catch {
    // GPS simply absent — not an error
  }

  // Date
  try {
    const tags = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: false,   // already handled above
      ifd0: true,
      xmp: false,
      iptc: false,
      jfif: false,
    });

    if (tags) {
      const raw: Date | string | undefined =
        tags.DateTimeOriginal ?? tags.CreateDate ?? tags.DateTime;

      if (raw instanceof Date && !isNaN(raw.getTime())) {
        base.year  = String(raw.getFullYear());
        base.month = String(raw.getMonth() + 1).padStart(2, "0");
      } else if (typeof raw === "string") {
        const m = raw.match(/^(\d{4})[:\-](\d{2})/);
        if (m) { base.year = m[1]; base.month = m[2]; }
      }
    }
  } catch {
    // exifr couldn't read tags — fall through
  }

  if (!base.year) applyDateFallback(file, base);
  return base;
}

/** Apply filename-date → lastModified fallback chain. */
function applyDateFallback(file: File, base: FileMeta): void {
  const nameDate = parseDateFromName(file.name);
  if (nameDate) {
    base.year  = nameDate.year;
    base.month = nameDate.month;
    return;
  }
  const d = new Date(file.lastModified);
  if (!isNaN(d.getTime())) {
    base.year  = String(d.getFullYear());
    base.month = String(d.getMonth() + 1).padStart(2, "0");
  }
}

function parseDateFromName(name: string): { year: string; month: string } | null {
  const m = name.match(/(\d{4})[_\-:]?(\d{2})/);
  if (m) {
    const year  = parseInt(m[1]);
    const month = parseInt(m[2]);
    if (year > 1990 && year < 2100 && month >= 1 && month <= 12) {
      return { year: String(year), month: String(month).padStart(2, "0") };
    }
  }
  return null;
}

import exifr from "exifr";

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

/** Parse date/GPS from a File using exifr (runs fully in the browser). */
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

  // --- GPS (works for JPG, HEIC, PNG, MOV, MP4 …) ---
  // exifr.gps() returns {latitude, longitude} as decimal floats directly,
  // avoiding the DMS-array issue that bites when using parse() + pick().
  try {
    const gps = await exifr.gps(file);
    if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
      base.lat = gps.latitude;
      base.lon = gps.longitude;
    }
  } catch {
    // GPS simply not present — not an error
  }

  // --- Date/time ---
  try {
    // Use parse() without pick so all date tags are available.
    // translateValues:false keeps strings as-is; exifr still converts Date fields.
    const tags = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: false,  // already handled above
      ifd0: true,
      xmp: false,
      iptc: false,
      jfif: false,
    });

    if (tags) {
      // Prefer DateTimeOriginal, fall back to CreateDate / DateTime
      const raw: Date | string | undefined =
        tags.DateTimeOriginal ?? tags.CreateDate ?? tags.DateTime;

      if (raw instanceof Date && !isNaN(raw.getTime())) {
        base.year  = String(raw.getFullYear());
        base.month = String(raw.getMonth() + 1).padStart(2, "0");
      } else if (typeof raw === "string") {
        // e.g. "2023:07:14 10:30:00"
        const m = raw.match(/^(\d{4})[:\-](\d{2})/);
        if (m) { base.year = m[1]; base.month = m[2]; }
      }
    }
  } catch {
    // exifr couldn't read date tags — fall through to fallbacks
  }

  // --- Date fallbacks ---
  if (!base.year) {
    const dateFromName = parseDateFromName(file.name);
    if (dateFromName) {
      base.year  = dateFromName.year;
      base.month = dateFromName.month;
    } else {
      const d = new Date(file.lastModified);
      if (!isNaN(d.getTime())) {
        base.year  = String(d.getFullYear());
        base.month = String(d.getMonth() + 1).padStart(2, "0");
      }
    }
  }

  return base;
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

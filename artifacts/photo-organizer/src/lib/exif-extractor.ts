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
  location: string | null;       // filled in after geocoding
  targetFolder: string | null;   // filled in after geocoding
  isDuplicate: boolean;
  error: string | null;
}

/** Parse date/GPS from a File using exifr (browser-side) */
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

  // Videos: try to get date from filename or file.lastModified
  if (kind === "video" || kind === "unknown") {
    const dateFromName = parseDateFromName(file.name);
    if (dateFromName) {
      base.year  = dateFromName.year;
      base.month = dateFromName.month;
    } else {
      const d = new Date(file.lastModified);
      base.year  = String(d.getFullYear());
      base.month = String(d.getMonth() + 1).padStart(2, "0");
    }
    return base;
  }

  // Images: use exifr
  try {
    const tags = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      ifd0: true,
      pick: ["DateTimeOriginal", "DateTime", "CreateDate", "GPSLatitude", "GPSLongitude", "GPSLatitudeRef", "GPSLongitudeRef"],
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

      if (typeof tags.GPSLatitude === "number" && typeof tags.GPSLongitude === "number") {
        base.lat = tags.GPSLatitude;
        base.lon = tags.GPSLongitude;
      }
    }
  } catch {
    // exifr can fail on some files — fall back to lastModified
    const dateFromName = parseDateFromName(file.name);
    if (dateFromName) {
      base.year  = dateFromName.year;
      base.month = dateFromName.month;
    } else {
      const d = new Date(file.lastModified);
      base.year  = String(d.getFullYear());
      base.month = String(d.getMonth() + 1).padStart(2, "0");
    }
  }

  // Fallback: try filename date
  if (!base.year) {
    const dateFromName = parseDateFromName(file.name);
    if (dateFromName) {
      base.year  = dateFromName.year;
      base.month = dateFromName.month;
    }
  }

  return base;
}

function parseDateFromName(name: string): { year: string; month: string } | null {
  const m = name.match(/(\d{4})[_\-:]?(\d{2})/);
  if (m && parseInt(m[1]) > 1990 && parseInt(m[2]) >= 1 && parseInt(m[2]) <= 12) {
    return { year: m[1], month: m[2].padStart(2, "0") };
  }
  return null;
}

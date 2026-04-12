import fs from "fs";
import path from "path";
import { logger } from "./logger";

export type FileType = "image" | "video" | "unknown";

export interface ExtractedMetadata {
  fileType: FileType;
  extension: string;
  year: string | null;
  month: string | null;
  latitude: number | null;
  longitude: number | null;
  sizeBytes: number;
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tiff", ".tif", ".bmp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv", ".m4v", ".3gp", ".wmv"]);

export function detectFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "unknown";
}

/**
 * Convert GPS DMS (degrees, minutes, seconds) to decimal degrees
 */
function dmsToDecimal(dms: number[]): number {
  if (!dms || dms.length < 3) return 0;
  return dms[0] + dms[1] / 60 + dms[2] / 3600;
}

/**
 * Extract metadata from a JPEG/HEIC/PNG image file using raw EXIF parsing
 */
async function extractImageMetadata(filePath: string): Promise<Partial<ExtractedMetadata>> {
  const ext = path.extname(filePath).toLowerCase();

  try {
    let buffer: Buffer;

    if (ext === ".heic" || ext === ".heif") {
      try {
        const heicConvert = await import("heic-convert");
        const inputBuffer = fs.readFileSync(filePath);
        buffer = Buffer.from(await heicConvert.default({
          buffer: inputBuffer,
          format: "JPEG",
          quality: 0.5,
        }));
      } catch {
        buffer = fs.readFileSync(filePath);
      }
    } else {
      buffer = fs.readFileSync(filePath);
    }

    const exifReader = await import("exif-reader");
    const exifData = exifReader.default(buffer);

    let year: string | null = null;
    let month: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;

    const exif = exifData.Photo ?? exifData.Image ?? exifData;

    const dateStr =
      (exif as Record<string, unknown>)?.DateTimeOriginal as string ??
      (exif as Record<string, unknown>)?.DateTime as string ??
      null;

    if (dateStr && typeof dateStr === "string") {
      const match = dateStr.match(/^(\d{4}):(\d{2})/);
      if (match) {
        year = match[1];
        month = match[2];
      }
    }

    const gps = exifData.GPSInfo as Record<string, unknown> | undefined;
    if (gps) {
      const latRef = gps.GPSLatitudeRef as string | undefined;
      const lonRef = gps.GPSLongitudeRef as string | undefined;
      const latArr = gps.GPSLatitude as number[] | undefined;
      const lonArr = gps.GPSLongitude as number[] | undefined;

      if (latArr && lonArr) {
        latitude = dmsToDecimal(latArr);
        longitude = dmsToDecimal(lonArr);
        if (latRef === "S") latitude = -latitude;
        if (lonRef === "W") longitude = -longitude;
      }
    }

    return { year, month, latitude, longitude };
  } catch (err) {
    logger.debug({ err, filePath }, "EXIF parse failed, trying fallback");
    return fallbackDateFromFilename(filePath);
  }
}

/**
 * Extract date from filename as a last-resort fallback
 */
function fallbackDateFromFilename(filePath: string): Partial<ExtractedMetadata> {
  const name = path.basename(filePath);
  const match = name.match(/(\d{4})[_\-:]?(\d{2})/);
  if (match) {
    return { year: match[1], month: match[2] };
  }
  return {};
}

/**
 * Extract metadata from a video file using filename/stat fallback
 * (Full video metadata extraction requires external tools like ffprobe)
 */
async function extractVideoMetadata(filePath: string): Promise<Partial<ExtractedMetadata>> {
  const fallback = fallbackDateFromFilename(filePath);
  if (fallback.year) return fallback;

  try {
    const stat = fs.statSync(filePath);
    const date = stat.mtime;
    return {
      year: String(date.getFullYear()),
      month: String(date.getMonth() + 1).padStart(2, "0"),
    };
  } catch {
    return {};
  }
}

/**
 * Main entry point: extract metadata for any supported file type
 */
export async function extractMetadata(filePath: string): Promise<ExtractedMetadata> {
  const fileType = detectFileType(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const sizeBytes = (() => {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return 0;
    }
  })();

  let partial: Partial<ExtractedMetadata> = {};

  if (fileType === "image") {
    partial = await extractImageMetadata(filePath);
  } else if (fileType === "video") {
    partial = await extractVideoMetadata(filePath);
  }

  return {
    fileType,
    extension,
    year: partial.year ?? null,
    month: partial.month ?? null,
    latitude: partial.latitude ?? null,
    longitude: partial.longitude ?? null,
    sizeBytes,
  };
}

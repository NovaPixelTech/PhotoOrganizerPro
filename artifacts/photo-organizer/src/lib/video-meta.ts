/**
 * Extracts GPS coordinates and creation date from MOV / MP4 video files.
 *
 * Uses multiple strategies in order:
 *  1. exifr with XMP enabled — covers cameras that embed XMP GPS in video
 *  2. ©xyz QuickTime atom scan — iPhone MOV / most Android MP4
 *  3. loci / ©cmt / GPS  atom fallbacks
 *  4. Raw ISO 6709 string scan — last resort, catches any GPS-as-text embedding
 *  5. mvhd atom for creation date (QuickTime Mac epoch)
 *
 * Reads both the START and END of the file so "moov-at-end" MP4s are covered.
 */
import exifr from "exifr";

const MAC_EPOCH_OFFSET_S = 2082844800; // seconds 1904-01-01 → 1970-01-01
const HEAD_BYTES  = 40 * 1024 * 1024;  // 40 MB from start
const TAIL_BYTES  =  5 * 1024 * 1024;  //  5 MB from end

export interface VideoMeta {
  lat: number | null;
  lon: number | null;
  year: string | null;
  month: string | null;
}

// ── File reading ──────────────────────────────────────────────────────────────

async function readBytes(file: File): Promise<{ view: DataView; bytes: Uint8Array }> {
  const headSize = Math.min(file.size, HEAD_BYTES);
  const headBuf  = await file.slice(0, headSize).arrayBuffer();

  const tailSize  = Math.min(file.size, TAIL_BYTES);
  const tailStart = Math.max(headSize, file.size - tailSize);

  let combined: Uint8Array;
  if (tailStart < file.size) {
    const tailBuf = await file.slice(tailStart).arrayBuffer();
    combined = new Uint8Array(headSize + tailBuf.byteLength);
    combined.set(new Uint8Array(headBuf), 0);
    combined.set(new Uint8Array(tailBuf), headSize);
  } else {
    combined = new Uint8Array(headBuf);
  }

  return { view: new DataView(combined.buffer), bytes: combined };
}

// ── Coordinate parsing ────────────────────────────────────────────────────────

/** Parse ISO 6709 GPS: "+37.3321-122.0312..." or degree-minute variant. */
function parseISO6709(chunk: string): { lat: number; lon: number } | null {
  // Decimal degrees (most common: iPhone, GoPro, most Android)
  const d = chunk.match(/([+-])(\d{1,3}\.\d{4,})([+-])(\d{1,3}\.\d{4,})/);
  if (d) {
    const lat = parseFloat(d[1] + d[2]);
    const lon = parseFloat(d[3] + d[4]);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { lat, lon };
    }
  }

  // Degree-minute format: "+DDMM.MMMM+DDDMM.MMMM" (some Sony/Samsung)
  const dm = chunk.match(/([+-])(\d{2})(\d{2}\.\d+)([+-])(\d{3})(\d{2}\.\d+)/);
  if (dm) {
    const ls = dm[1] === "+" ? 1 : -1;
    const lat = ls * (parseInt(dm[2]) + parseFloat(dm[3]) / 60);
    const ws = dm[4] === "+" ? 1 : -1;
    const lon = ws * (parseInt(dm[5]) + parseFloat(dm[6]) / 60);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { lat, lon };
    }
  }

  return null;
}

// ── Atom scanning ─────────────────────────────────────────────────────────────

/**
 * Find a 4-byte marker, then apply a GPS-string regex across the next
 * windowSize bytes decoded as latin-1.  Offset-agnostic — works regardless
 * of size-field convention differences across devices.
 */
function scanMarker(
  bytes: Uint8Array,
  marker: [number, number, number, number],
  windowSize = 160
): { lat: number; lon: number } | null {
  const [b0, b1, b2, b3] = marker;
  for (let i = 0; i < bytes.length - windowSize; i++) {
    if (bytes[i] === b0 && bytes[i+1] === b1 && bytes[i+2] === b2 && bytes[i+3] === b3) {
      const win = new TextDecoder("latin1").decode(bytes.subarray(i + 4, i + 4 + windowSize));
      const gps = parseISO6709(win);
      if (gps) return gps;
    }
  }
  return null;
}

function scanAtoms(bytes: Uint8Array): { lat: number; lon: number } | null {
  // ©xyz (0xA9 'x' 'y' 'z') — iPhone MOV, most Android MP4
  let r = scanMarker(bytes, [0xA9, 0x78, 0x79, 0x7A]);
  if (r) { console.debug("[video-meta] GPS via ©xyz:", r); return r; }

  // loci — 3GPP / some older phones
  r = scanMarker(bytes, [0x6C, 0x6F, 0x63, 0x69]);
  if (r) { console.debug("[video-meta] GPS via loci:", r); return r; }

  // ©cmt — some cameras embed ISO 6709 in the comment field
  r = scanMarker(bytes, [0xA9, 0x63, 0x6D, 0x74]);
  if (r) { console.debug("[video-meta] GPS via ©cmt:", r); return r; }

  // 'GPS ' box (Samsung, some Chinese Android OEMs)
  r = scanMarker(bytes, [0x47, 0x50, 0x53, 0x20]);
  if (r) { console.debug("[video-meta] GPS via 'GPS ':", r); return r; }

  // ©geo — some GoPro / action cameras
  r = scanMarker(bytes, [0xA9, 0x67, 0x65, 0x6F]);
  if (r) { console.debug("[video-meta] GPS via ©geo:", r); return r; }

  return null;
}

/**
 * Last-resort raw scan: look for any ISO 6709-style string (+/-lat +/-lon)
 * anywhere in the file bytes.  Only triggered if atom scan found nothing.
 * Decodes the entire buffer in 4096-byte overlapping chunks.
 */
function rawGpsScan(bytes: Uint8Array): { lat: number; lon: number } | null {
  const CHUNK = 4096;
  const OVERLAP = 40;
  for (let i = 0; i < bytes.length - OVERLAP; i += CHUNK - OVERLAP) {
    const end = Math.min(i + CHUNK, bytes.length);
    const win = new TextDecoder("latin1").decode(bytes.subarray(i, end));
    const gps = parseISO6709(win);
    if (gps) {
      console.debug("[video-meta] GPS via raw scan at offset", i, ":", gps);
      return gps;
    }
  }
  return null;
}

// ── Date extraction ───────────────────────────────────────────────────────────

function macTsToDate(macSecs: number): { year: string; month: string } | null {
  if (macSecs <= 0) return null;
  const d = new Date((macSecs - MAC_EPOCH_OFFSET_S) * 1000);
  if (isNaN(d.getTime()) || d.getFullYear() < 1990 || d.getFullYear() > 2100) return null;
  return { year: String(d.getFullYear()), month: String(d.getMonth() + 1).padStart(2, "0") };
}

function extractMvhdDate(bytes: Uint8Array, view: DataView): { year: string; month: string } | null {
  // 'mvhd' = 0x6D 0x76 0x68 0x64
  for (let i = 0; i < bytes.length - 32; i++) {
    if (bytes[i]===0x6D && bytes[i+1]===0x76 && bytes[i+2]===0x68 && bytes[i+3]===0x64) {
      try {
        const ver = bytes[i + 4];
        const macSecs = ver === 0
          ? view.getUint32(i + 8, false)
          : view.getUint32(i + 8, false) * 0x100000000 + view.getUint32(i + 12, false);
        const d = macTsToDate(macSecs);
        if (d) { console.debug("[video-meta] Date from mvhd:", d); return d; }
      } catch { /* keep */ }
    }
  }
  return null;
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function extractVideoMeta(file: File): Promise<VideoMeta> {
  const result: VideoMeta = { lat: null, lon: null, year: null, month: null };

  console.debug("[video-meta] Processing:", file.name, `(${(file.size/1024/1024).toFixed(1)} MB)`);

  // Strategy 1: exifr with XMP enabled (covers cameras with embedded XMP GPS)
  try {
    const gps = await exifr.gps(file);
    if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
      console.debug("[video-meta] GPS via exifr.gps():", gps);
      result.lat = gps.latitude;
      result.lon = gps.longitude;
    }
  } catch { /* not supported by exifr for this format */ }

  // Strategy 2+: binary atom scanning
  if (result.lat === null) {
    try {
      const { bytes, view } = await readBytes(file);
      console.debug("[video-meta] Read", bytes.length, "bytes");

      // Named atom markers
      const atomGps = scanAtoms(bytes);
      if (atomGps) {
        result.lat = atomGps.lat;
        result.lon = atomGps.lon;
      } else {
        // Raw ISO 6709 scan (fallback)
        const rawGps = rawGpsScan(bytes);
        if (rawGps) {
          result.lat = rawGps.lat;
          result.lon = rawGps.lon;
        }
      }

      // Date from mvhd atom
      const d = extractMvhdDate(bytes, view);
      if (d) { result.year = d.year; result.month = d.month; }
    } catch (err) {
      console.warn("[video-meta] Binary read error:", file.name, err);
    }
  }

  if (result.lat === null) {
    console.debug("[video-meta] No GPS found for:", file.name);
  }

  return result;
}

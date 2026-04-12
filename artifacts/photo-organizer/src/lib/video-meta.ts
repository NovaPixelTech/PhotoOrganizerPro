/**
 * Extracts GPS coordinates and creation date from MOV / MP4 video files by
 * parsing the QuickTime / ISOBMFF binary atom structure directly in the browser.
 *
 * iPhone MOV videos store:
 *   GPS  → moov/udta/©xyz  (ISO 6709 string, e.g. "+37.3321-122.0312+050.000/")
 *   Date → moov/mvhd       (uint32/uint64 seconds since Mac epoch 1904-01-01)
 *
 * Android MP4 videos often use the same ©xyz atom or XMP.
 */

const MAC_EPOCH_OFFSET_S = 2082844800; // seconds between 1904-01-01 and 1970-01-01

export interface VideoMeta {
  lat: number | null;
  lon: number | null;
  year: string | null;
  month: string | null;
}

/**
 * Read up to `limit` bytes from the start of a File, return as DataView + Uint8Array.
 */
async function readChunk(file: File, limit = 30 * 1024 * 1024): Promise<{ view: DataView; bytes: Uint8Array }> {
  const buf = await file.slice(0, Math.min(file.size, limit)).arrayBuffer();
  return { view: new DataView(buf), bytes: new Uint8Array(buf) };
}

/** Parse an ISO 6709 GPS string like "+37.3321-122.0312+050.000/" */
function parseISO6709(s: string): { lat: number; lon: number } | null {
  // Match leading sign + digits/decimal for lat, then the same for lon
  const m = s.match(/^([+-]\d{1,3}(?:\.\d+)?)([+-]\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/** Convert a Mac/QuickTime timestamp (seconds since 1904) to year/month strings. */
function macTsToDate(macSecs: number): { year: string; month: string } | null {
  if (macSecs === 0) return null;
  const unixMs = (macSecs - MAC_EPOCH_OFFSET_S) * 1000;
  const d = new Date(unixMs);
  if (isNaN(d.getTime()) || d.getFullYear() < 1990 || d.getFullYear() > 2100) return null;
  return { year: String(d.getFullYear()), month: String(d.getMonth() + 1).padStart(2, "0") };
}

/**
 * Scan the byte array for the ©xyz atom type bytes (0xA9 x y z) and parse
 * the GPS string that follows.
 *
 * Atom structure after the 4-byte type tag:
 *   [2 bytes BE: string data size including these 4 bytes]
 *   [2 bytes: language code]
 *   [n bytes: GPS string]
 */
function scanForGPS(bytes: Uint8Array, view: DataView): { lat: number; lon: number } | null {
  // ©xyz = 0xA9 0x78 0x79 0x7A
  for (let i = 0; i < bytes.length - 20; i++) {
    if (
      bytes[i]     === 0xA9 &&
      bytes[i + 1] === 0x78 &&
      bytes[i + 2] === 0x79 &&
      bytes[i + 3] === 0x7A
    ) {
      try {
        const payloadLen = view.getUint16(i + 4, false); // big-endian
        const strLen = payloadLen - 4; // subtract the 4 bytes (2 len + 2 lang)
        if (strLen <= 0 || strLen > 200) continue;
        const gpsStr = new TextDecoder("utf-8").decode(bytes.slice(i + 8, i + 8 + strLen)).trim();
        const gps = parseISO6709(gpsStr);
        if (gps) return gps;
      } catch {
        // keep scanning
      }
    }
  }
  return null;
}

/**
 * Walk the QuickTime/ISOBMFF box tree to find the mvhd box and extract
 * the creation timestamp.
 */
function extractMvhdDate(bytes: Uint8Array, view: DataView): { year: string; month: string } | null {
  // 'mvhd' = 0x6D 0x76 0x68 0x64
  for (let i = 0; i < bytes.length - 24; i++) {
    if (
      bytes[i]     === 0x6D &&
      bytes[i + 1] === 0x76 &&
      bytes[i + 2] === 0x68 &&
      bytes[i + 3] === 0x64
    ) {
      try {
        const version = bytes[i + 4]; // 0 = 32-bit timestamps, 1 = 64-bit
        if (version === 0) {
          // creation_time is 4 bytes at offset 8 from start of box type
          const macSecs = view.getUint32(i + 8, false);
          const date = macTsToDate(macSecs);
          if (date) return date;
        } else if (version === 1) {
          // creation_time is 8 bytes — read as two 32-bit halves (high, low)
          const hi = view.getUint32(i + 8,  false);
          const lo = view.getUint32(i + 12, false);
          // Combine, but cap at safe integer range to avoid overflow issues
          const macSecs = hi > 0 ? hi * 0x100000000 + lo : lo;
          const date = macTsToDate(macSecs);
          if (date) return date;
        }
      } catch {
        // keep scanning
      }
    }
  }
  return null;
}

/** Main entry point: extract GPS + date from a video File. */
export async function extractVideoMeta(file: File): Promise<VideoMeta> {
  const result: VideoMeta = { lat: null, lon: null, year: null, month: null };
  try {
    const { bytes, view } = await readChunk(file);
    const gps = scanForGPS(bytes, view);
    if (gps) { result.lat = gps.lat; result.lon = gps.lon; }
    const date = extractMvhdDate(bytes, view);
    if (date) { result.year = date.year; result.month = date.month; }
  } catch {
    // Non-fatal
  }
  return result;
}

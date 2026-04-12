const cache = new Map<string, string | null>();

/**
 * Full address hierarchy returned by Nominatim reverse geocoding.
 * Fields are ordered from most-specific to least-specific.
 * We intentionally skip city/town/village and use the level ABOVE them.
 */
interface NominatimAddress {
  // Island / archipelago — used when the location is on an island
  island?: string;
  archipelago?: string;

  // Administrative levels above city
  county?: string;           // e.g. "Ionian Islands", "Greater London"
  state_district?: string;   // e.g. "North Aegean"
  state?: string;            // e.g. "Attica", "California"
  region?: string;           // used in some countries instead of state

  // City-level — intentionally lower priority; only used as last resort
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  municipality?: string;

  // Country
  country?: string;
}

interface NominatimResult {
  address?: NominatimAddress;
}

/**
 * Pick the "upper hierarchy" location name from a Nominatim address.
 *
 * Priority (highest → lowest):
 *   island > archipelago > county > state_district > state > region
 *   → city / town / village (last resort if nothing above is available)
 */
function pickLocation(addr: NominatimAddress): string | null {
  return (
    addr.island         ??
    addr.archipelago    ??
    addr.county         ??
    addr.state_district ??
    addr.state          ??
    addr.region         ??
    // Last resort: fall back to city-level so files never go to Unknown
    addr.city           ??
    addr.municipality   ??
    addr.town           ??
    addr.village        ??
    null
  );
}

/** Reverse geocode using Nominatim (no API key, browser-safe via CORS). */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  // Cache key rounded to ~1 km precision — avoids hammering Nominatim for
  // nearby shots while still distinguishing different counties / islands.
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    // zoom=8 returns county/island level in display_name, but the full address
    // object always includes all hierarchy levels regardless of zoom.
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=8`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "PhotoOrganizer/1.0",
        },
      }
    );

    if (!res.ok) { cache.set(key, null); return null; }

    const data: NominatimResult = await res.json();
    const addr = data.address;
    if (!addr) { cache.set(key, null); return null; }

    const place   = pickLocation(addr);
    const country = addr.country ?? null;

    const location = place && country
      ? `${place}, ${country}`
      : place ?? country ?? null;

    cache.set(key, location);
    return location;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** Sanitize a string for safe use as a folder / directory name. */
export function safeFolderName(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, "-").trim().slice(0, 60);
}

/** Build the full target folder path for a file. */
export function buildTargetFolder(params: {
  location: string | null;
  year: string | null;
  month: string | null;
  kind: "image" | "video" | "unknown";
}): string {
  const { location, year, month, kind } = params;
  const parts: string[] = ["Organized"];
  parts.push(location ? safeFolderName(location) : "Unknown");
  if (year) {
    parts.push(year);
    parts.push(month ? `${month.padStart(2, "0")}.${year}` : "UnknownMonth");
  } else {
    parts.push("UnknownDate");
  }
  parts.push(kind === "image" ? "Photos" : kind === "video" ? "Videos" : "Other");
  return parts.join("/");
}

const cache = new Map<string, string | null>();

interface NominatimResult {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    country?: string;
  };
}

/** Reverse geocode using Nominatim (no API key required, browser-safe via CORS) */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
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
    const city = addr?.city ?? addr?.town ?? addr?.village ?? addr?.county ?? null;
    const country = addr?.country ?? null;
    const location = city && country ? `${city}, ${country}` : city ?? country ?? null;
    cache.set(key, location);
    return location;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** Sanitize a string for use as a folder name */
export function safeFolderName(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, "-").trim().slice(0, 60);
}

/** Build the target folder path for a file */
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

import axios from "axios";
import { logger } from "./logger";

interface NominatimResponse {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
  display_name?: string;
}

const geocacheMap = new Map<string, string>();

/**
 * Reverse geocode GPS coordinates to a human-readable location using Nominatim (free, no API key needed)
 * Results are cached in memory to avoid rate limiting
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;

  if (geocacheMap.has(key)) {
    return geocacheMap.get(key) ?? null;
  }

  try {
    const response = await axios.get<NominatimResponse>(
      `https://nominatim.openstreetmap.org/reverse`,
      {
        params: {
          lat: latitude,
          lon: longitude,
          format: "json",
          zoom: 10,
        },
        headers: {
          "User-Agent": "PhotoOrganizer/1.0",
          "Accept-Language": "en",
        },
        timeout: 8000,
      }
    );

    const data = response.data;
    const addr = data.address;

    let location: string | null = null;

    if (addr) {
      const city = addr.city ?? addr.town ?? addr.village;
      const country = addr.country;

      if (city && country) {
        location = `${city}, ${country}`;
      } else if (city) {
        location = city;
      } else if (country) {
        location = country;
      }
    }

    if (!location && data.display_name) {
      const parts = data.display_name.split(",");
      if (parts.length >= 2) {
        location = `${parts[0].trim()}, ${parts[parts.length - 1].trim()}`;
      }
    }

    geocacheMap.set(key, location ?? "Unknown Location");
    return location;
  } catch (err) {
    logger.warn({ err, latitude, longitude }, "Reverse geocoding failed");
    return null;
  }
}

/**
 * Sanitize a location string to be safe for use in folder names
 */
export function sanitizeLocationForPath(location: string): string {
  return location
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 64);
}

/**
 * Get the month name formatted as "MM.YYYY" (e.g. "07.2023")
 */
export function formatMonthYear(month: string, year: string): string {
  return `${month.padStart(2, "0")}.${year}`;
}

/**
 * Build the organized path for a file:
 * /Organized/<location>/<year>/<month.year>/<Photos|Videos>/
 */
export function buildOrganizedPath(params: {
  location: string | null;
  year: string | null;
  month: string | null;
  fileType: "image" | "video" | "unknown";
}): string {
  const { location, year, month, fileType } = params;
  const parts: string[] = ["Organized"];

  if (location) {
    parts.push(sanitizeLocationForPath(location));
  } else {
    parts.push("Unknown");
  }

  if (year) {
    parts.push(year);
    if (month) {
      parts.push(formatMonthYear(month, year));
    } else {
      parts.push("UnknownMonth");
    }
  } else {
    parts.push("UnknownDate");
  }

  if (fileType === "image") {
    parts.push("Photos");
  } else if (fileType === "video") {
    parts.push("Videos");
  } else {
    parts.push("Other");
  }

  return parts.join("/");
}

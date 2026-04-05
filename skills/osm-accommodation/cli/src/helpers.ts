// Primary Overpass mirror — more lenient rate limits; kumi.systems is preferred
// Fallback to the main Overpass instance when primary is unavailable
export const OVERPASS_URLS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
]

export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

export interface NominatimResult {
  /** [south, north, west, east] */
  bbox: [number, number, number, number]
  displayName: string
  lat: number
  lon: number
}

export interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags: Record<string, string>
}

export interface OverpassResponse {
  elements: OverpassElement[]
}

export interface Address {
  street: string | null
  postcode: string | null
  city: string | null
  country: string | null
}

export interface Contact {
  phone: string | null
  email: string | null
  website: string | null
}

export interface Amenities {
  wifi: boolean | null
  breakfast: boolean | null
  pool: boolean | null
  parking: boolean | null
  wheelchair: boolean | null
  smoking: string | null
}

export interface Accommodation {
  id: number
  name: string
  type: string
  stars: number | null
  address: Address
  contact: Contact
  amenities: Amenities
  rooms: number | null
  brand: string | null
  description: string | null
  coordinates: { lat: number; lon: number }
  osm_id: number
}

/** Geocode a place name via Nominatim. Returns null if not found. */
export async function nominatimGeocode(query: string): Promise<NominatimResult | null> {
  const url = new URL(NOMINATIM_URL)
  url.searchParams.set("q", query)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "1")

  const response = await fetch(url.toString(), {
    headers: {
      // Required by Nominatim ToS — identify the client
      "User-Agent": "osm-accommodation-cli/1.0",
    },
  })

  if (!response.ok) {
    throw new Error(`Nominatim request failed: ${response.status} ${response.statusText}`)
  }

  const results = (await response.json()) as Array<{
    display_name: string
    lat: string
    lon: string
    boundingbox: [string, string, string, string]
  }>

  if (results.length === 0) return null

  const r = results[0]
  // Nominatim boundingbox order: [south, north, west, east]
  const [south, north, west, east] = r.boundingbox.map(Number) as [number, number, number, number]

  return {
    bbox: [south, north, west, east],
    displayName: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
  }
}

/**
 * Query the Overpass API. Tries the primary mirror first; falls back to the
 * secondary on 5xx / timeout / non-JSON response.
 */
export async function overpassFetch(query: string): Promise<OverpassResponse> {
  let lastError: Error = new Error("Overpass API unavailable (both endpoints failed)")

  for (let i = 0; i < OVERPASS_URLS.length; i++) {
    const url = OVERPASS_URLS[i]
    try {
      const response = await fetch(url, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(35000),
      })

      // 5xx and gateway errors → try next server
      if (response.status >= 500) {
        lastError = new Error(`Overpass server error: ${response.status} ${response.statusText}`)
        continue
      }

      if (!response.ok) {
        throw new Error(`Overpass request failed: ${response.status} ${response.statusText}`)
      }

      // Overpass returns HTML/XML error pages on some failures — not JSON
      const contentType = response.headers.get("content-type") ?? ""
      if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
        lastError = new Error("Overpass returned a non-JSON response (server may be overloaded)")
        continue
      }

      return (await response.json()) as OverpassResponse
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        lastError = new Error(`Overpass request timed out on ${url}`)
        continue
      }
      // Network-level errors (ENOTFOUND etc.) → try next server
      if (err instanceof Error) {
        lastError = err
        continue
      }
      throw err
    }
  }

  throw lastError
}

/** Parse OSM star rating: strips trailing "s" (e.g. "4s" → 4), returns null if absent. */
export function parseStars(raw: string | undefined): number | null {
  if (!raw) return null
  const n = parseInt(raw.replace(/s$/i, ""), 10)
  return isNaN(n) ? null : n
}

/** Build a structured address from OSM addr:* tags. */
export function buildAddress(tags: Record<string, string>): Address {
  const street = tags["addr:street"] ?? null
  const housenumber = tags["addr:housenumber"] ?? null
  let streetLine: string | null = null
  if (street && housenumber) streetLine = `${street} ${housenumber}`
  else if (street) streetLine = street
  else if (housenumber) streetLine = housenumber

  return {
    street: streetLine,
    postcode: tags["addr:postcode"] ?? null,
    city: tags["addr:city"] ?? null,
    country: tags["addr:country"] ?? null,
  }
}

/** Map OSM amenity tags to the documented output shape. */
export function buildAmenities(tags: Record<string, string>): Amenities {
  function parseBool(val: string | undefined): boolean | null {
    if (val === "yes") return true
    if (val === "no") return false
    return null
  }

  const internetAccess = tags["internet_access"]
  let wifi: boolean | null = null
  if (internetAccess === "wlan" || internetAccess === "yes") wifi = true
  else if (internetAccess === "no") wifi = false

  const parkingTag = tags["parking"]
  let parking: boolean | null = null
  if (parkingTag !== undefined) parking = parkingTag !== "no"

  return {
    wifi,
    breakfast: parseBool(tags["breakfast"]),
    pool: parseBool(tags["swimming_pool"]),
    parking,
    wheelchair: parseBool(tags["wheelchair"]),
    smoking: tags["smoking"] ?? null,
  }
}

/** Map a raw Overpass element to the documented Accommodation output shape. */
export function toAccommodation(element: OverpassElement): Accommodation {
  const tags = element.tags
  // Nodes have lat/lon directly; ways/relations use center when queried with "out center"
  const lat = element.lat ?? element.center?.lat ?? 0
  const lon = element.lon ?? element.center?.lon ?? 0

  const roomsRaw = tags["rooms"]
  const roomsParsed = roomsRaw ? parseInt(roomsRaw, 10) : null

  return {
    id: element.id,
    name: tags["name"] ?? "Unknown",
    type: tags["tourism"] ?? "unknown",
    stars: parseStars(tags["stars"]),
    address: buildAddress(tags),
    contact: {
      phone: tags["phone"] ?? null,
      email: tags["email"] ?? null,
      website: tags["website"] ?? null,
    },
    amenities: buildAmenities(tags),
    rooms: roomsParsed !== null && !isNaN(roomsParsed) ? roomsParsed : null,
    brand: tags["brand"] ?? tags["operator"] ?? null,
    description: tags["description"] ?? null,
    coordinates: { lat, lon },
    osm_id: element.id,
  }
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

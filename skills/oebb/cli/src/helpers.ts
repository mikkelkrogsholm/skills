const ENDPOINT = "https://fahrplan.oebb.at/bin/mgate.exe"
const AUTH = { type: "AID", aid: "OWDL4fE4ixNiPBBm" }
const CLIENT = { type: "IPH", id: "OEBB", v: "6030600", name: "oebbPROD-ADHOC" }
const VER = "1.45"

// nationalExpress=1, national=2+4=6, interregional=8+4096=4104, regional=16, suburban=32, bus=64, ferry=128, subway=256, tram=512, onCall=2048
export const PRODUCTS: Record<string, number> = {
  nationalExpress: 1,
  national: 6,      // 2+4
  interregional: 4104, // 8+4096
  regional: 16,
  suburban: 32,
  bus: 64,
  ferry: 128,
  subway: 256,
  tram: 512,
  onCall: 2048,
}

export const ALL_PRODUCTS_BITMASK = 7167

export async function hafasFetch<T>(method: string, req: Record<string, unknown>): Promise<T> {
  const body = {
    auth: AUTH,
    client: CLIENT,
    ver: VER,
    lang: "en",
    svcReqL: [
      {
        meth: method,
        req,
        cfg: { polyEnc: "GPA" },
      },
    ],
  }

  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((resolve) => setTimeout(resolve, delay + jitter))
      delay = Math.min(delay * 2, 5000)
      continue
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const responseBody = await response.json() as {
      err?: string
      errTxt?: string
      svcResL?: Array<{ meth: string; err: string; errTxt?: string; res: T }>
    }

    // Top-level HAFAS errors (e.g. PARSE) have no svcResL at all
    if (responseBody.err && responseBody.err !== "OK") {
      throw new Error(`HAFAS error: ${responseBody.err}${responseBody.errTxt ? ` — ${responseBody.errTxt}` : ""}`)
    }

    if (!responseBody.svcResL?.length) {
      throw new Error("HAFAS returned an empty response")
    }

    const svcRes = responseBody.svcResL[0]
    if (svcRes.err !== "OK") {
      throw new Error(`HAFAS error: ${svcRes.err}${svcRes.errTxt ? ` — ${svcRes.errTxt}` : ""}`)
    }

    return svcRes.res as T
  }

  throw new Error("API request failed after max retries")
}

/** Format a Date to HAFAS date string YYYYMMDD */
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}${m}${d}`
}

/** Format a Date to HAFAS time string HHMMSS */
export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  const s = String(date.getSeconds()).padStart(2, "0")
  return `${h}${m}${s}`
}

/**
 * Parse HAFAS datetime (base date YYYYMMDD + time HHMMSS with possible day-offset prefix).
 * Returns ISO 8601 string in Europe/Vienna timezone.
 * day-offset: if time.length > 6, leading digits are day offset (e.g. "1120000" = next day)
 */
export function parseHafasDateTime(date: string, time: string): string {
  const dayOffset = time.length > 6 ? parseInt(time.slice(0, -6)) : 0
  const hms = time.slice(-6) // always 6 chars: HHMMSS
  const h = hms.slice(0, 2)
  const m = hms.slice(2, 4)
  const s = hms.slice(4, 6)

  // date is YYYYMMDD
  const year = parseInt(date.slice(0, 4))
  const month = parseInt(date.slice(4, 6)) - 1 // 0-indexed
  const day = parseInt(date.slice(6, 8))

  // Create a Date in UTC, then adjust for Vienna timezone using Intl
  const baseDate = new Date(Date.UTC(year, month, day + dayOffset, parseInt(h), parseInt(m), parseInt(s)))

  // Format as ISO 8601 with Europe/Vienna offset
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  })

  const parts = formatter.formatToParts(baseDate)
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? ""

  const yr = getPart("year")
  const mo = getPart("month")
  const dy = getPart("day")
  const hr = getPart("hour") === "24" ? "00" : getPart("hour")
  const mn = getPart("minute")
  const sc = getPart("second")
  const tzName = getPart("timeZoneName") // e.g. "GMT+2" or "GMT+1"

  // Convert "GMT+2" → "+02:00", "GMT+1" → "+01:00"
  let offset = "+01:00"
  const tzMatch = tzName.match(/GMT([+-])(\d+)/)
  if (tzMatch) {
    const sign = tzMatch[1]
    const hours = tzMatch[2].padStart(2, "0")
    offset = `${sign}${hours}:00`
  }

  return `${yr}-${mo}-${dy}T${hr}:${mn}:${sc}${offset}`
}

/** Parse HAFAS coordinates (integer × 1,000,000 → float) */
export function parseCoord(val: number): number {
  return val / 1_000_000
}

/**
 * Build products bitmask from comma-separated product IDs.
 * If products is undefined/empty, returns ALL_PRODUCTS_BITMASK.
 */
export function buildProductsBitmask(products?: string): number {
  if (!products || products.trim() === "") {
    return ALL_PRODUCTS_BITMASK
  }
  const ids = products.split(",").map((p) => p.trim())
  let bitmask = 0
  for (const id of ids) {
    if (id in PRODUCTS) {
      bitmask |= PRODUCTS[id]
    }
  }
  return bitmask === 0 ? ALL_PRODUCTS_BITMASK : bitmask
}

// ── Station name resolution ───────────────────────────────────────────────────

interface LocMatchStation {
  extId?: string
  name: string
  crd?: { x: number; y: number }
}

interface LocMatchResponse {
  match: { locL?: LocMatchStation[] }
}

export interface StationOption {
  id: string
  name: string
}

export class NoStationFoundError extends Error {
  readonly code = "NO_STATION_FOUND"
  readonly hint = "Try a broader search term: stations --query <name>"
  constructor(query: string) {
    super(`No stations found matching "${query}"`)
  }
}

export class AmbiguousStationError extends Error {
  readonly code = "AMBIGUOUS_STATION"
  constructor(readonly query: string, readonly options: StationOption[]) {
    super(`Multiple stations found for "${query}" — please specify one by ID`)
  }
}

/**
 * Resolve a station value to an extId.
 * - If the value is all digits, treat it as an ID and return it directly.
 * - Otherwise, call LocMatch to search by name:
 *   - 0 results → throws NoStationFoundError
 *   - 1 result  → returns its ID
 *   - exact case-insensitive match (ignoring trailing punctuation) → returns that ID
 *   - ambiguous → throws AmbiguousStationError with the full options list
 */
export async function resolveStationId(value: string): Promise<string> {
  const trimmed = value.trim()

  // Already looks like a numeric ID — pass through unchanged
  if (/^\d+$/.test(trimmed)) return trimmed

  const data = await hafasFetch<LocMatchResponse>("LocMatch", {
    input: {
      loc: { type: "S", name: trimmed },
      maxLoc: 10,
      field: "S",
    },
  })

  const allStations: StationOption[] = (data.match.locL ?? [])
    .filter((loc): loc is LocMatchStation & { extId: string } =>
      typeof loc.extId === "string" && loc.extId.length > 0,
    )
    .map((loc) => ({ id: loc.extId, name: loc.name }))

  // Discard results that share no words with the query — HAFAS sometimes returns
  // completely unrelated results for unrecognised inputs via fuzzy fallback.
  const queryWords = trimmed.toLowerCase().split(/\s+/).filter((w) => w.length >= 3)
  const stations =
    queryWords.length > 0
      ? allStations.filter((s) =>
          queryWords.some((w) => s.name.toLowerCase().includes(w)),
        )
      : allStations

  if (stations.length === 0) throw new NoStationFoundError(trimmed)
  if (stations.length === 1) return stations[0].id

  // Look for an exact match (case-insensitive, ignoring trailing dots/spaces)
  const normalize = (s: string) => s.toLowerCase().replace(/[\s.]+$/, "").trim()
  const needle = normalize(trimmed)
  const exact = stations.find((s) => normalize(s.name) === needle)
  if (exact) return exact.id

  throw new AmbiguousStationError(trimmed, stations)
}

/** Write a station resolution error (NoStationFoundError or AmbiguousStationError) to stderr. */
export function writeStationError(err: unknown): void {
  if (err instanceof AmbiguousStationError) {
    process.stderr.write(
      JSON.stringify({
        error: err.message,
        code: err.code,
        hint: "Retry the command using one of the listed station IDs",
        options: err.options,
      }) + "\n",
    )
  } else if (err instanceof NoStationFoundError) {
    writeError(err.message, err.code, err.hint)
  } else {
    writeError(
      err instanceof Error ? err.message : String(err),
      "STATION_RESOLUTION_ERROR",
    )
  }
}

// ── Error helpers ─────────────────────────────────────────────────────────────

/** Write a JSON error object to stderr, with an optional hint for the caller */
export function writeError(error: string, code: string, hint?: string): void {
  const obj: Record<string, string> = { error, code }
  if (hint) obj.hint = hint
  process.stderr.write(JSON.stringify(obj) + "\n")
}

/** Validate YYYY-MM-DD date string. Returns error message or null if valid. */
export function validateDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `Invalid date "${value}" — expected YYYY-MM-DD (e.g. 2025-06-15)`
  }
  const d = new Date(value)
  if (isNaN(d.getTime())) {
    return `Invalid date "${value}" — not a real calendar date`
  }
  return null
}

/** Validate HH:MM time string. Returns error message or null if valid. */
export function validateTime(value: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return `Invalid time "${value}" — expected HH:MM (e.g. 09:30)`
  }
  const [h, m] = value.split(":").map(Number)
  if (h > 23 || m > 59) {
    return `Invalid time "${value}" — hours must be 0–23, minutes 0–59`
  }
  return null
}

/** Validate comma-separated product IDs against known PRODUCTS. Returns error message or null. */
export function validateProducts(value: string): string | null {
  const valid = Object.keys(PRODUCTS)
  const ids = value.split(",").map((p) => p.trim()).filter(Boolean)
  const unknown = ids.filter((id) => !(id in PRODUCTS))
  if (unknown.length > 0) {
    return `Unknown product(s): ${unknown.join(", ")} — valid values: ${valid.join(", ")}`
  }
  return null
}

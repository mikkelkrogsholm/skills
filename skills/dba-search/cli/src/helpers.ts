export const BASE_URL = "https://www.dba.dk"

export const HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0",
  "Accept": "application/json",
  "Accept-Encoding": "gzip, deflate, br",
}

export async function apiFetch<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const maxRetries = 6
  let delay = 500

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url.toString(), { headers: HEADERS })

    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw Object.assign(
          new Error(`Request failed: ${response.status} ${response.statusText}`),
          { code: "API_ERROR" },
        )
      }
      // Exponential backoff with ±50% jitter
      const jitter = delay * (0.5 + Math.random())
      await new Promise((resolve) => setTimeout(resolve, Math.min(delay + jitter, 5000)))
      delay = Math.min(delay * 2, 5000)
      continue
    }

    if (response.status === 404) {
      throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" })
    }

    if (!response.ok) {
      throw Object.assign(
        new Error(`Request failed: ${response.status} ${response.statusText}`),
        { code: "API_ERROR" },
      )
    }

    return response.json() as Promise<T>
  }

  throw Object.assign(new Error("Request failed after max retries"), { code: "API_ERROR" })
}

export function outputResult(data: unknown, format: string): void {
  if (format === "json") {
    console.log(JSON.stringify(data, null, 2))
    return
  }

  if (format === "table") {
    if (Array.isArray(data)) {
      console.table(data)
    } else if (data !== null && typeof data === "object") {
      // Find the first top-level array key and use that
      const obj = data as Record<string, unknown>
      const arrayKey = Object.keys(obj).find((k) => Array.isArray(obj[k]))
      if (arrayKey) {
        console.table(obj[arrayKey])
      } else {
        console.table(data)
      }
    } else {
      console.table(data)
    }
    return
  }

  if (format === "plain") {
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item !== null && typeof item === "object") {
          for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
            if (v !== null && v !== undefined) {
              console.log(`${k}: ${v}`)
            }
          }
        } else {
          console.log(String(item))
        }
        console.log("")
      }
    } else if (data !== null && typeof data === "object") {
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        if (v !== null && v !== undefined) {
          console.log(`${k}: ${JSON.stringify(v)}`)
        }
      }
    } else {
      console.log(String(data))
    }
    return
  }

  // Fallback: JSON
  console.log(JSON.stringify(data, null, 2))
}

export function outputError(error: string, code: string): never {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
  process.exit(1)
}

/**
 * Validates a location or category ID.
 *
 * ID format: `{level}.{seg1}[.{seg2}...]`
 * The first segment is the nesting level (0-indexed). The number of segments
 * after the level must be exactly `level + 1`.
 *
 * Examples:
 *   "0.200009"          → valid   (level 0, 1 segment)
 *   "1.200009.215466"   → valid   (level 1, 2 segments)
 *   "1.200009"          → INVALID (level 1 needs 2 segments, got 1)
 *   "0.200009.215466"   → INVALID (level 0 needs 1 segment, got 2)
 *
 * Returns a human-readable error string on failure, or null if valid.
 */
export function validateId(id: string, idType: "category" | "location"): string | null {
  const browseCmd = idType === "location" ? "locations --tree" : "categories --tree"
  const parts = id.split(".")
  const level = parseInt(parts[0], 10)

  if (isNaN(level) || level < 0 || String(level) !== parts[0]) {
    return `Invalid ${idType} ID "${id}": first segment must be a non-negative integer (the nesting level). Run "${browseCmd}" to browse valid IDs.`
  }

  const segments = parts.slice(1)

  if (segments.length === 0) {
    return `Invalid ${idType} ID "${id}": missing ID segments after the level prefix. Run "${browseCmd}" to browse valid IDs.`
  }

  for (const seg of segments) {
    if (!/^\d+$/.test(seg)) {
      return `Invalid ${idType} ID "${id}": all segments must be numeric. Run "${browseCmd}" to browse valid IDs.`
    }
  }

  const expected = level + 1
  if (segments.length !== expected) {
    return (
      `Invalid ${idType} ID "${id}": nesting level ${level} requires exactly ${expected} ` +
      `segment${expected !== 1 ? "s" : ""} after the prefix, but got ${segments.length}. ` +
      `Run "${browseCmd}" to browse valid IDs.`
    )
  }

  return null
}

/**
 * Given a category code, returns the correct API param name and value.
 *
 * Code format:
 *   0.X         → category       (root level)
 *   1.X.Y       → sub_category   (sub-level)
 *   2.X.Y.Z     → product_category (leaf)
 */
export function categoryParam(code: string): { paramName: string; paramValue: string } {
  const prefix = code.charAt(0)
  switch (prefix) {
    case "0":
      return { paramName: "category", paramValue: code }
    case "1":
      return { paramName: "sub_category", paramValue: code }
    case "2":
      return { paramName: "product_category", paramValue: code }
    default:
      return { paramName: "category", paramValue: code }
  }
}

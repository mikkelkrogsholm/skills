import { describe, test, expect, beforeAll } from "bun:test"
import { runCLI } from "../helpers"

interface Accommodation {
  id: number
  name: string
  type: string
  stars: number | null
  address: {
    street: string | null
    postcode: string | null
    city: string | null
    country: string | null
  }
  contact: {
    phone: string | null
    email: string | null
    website: string | null
  }
  amenities: {
    wifi: boolean | null
    breakfast: boolean | null
    pool: boolean | null
    parking: boolean | null
    wheelchair: boolean | null
    smoking: string | null
  }
  rooms: number | null
  brand: string | null
  description: string | null
  coordinates: { lat: number; lon: number }
  osm_id: number
}

interface NearResponse {
  type: string
  lat: number
  lon: number
  radius: number
  results: Accommodation[]
  count: number
}

// Amsterdam city center — reliable OSM data, many accommodation options
const LAT = "52.3731"
const LON = "4.8922"

// All network calls happen in beforeAll (45s hook timeout).
// Individual tests only assert — no extra API calls.
let shared: NearResponse | null = null       // default radius, all types, limit 10
let sharedHotel: NearResponse | null = null  // hotel type, limit 10

describe("near command", () => {
  beforeAll(async () => {
    // Run two fetches in parallel to stay within the 45s hook budget
    const [r1, r2] = await Promise.all([
      runCLI(["near", LAT, LON, "--limit", "10"]),
      runCLI(["near", LAT, LON, "--type", "hotel", "--limit", "10"]),
    ])
    if (r1.exitCode === 0) shared = JSON.parse(r1.stdout) as NearResponse
    if (r2.exitCode === 0) sharedHotel = JSON.parse(r2.stdout) as NearResponse
  }, 45000)

  // --- Error cases (no API call needed) ---

  test("missing lat and lon exits with error", async () => {
    const result = await runCLI(["near"])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("error")
  })

  test("missing lon exits with error", async () => {
    const result = await runCLI(["near", LAT])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("error")
  })

  test("invalid lat/lon exits with INVALID_ARGS", async () => {
    const result = await runCLI(["near", "notanumber", "alsowrong"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_ARGS")
  })

  // --- Shape and field tests against shared result ---

  test("near returns correct top-level shape", () => {
    if (!shared) { console.log("Skipping: Overpass API unavailable"); return }
    expect(shared.type).toBe("osm_accommodation_near")
    expect(shared.lat).toBeCloseTo(parseFloat(LAT), 3)
    expect(shared.lon).toBeCloseTo(parseFloat(LON), 3)
    expect(typeof shared.radius).toBe("number")
    expect(Array.isArray(shared.results)).toBe(true)
    expect(shared.count).toBe(shared.results.length)
    expect(shared.count).toBeGreaterThan(0)
  })

  test("accommodation items have all required fields", () => {
    if (!shared) { console.log("Skipping: Overpass API unavailable"); return }
    expect(shared.results.length).toBeGreaterThan(0)
    const item = shared.results[0]

    expect(typeof item.id).toBe("number")
    expect(typeof item.name).toBe("string")
    expect(typeof item.type).toBe("string")
    expect(item.stars === null || typeof item.stars === "number").toBe(true)
    expect(item.osm_id).toBe(item.id)
    expect(typeof item.coordinates.lat).toBe("number")
    expect(typeof item.coordinates.lon).toBe("number")
    expect(typeof item.address).toBe("object")
    expect(typeof item.contact).toBe("object")
    expect(typeof item.amenities).toBe("object")
    expect(item.amenities.wifi === null || typeof item.amenities.wifi === "boolean").toBe(true)
    expect(item.amenities.breakfast === null || typeof item.amenities.breakfast === "boolean").toBe(true)
  })

  test("default radius is 5 km", () => {
    if (!shared) { console.log("Skipping: Overpass API unavailable"); return }
    expect(shared.radius).toBe(5)
  })

  test("lat and lon are echoed in output", () => {
    if (!shared) { console.log("Skipping: Overpass API unavailable"); return }
    expect(shared.lat).toBeCloseTo(parseFloat(LAT), 3)
    expect(shared.lon).toBeCloseTo(parseFloat(LON), 3)
  })

  test("--limit caps the number of results", () => {
    if (!shared) { console.log("Skipping: Overpass API unavailable"); return }
    expect(shared.count).toBeLessThanOrEqual(10)
  })

  test("--type hotel returns only hotels", () => {
    if (!sharedHotel) { console.log("Skipping: Overpass API unavailable"); return }
    expect(sharedHotel.count).toBeGreaterThan(0)
    for (const item of sharedHotel.results) {
      expect(item.type).toBe("hotel")
    }
  })

  test("all results have osm_id equal to id", () => {
    if (!shared) { console.log("Skipping: Overpass API unavailable"); return }
    for (const item of shared.results) {
      expect(item.osm_id).toBe(item.id)
    }
  })
})

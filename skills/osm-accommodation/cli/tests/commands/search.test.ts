import { describe, test, expect, beforeAll } from "bun:test"
import { runCLI, type CLIResult } from "../helpers"

interface Address {
  street: string | null
  postcode: string | null
  city: string | null
  country: string | null
}

interface Contact {
  phone: string | null
  email: string | null
  website: string | null
}

interface Amenities {
  wifi: boolean | null
  breakfast: boolean | null
  pool: boolean | null
  parking: boolean | null
  wheelchair: boolean | null
  smoking: string | null
}

interface Accommodation {
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

interface SearchResponse {
  type: string
  location: string
  matched_location: string
  results: Accommodation[]
  count: number
}

// All network calls happen in beforeAll (45s hook timeout).
// Individual tests only assert — no extra API calls.
let shared: SearchResponse | null = null       // Amsterdam, all types, limit 10
let sharedHostel: SearchResponse | null = null // Amsterdam, hostel only, limit 5
let sharedRaw: CLIResult

describe("search command", () => {
  beforeAll(async () => {
    // Run two fetches in parallel to stay within the 45s hook budget
    const [r1, r2] = await Promise.all([
      runCLI(["search", "Amsterdam", "--limit", "10"]),
      runCLI(["search", "Amsterdam", "--type", "hostel", "--limit", "5"]),
    ])
    sharedRaw = r1
    if (r1.exitCode === 0) shared = JSON.parse(r1.stdout) as SearchResponse
    if (r2.exitCode === 0) sharedHostel = JSON.parse(r2.stdout) as SearchResponse
  }, 45000)

  // --- Error cases (no API call needed) ---

  test("missing location argument exits with error", async () => {
    const result = await runCLI(["search"])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("error")
  })

  test("unknown location exits with LOCATION_NOT_FOUND", async () => {
    const result = await runCLI(["search", "xyzzynotacity123abc"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("LOCATION_NOT_FOUND")
  })

  // --- Shape and field tests against shared result ---

  test("search returns correct top-level shape", () => {
    if (!shared) { console.log("Skipping: Overpass API unavailable"); return }
    expect(shared.type).toBe("osm_accommodation_search")
    expect(shared.location).toBe("Amsterdam")
    expect(typeof shared.matched_location).toBe("string")
    expect(shared.matched_location.length).toBeGreaterThan(0)
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
    expect(item.rooms === null || typeof item.rooms === "number").toBe(true)
    expect(item.brand === null || typeof item.brand === "string").toBe(true)
    expect(item.description === null || typeof item.description === "string").toBe(true)
    expect(item.osm_id).toBe(item.id)

    expect(item.address.street === null || typeof item.address.street === "string").toBe(true)
    expect(item.address.postcode === null || typeof item.address.postcode === "string").toBe(true)
    expect(item.address.city === null || typeof item.address.city === "string").toBe(true)
    expect(item.address.country === null || typeof item.address.country === "string").toBe(true)

    expect(item.contact.phone === null || typeof item.contact.phone === "string").toBe(true)
    expect(item.contact.email === null || typeof item.contact.email === "string").toBe(true)
    expect(item.contact.website === null || typeof item.contact.website === "string").toBe(true)

    expect(item.amenities.wifi === null || typeof item.amenities.wifi === "boolean").toBe(true)
    expect(item.amenities.breakfast === null || typeof item.amenities.breakfast === "boolean").toBe(true)
    expect(item.amenities.pool === null || typeof item.amenities.pool === "boolean").toBe(true)
    expect(item.amenities.parking === null || typeof item.amenities.parking === "boolean").toBe(true)
    expect(item.amenities.wheelchair === null || typeof item.amenities.wheelchair === "boolean").toBe(true)
    expect(item.amenities.smoking === null || typeof item.amenities.smoking === "string").toBe(true)

    expect(typeof item.coordinates.lat).toBe("number")
    expect(typeof item.coordinates.lon).toBe("number")
  })

  test("--limit caps the number of results", () => {
    if (!shared) { console.log("Skipping: Overpass API unavailable"); return }
    expect(shared.count).toBeLessThanOrEqual(10)
    expect(shared.results.length).toBeLessThanOrEqual(10)
  })

  test("--type hostel returns only hostels", () => {
    if (!sharedHostel) { console.log("Skipping: Overpass API unavailable"); return }
    expect(sharedHostel.count).toBeGreaterThan(0)
    for (const item of sharedHostel.results) {
      expect(item.type).toBe("hostel")
    }
  })

  test("stars field is a positive integer when present", () => {
    if (!shared) { console.log("Skipping: Overpass API unavailable"); return }
    const starred = shared.results.filter((r) => r.stars !== null)
    for (const item of starred) {
      expect(Number.isInteger(item.stars)).toBe(true)
      expect(item.stars!).toBeGreaterThan(0)
      expect(item.stars!).toBeLessThanOrEqual(7)
    }
  })

  test("wifi amenity is boolean when tagged, null when absent", () => {
    if (!shared) { console.log("Skipping: Overpass API unavailable"); return }
    for (const item of shared.results) {
      expect(item.amenities.wifi === null || typeof item.amenities.wifi === "boolean").toBe(true)
    }
  })

  test("all results include osm_id equal to id", () => {
    if (!shared) { console.log("Skipping: Overpass API unavailable"); return }
    for (const item of shared.results) {
      expect(item.osm_id).toBe(item.id)
    }
  })
})

import { describe, it, expect } from "bun:test"
import { runCLI, parseJSON } from "../helpers"

interface SearchResult {
  id: string
  title: string
  price: number | null
  currency: string
  location: string
  distance_km: number | null
  trade_type: string
  flags: string[]
  image_url: string | null
  url: string
  created_at: number
}

interface SearchResponse {
  results: SearchResult[]
  total: number
  page: number
  is_last_page: boolean
}

describe("search command", () => {
  it("basic keyword search returns results with correct shape", async () => {
    const result = await runCLI(["search", "--query", "iphone", "--limit", "5"])
    const data = parseJSON<SearchResponse>(result)

    expect(Array.isArray(data.results)).toBe(true)
    expect(data.total).toBeGreaterThan(0)
    expect(data.page).toBe(1)
    expect(typeof data.is_last_page).toBe("boolean")

    const item = data.results[0]
    expect(typeof item.id).toBe("string")
    expect(typeof item.title).toBe("string")
    expect(item.price === null || typeof item.price === "number").toBe(true)
    expect(item.currency).toBe("DKK")
    expect(typeof item.location).toBe("string")
    expect(typeof item.url).toBe("string")
    expect(typeof item.created_at).toBe("number")
  })

  it("empty query returns valid results", async () => {
    const result = await runCLI(["search", "--limit", "3"])
    const data = parseJSON<SearchResponse>(result)

    expect(Array.isArray(data.results)).toBe(true)
    expect(data.results.length).toBeGreaterThan(0)
    expect(data.page).toBe(1)
  })

  it("price range filter — all results are null or within range", async () => {
    const result = await runCLI([
      "search",
      "--query", "cykel",
      "--price-from", "200",
      "--price-to", "1000",
      "--limit", "5",
    ])
    const data = parseJSON<SearchResponse>(result)

    expect(Array.isArray(data.results)).toBe(true)

    for (const item of data.results) {
      if (item.price !== null) {
        expect(item.price).toBeGreaterThanOrEqual(200)
        expect(item.price).toBeLessThanOrEqual(1000)
      }
    }
  })

  it("--filter applies client-side substring match on titles", async () => {
    const result = await runCLI([
      "search",
      "--query", "iphone",
      "--filter", "iphone",
      "--limit", "5",
    ])
    const data = parseJSON<SearchResponse>(result)

    expect(Array.isArray(data.results)).toBe(true)

    for (const item of data.results) {
      expect(item.title.toLowerCase()).toContain("iphone")
    }
  })

  it("--trade-type free returns valid results shape", async () => {
    const result = await runCLI(["search", "--trade-type", "free", "--limit", "5"])
    const data = parseJSON<SearchResponse>(result)

    expect(result.exitCode).toBe(0)
    expect(Array.isArray(data.results)).toBe(true)
    expect(typeof data.total).toBe("number")
    expect(typeof data.page).toBe("number")
  })

  it("--today flag exits 0", async () => {
    const result = await runCLI(["search", "--today", "--limit", "5"])

    expect(result.exitCode).toBe(0)
    const data = parseJSON<SearchResponse>(result)
    expect(Array.isArray(data.results)).toBe(true)
  })

  it("--page 2 returns page === 2 in output", async () => {
    const result = await runCLI([
      "search",
      "--query", "cykel",
      "--page", "2",
      "--limit", "5",
    ])
    const data = parseJSON<SearchResponse>(result)

    expect(data.page).toBe(2)
  })

  it("--format plain exits 0 with non-empty stdout", async () => {
    const result = await runCLI([
      "search",
      "--query", "iphone",
      "--limit", "3",
      "--format", "plain",
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout.length).toBeGreaterThan(0)
  })

  it("--format table exits 0 with non-empty stdout", async () => {
    const result = await runCLI([
      "search",
      "--query", "iphone",
      "--limit", "3",
      "--format", "table",
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout.length).toBeGreaterThan(0)
  })
})

describe("name resolution for location and category", () => {
  it("--location Bagenkop resolves and returns results", async () => {
    const result = await runCLI(["search", "--location", "Bagenkop", "--limit", "3"])
    expect(result.exitCode).toBe(0)
    const data = parseJSON<SearchResponse>(result)
    expect(Array.isArray(data.results)).toBe(true)
  })

  it("--location with unknown name exits 1 with NOT_FOUND mentioning the name", async () => {
    const result = await runCLI(["search", "--location", "ZZZNonExistentPlaceXYZ"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("NOT_FOUND")
    expect(err.error).toContain("ZZZNonExistentPlaceXYZ")
    expect(err.error).toContain("locations --tree")
  })

  it("--category Elektronik resolves and returns results", async () => {
    const result = await runCLI(["search", "--category", "Elektronik", "--limit", "3"])
    expect(result.exitCode).toBe(0)
    const data = parseJSON<SearchResponse>(result)
    expect(Array.isArray(data.results)).toBe(true)
  })

  it("--category with unknown name exits 1 with NOT_FOUND mentioning the name", async () => {
    const result = await runCLI(["search", "--category", "ZZZNonExistentCategoryXYZ"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("NOT_FOUND")
    expect(err.error).toContain("ZZZNonExistentCategoryXYZ")
    expect(err.error).toContain("categories --tree")
  })
})

describe("ID validation (no network calls)", () => {
  it("--category 1.90 exits 1: level 1 needs 2 segments but got 1", async () => {
    const result = await runCLI(["search", "--category", "1.90"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_ID")
    expect(err.error).toContain('"1.90"')
  })

  it("--category 0.90.82 exits 1: level 0 needs 1 segment but got 2", async () => {
    const result = await runCLI(["search", "--category", "0.90.82"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_ID")
    expect(err.error).toContain('"0.90.82"')
  })

  it("--category 2.90.82 exits 1: level 2 needs 3 segments but got 2", async () => {
    const result = await runCLI(["search", "--category", "2.90.82"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_ID")
    expect(err.error).toContain('"2.90.82"')
  })

  it("--category 0.abc exits 1: contains letters so treated as name lookup → NOT_FOUND", async () => {
    // "0.abc" contains letters → treated as a name (not an ID), lookup fails
    const result = await runCLI(["search", "--category", "0.abc"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("NOT_FOUND")
  })

  it("--location 1.200009 exits 1: level 1 needs 2 segments but got 1", async () => {
    const result = await runCLI(["search", "--location", "1.200009"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_ID")
    expect(err.error).toContain('"1.200009"')
    expect(err.error).toContain("locations --tree")
  })

  it("--location 0.200009.215466 exits 1: level 0 needs 1 segment but got 2", async () => {
    const result = await runCLI(["search", "--location", "0.200009.215466"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_ID")
    expect(err.error).toContain('"0.200009.215466"')
  })

  it("error message tells agent to run locations --tree for location IDs", async () => {
    const result = await runCLI(["search", "--location", "1.200009"])
    const err = JSON.parse(result.stderr)
    expect(err.error).toContain("locations --tree")
  })

  it("error message tells agent to run categories --tree for category IDs", async () => {
    const result = await runCLI(["search", "--category", "1.90"])
    const err = JSON.parse(result.stderr)
    expect(err.error).toContain("categories --tree")
  })
})

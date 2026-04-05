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

import { describe, it, expect, beforeAll } from "bun:test"
import { runCLI, parseJSON } from "../helpers"

interface DetailLocation {
  city: string
  postal_code: string
  lat: number | null
  lon: number | null
}

interface DetailCategory {
  id: number
  name: string
  path: string[]
}

interface DetailSeller {
  type: string
  is_webstore: boolean
  owner_id: number
}

interface DetailImages {
  count: number
  urls: string[]
}

interface DetailExtra {
  label: string
  value: string
}

interface DetailShipping {
  eligible: boolean
  seller_pays: boolean
  buy_now: boolean
}

interface DetailResponse {
  id: string
  title: string
  description: string
  price: number | null
  currency: string
  location: DetailLocation
  category: DetailCategory
  condition: string | null
  extras: DetailExtra[]
  seller: DetailSeller
  images: DetailImages
  url: string
  last_edited: string
  is_active: boolean
  shipping: DetailShipping
}

let TEST_ID: string

describe("detail command", () => {
  beforeAll(async () => {
    // Fetch a live ad ID so tests don't depend on a hardcoded listing that may expire
    const result = await runCLI(["search", "--limit", "1"])
    const data = parseJSON<{ results: Array<{ id: string }> }>(result)
    if (!data.results.length) throw new Error("No listings returned by search — cannot run detail tests")
    TEST_ID = data.results[0].id
  })
  it("valid ad returns correct top-level shape", async () => {
    const result = await runCLI(["detail", TEST_ID])
    const data = parseJSON<DetailResponse>(result)

    expect(typeof data.id).toBe("string")
    expect(typeof data.title).toBe("string")
    expect(typeof data.description).toBe("string")
    expect(data.price === null || typeof data.price === "number").toBe(true)
    expect(data.currency).toBe("DKK")
    expect(typeof data.url).toBe("string")
    expect(typeof data.is_active).toBe("boolean")
  })

  it("valid ad has correct location shape", async () => {
    const result = await runCLI(["detail", TEST_ID])
    const data = parseJSON<DetailResponse>(result)

    expect(typeof data.location).toBe("object")
    expect(typeof data.location.city).toBe("string")
    expect(typeof data.location.postal_code).toBe("string")
  })

  it("valid ad has correct category shape with path array", async () => {
    const result = await runCLI(["detail", TEST_ID])
    const data = parseJSON<DetailResponse>(result)

    expect(typeof data.category).toBe("object")
    expect(typeof data.category.id).toBe("number")
    expect(typeof data.category.name).toBe("string")
    expect(Array.isArray(data.category.path)).toBe(true)
  })

  it("valid ad has correct seller shape", async () => {
    const result = await runCLI(["detail", TEST_ID])
    const data = parseJSON<DetailResponse>(result)

    expect(typeof data.seller).toBe("object")
    expect(typeof data.seller.type).toBe("string")
    expect(typeof data.seller.is_webstore).toBe("boolean")
    expect(typeof data.seller.owner_id).toBe("number")
  })

  it("images.count matches images.urls length", async () => {
    const result = await runCLI(["detail", TEST_ID])
    const data = parseJSON<DetailResponse>(result)

    expect(typeof data.images).toBe("object")
    expect(typeof data.images.count).toBe("number")
    expect(data.images.count).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(data.images.urls)).toBe(true)
    expect(data.images.urls.length).toBe(data.images.count)
  })

  it("extras is an array where each item has label and value", async () => {
    const result = await runCLI(["detail", TEST_ID])
    const data = parseJSON<DetailResponse>(result)

    expect(Array.isArray(data.extras)).toBe(true)

    for (const extra of data.extras) {
      expect(typeof extra.label).toBe("string")
      expect(typeof extra.value).toBe("string")
    }
  })

  it("url starts with https://www.dba.dk/recommerce/forsale/item/", async () => {
    const result = await runCLI(["detail", TEST_ID])
    const data = parseJSON<DetailResponse>(result)

    expect(data.url.startsWith("https://www.dba.dk/recommerce/forsale/item/")).toBe(true)
  })

  it("invalid ID exits with code 1 and stderr contains INVALID_INPUT", async () => {
    const result = await runCLI(["detail", "notanumber"])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("INVALID_INPUT")
  })

  it("not-found ID exits with code 1 and stderr contains NOT_FOUND or API_ERROR", async () => {
    const result = await runCLI(["detail", "99999999"])

    expect(result.exitCode).toBe(1)
    const hasExpectedCode =
      result.stderr.includes("NOT_FOUND") || result.stderr.includes("API_ERROR")
    expect(hasExpectedCode).toBe(true)
  })

  it("--format plain exits 0 and stdout contains description text", async () => {
    const result = await runCLI(["detail", TEST_ID, "--format", "plain"])

    expect(result.exitCode).toBe(0)
    expect(result.stdout.length).toBeGreaterThan(0)
  })
})

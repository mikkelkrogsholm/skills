import { describe, it, expect } from "bun:test"
import { runCLI, parseJSON } from "../helpers"

interface LocationNode {
  id: string
  name: string
  hits: number
  children?: LocationNode[]
}

interface LocationsResponse {
  path: string[]
  locations: LocationNode[]
}

describe("locations command", () => {
  it("root listing returns path [] and locations array with id, name, hits", async () => {
    const result = await runCLI(["locations"])
    const data = parseJSON<LocationsResponse>(result)

    expect(Array.isArray(data.path)).toBe(true)
    expect(data.path.length).toBe(0)
    expect(Array.isArray(data.locations)).toBe(true)
    expect(data.locations.length).toBeGreaterThan(0)

    const first = data.locations[0]
    expect(typeof first.id).toBe("string")
    expect(typeof first.name).toBe("string")
    expect(typeof first.hits).toBe("number")
  })

  it("path navigation into Bornholm returns non-empty path and locations", async () => {
    const result = await runCLI(["locations", "--path", "Bornholm"])
    const data = parseJSON<LocationsResponse>(result)

    expect(Array.isArray(data.path)).toBe(true)
    expect(data.path.length).toBeGreaterThan(0)
    expect(Array.isArray(data.locations)).toBe(true)
    expect(data.locations.length).toBeGreaterThan(0)
  })

  it("path not found exits with code 1 and stderr contains NOT_FOUND", async () => {
    const result = await runCLI(["locations", "--path", "ZZZNonExistent123"])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("NOT_FOUND")
  })

  it("--tree flag returns locations with children arrays", async () => {
    const result = await runCLI(["locations", "--tree"])
    const data = parseJSON<LocationsResponse>(result)

    expect(Array.isArray(data.locations)).toBe(true)
    expect(data.locations.length).toBeGreaterThan(0)

    const first = data.locations[0]
    expect(Array.isArray(first.children)).toBe(true)
  })

  it("--format table exits 0 with non-empty stdout", async () => {
    const result = await runCLI(["locations", "--format", "table"])

    expect(result.exitCode).toBe(0)
    expect(result.stdout.length).toBeGreaterThan(0)
  })
})

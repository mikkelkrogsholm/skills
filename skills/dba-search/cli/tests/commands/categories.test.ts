import { describe, it, expect } from "bun:test"
import { runCLI, parseJSON } from "../helpers"

interface CategoryNode {
  id: string
  name: string
  hits: number
  children?: CategoryNode[]
}

interface CategoriesResponse {
  path: string[]
  categories: CategoryNode[]
}

describe("categories command", () => {
  it("root listing returns path [] and categories array with id, name, hits", async () => {
    const result = await runCLI(["categories"])
    const data = parseJSON<CategoriesResponse>(result)

    expect(Array.isArray(data.path)).toBe(true)
    expect(data.path.length).toBe(0)
    expect(Array.isArray(data.categories)).toBe(true)
    expect(data.categories.length).toBeGreaterThan(0)

    const first = data.categories[0]
    expect(typeof first.id).toBe("string")
    expect(typeof first.name).toBe("string")
    expect(typeof first.hits).toBe("number")
  })

  it("path navigation into Elektronik returns non-empty path and categories", async () => {
    const result = await runCLI(["categories", "--path", "Elektronik"])
    const data = parseJSON<CategoriesResponse>(result)

    expect(Array.isArray(data.path)).toBe(true)
    expect(data.path.length).toBeGreaterThan(0)
    expect(Array.isArray(data.categories)).toBe(true)
    expect(data.categories.length).toBeGreaterThan(0)
  })

  it("path not found exits with code 1 and stderr contains NOT_FOUND", async () => {
    const result = await runCLI(["categories", "--path", "ZZZNonExistent123"])

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("NOT_FOUND")
  })

  it("--tree flag returns categories with children arrays", async () => {
    const result = await runCLI(["categories", "--tree"])
    const data = parseJSON<CategoriesResponse>(result)

    expect(Array.isArray(data.categories)).toBe(true)
    expect(data.categories.length).toBeGreaterThan(0)

    const first = data.categories[0]
    expect(Array.isArray(first.children)).toBe(true)
  })

  it("--format table exits 0 with non-empty stdout", async () => {
    const result = await runCLI(["categories", "--format", "table"])

    expect(result.exitCode).toBe(0)
    expect(result.stdout.length).toBeGreaterThan(0)
  })
})

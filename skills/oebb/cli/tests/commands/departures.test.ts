import { describe, test, expect } from "bun:test"
import { runCLI, parseJSON } from "../helpers"

interface DepartureItem {
  line: string
  category: string
  direction: string
  when: string
  plannedWhen: string
  delay: number | null
  platform: string | null
  plannedPlatform: string | null
  cancelled: boolean
  tripId: string
}

interface DeparturesResponse {
  type: string
  station: string
  when: string
  departures: DepartureItem[]
  count: number
}

// Wien Hbf — busy station with many departures
const STATION = "1190100"

describe("departures command", () => {
  test("missing --station exits with error", async () => {
    const result = await runCLI(["departures"])
    expect(result.exitCode).toBe(1)
    expect(result.stderr.toLowerCase()).toContain("error")
  })

  test("basic shape is correct", async () => {
    const result = await runCLI(["departures", "--station", STATION, "--results", "5"])
    const data = parseJSON<DeparturesResponse>(result)

    expect(data.type).toBe("oebb_departures")
    expect(data.station).toBe(STATION)
    expect(typeof data.when).toBe("string")
    expect(Array.isArray(data.departures)).toBe(true)
    expect(data.count).toBe(data.departures.length)
  })

  test("departure items have all expected fields", async () => {
    const result = await runCLI(["departures", "--station", STATION, "--results", "5"])
    const data = parseJSON<DeparturesResponse>(result)

    expect(data.departures.length).toBeGreaterThan(0)
    const dep = data.departures[0]

    expect(typeof dep.line).toBe("string")
    expect(dep.line.length).toBeGreaterThan(0)
    expect(typeof dep.category).toBe("string")
    expect(dep.category.length).toBeGreaterThan(0)
    expect(typeof dep.direction).toBe("string")
    expect(typeof dep.when).toBe("string")
    expect(typeof dep.plannedWhen).toBe("string")
    expect(typeof dep.cancelled).toBe("boolean")
    expect(typeof dep.tripId).toBe("string")
  })

  test("when and plannedWhen are ISO 8601 strings", async () => {
    const result = await runCLI(["departures", "--station", STATION, "--results", "5"])
    const data = parseJSON<DeparturesResponse>(result)

    expect(data.departures.length).toBeGreaterThan(0)
    const dep = data.departures[0]
    expect(new Date(dep.when).getTime()).not.toBeNaN()
    expect(new Date(dep.plannedWhen).getTime()).not.toBeNaN()
  })

  test("delay is number or null", async () => {
    const result = await runCLI(["departures", "--station", STATION, "--results", "5"])
    const data = parseJSON<DeparturesResponse>(result)

    for (const dep of data.departures) {
      expect(dep.delay === null || typeof dep.delay === "number").toBe(true)
    }
  })

  test("platform is string or null", async () => {
    const result = await runCLI(["departures", "--station", STATION, "--results", "5"])
    const data = parseJSON<DeparturesResponse>(result)

    for (const dep of data.departures) {
      expect(dep.platform === null || typeof dep.platform === "string").toBe(true)
      expect(dep.plannedPlatform === null || typeof dep.plannedPlatform === "string").toBe(true)
    }
  })

  test("--results limits departure count", async () => {
    const result = await runCLI(["departures", "--station", STATION, "--results", "5"])
    const data = parseJSON<DeparturesResponse>(result)
    expect(data.count).toBeLessThanOrEqual(5)
    expect(data.departures.length).toBeLessThanOrEqual(5)
  })

  test("count matches departures array length", async () => {
    const result = await runCLI(["departures", "--station", STATION, "--results", "5"])
    const data = parseJSON<DeparturesResponse>(result)
    expect(data.count).toBe(data.departures.length)
  })

  test("Salzburg Hbf also returns departures", async () => {
    const result = await runCLI(["departures", "--station", "8100002", "--results", "3"])
    const data = parseJSON<DeparturesResponse>(result)

    expect(data.type).toBe("oebb_departures")
    expect(data.station).toBe("8100002")
    expect(data.count).toBeGreaterThan(0)
  })

  test("--format table exits with code 0", async () => {
    const result = await runCLI(["departures", "--station", STATION, "--results", "3", "--format", "table"])
    expect(result.exitCode).toBe(0)
  })

  test("--format plain exits with code 0", async () => {
    const result = await runCLI(["departures", "--station", STATION, "--results", "3", "--format", "plain"])
    expect(result.exitCode).toBe(0)
  })

  test("invalid --when exits with INVALID_WHEN error", async () => {
    const result = await runCLI(["departures", "--station", STATION, "--when", "not-a-date"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_WHEN")
  })

  test("unknown --products value exits with INVALID_PRODUCTS error", async () => {
    const result = await runCLI(["departures", "--station", STATION, "--products", "spaceship"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_PRODUCTS")
  })

  test("--products nationalExpress returns valid shape", async () => {
    const result = await runCLI(["departures", "--station", STATION, "--results", "5", "--products", "nationalExpress"])
    const data = parseJSON<DeparturesResponse>(result)
    expect(data.type).toBe("oebb_departures")
    expect(Array.isArray(data.departures)).toBe(true)
    expect(data.count).toBe(data.departures.length)
  })
})

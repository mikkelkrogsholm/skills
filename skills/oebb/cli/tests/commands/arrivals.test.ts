import { describe, test, expect } from "bun:test"
import { runCLI, parseJSON } from "../helpers"

interface ArrivalItem {
  line: string
  category: string
  origin: string
  when: string
  plannedWhen: string
  delay: number | null
  platform: string | null
  plannedPlatform: string | null
  cancelled: boolean
  tripId: string
}

interface ArrivalsResponse {
  type: string
  station: string
  when: string
  arrivals: ArrivalItem[]
  count: number
}

// Wien Hbf — busy station with many arrivals
const STATION = "1190100"

describe("arrivals command", () => {
  test("missing --station exits with error", async () => {
    const result = await runCLI(["arrivals"])
    expect(result.exitCode).toBe(1)
    expect(result.stderr.toLowerCase()).toContain("error")
  })

  test("basic shape is correct", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--results", "5"])
    const data = parseJSON<ArrivalsResponse>(result)

    expect(data.type).toBe("oebb_arrivals")
    expect(data.station).toBe(STATION)
    expect(typeof data.when).toBe("string")
    expect(Array.isArray(data.arrivals)).toBe(true)
    expect(data.count).toBe(data.arrivals.length)
  })

  test("arrival items have all expected fields", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--results", "5"])
    const data = parseJSON<ArrivalsResponse>(result)

    expect(data.arrivals.length).toBeGreaterThan(0)
    const arr = data.arrivals[0]

    expect(typeof arr.line).toBe("string")
    expect(arr.line.length).toBeGreaterThan(0)
    expect(typeof arr.category).toBe("string")
    expect(arr.category.length).toBeGreaterThan(0)
    // origin is the source station name — string (not direction)
    expect(typeof arr.origin).toBe("string")
    expect(typeof arr.when).toBe("string")
    expect(typeof arr.plannedWhen).toBe("string")
    expect(typeof arr.cancelled).toBe("boolean")
    expect(typeof arr.tripId).toBe("string")
  })

  test("arrivals use 'origin' field not 'direction'", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--results", "5"])
    const data = parseJSON<ArrivalsResponse>(result)

    expect(data.arrivals.length).toBeGreaterThan(0)
    const arr = data.arrivals[0]
    // Must have 'origin', must NOT have 'direction'
    expect("origin" in arr).toBe(true)
    expect("direction" in arr).toBe(false)
  })

  test("when and plannedWhen are ISO 8601 strings", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--results", "5"])
    const data = parseJSON<ArrivalsResponse>(result)

    expect(data.arrivals.length).toBeGreaterThan(0)
    const arr = data.arrivals[0]
    expect(new Date(arr.when).getTime()).not.toBeNaN()
    expect(new Date(arr.plannedWhen).getTime()).not.toBeNaN()
  })

  test("delay is number or null", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--results", "5"])
    const data = parseJSON<ArrivalsResponse>(result)

    for (const arr of data.arrivals) {
      expect(arr.delay === null || typeof arr.delay === "number").toBe(true)
    }
  })

  test("platform is string or null", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--results", "5"])
    const data = parseJSON<ArrivalsResponse>(result)

    for (const arr of data.arrivals) {
      expect(arr.platform === null || typeof arr.platform === "string").toBe(true)
      expect(arr.plannedPlatform === null || typeof arr.plannedPlatform === "string").toBe(true)
    }
  })

  test("--results limits arrival count", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--results", "5"])
    const data = parseJSON<ArrivalsResponse>(result)
    expect(data.count).toBeLessThanOrEqual(5)
    expect(data.arrivals.length).toBeLessThanOrEqual(5)
  })

  test("count matches arrivals array length", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--results", "5"])
    const data = parseJSON<ArrivalsResponse>(result)
    expect(data.count).toBe(data.arrivals.length)
  })

  test("Salzburg Hbf also returns arrivals", async () => {
    const result = await runCLI(["arrivals", "--station", "8100002", "--results", "3"])
    const data = parseJSON<ArrivalsResponse>(result)

    expect(data.type).toBe("oebb_arrivals")
    expect(data.station).toBe("8100002")
    expect(data.count).toBeGreaterThan(0)
  })

  test("--format table exits with code 0", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--results", "3", "--format", "table"])
    expect(result.exitCode).toBe(0)
  })

  test("--format plain exits with code 0", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--results", "3", "--format", "plain"])
    expect(result.exitCode).toBe(0)
  })

  test("invalid --when exits with INVALID_WHEN error", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--when", "not-a-date"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_WHEN")
  })

  test("unknown --products value exits with INVALID_PRODUCTS error", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--products", "spaceship"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_PRODUCTS")
  })

  test("--products nationalExpress returns valid shape", async () => {
    const result = await runCLI(["arrivals", "--station", STATION, "--results", "5", "--products", "nationalExpress"])
    const data = parseJSON<ArrivalsResponse>(result)
    expect(data.type).toBe("oebb_arrivals")
    expect(Array.isArray(data.arrivals)).toBe(true)
    expect(data.count).toBe(data.arrivals.length)
  })
})

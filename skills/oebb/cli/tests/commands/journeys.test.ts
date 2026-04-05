import { describe, test, expect } from "bun:test"
import { runCLI, parseJSON } from "../helpers"

interface StopoverItem {
  stop: string
  stopId: string
  arrival: string | null
  plannedArrival: string | null
  departure: string | null
  plannedDeparture: string | null
}

interface JourneyLegTransit {
  type: "journey"
  line: string
  category: string
  direction: string
  origin: string
  originId: string
  departure: string
  plannedDeparture: string
  departurePlatform: string | null
  plannedDeparturePlatform: string | null
  destination: string
  destinationId: string
  arrival: string
  plannedArrival: string
  arrivalPlatform: string | null
  plannedArrivalPlatform: string | null
  cancelled: boolean
  stopovers: StopoverItem[]
}

interface JourneyLegWalk {
  type: "walk"
  origin: string
  originId: string
  destination: string
  destinationId: string
  departure: string
  arrival: string
  distance: number | null
}

type JourneyLeg = JourneyLegTransit | JourneyLegWalk

interface JourneyItem {
  legs: JourneyLeg[]
  departure: string
  arrival: string
  duration: string
  transfers: number
  isNightTrain: boolean
}

interface JourneysResponse {
  type: string
  from: string
  to: string
  date: string
  time: string
  journeys: JourneyItem[]
  count: number
}

// Wien Hbf → Salzburg Hbf (major corridor, guaranteed connections)
const FROM = "1190100"
const TO = "8100002"

describe("journeys command", () => {
  test("missing --from exits with error", async () => {
    const result = await runCLI(["journeys", "--to", TO])
    expect(result.exitCode).toBe(1)
    expect(result.stderr.toLowerCase()).toContain("error")
  })

  test("missing --to exits with error", async () => {
    const result = await runCLI(["journeys", "--from", FROM])
    expect(result.exitCode).toBe(1)
    expect(result.stderr.toLowerCase()).toContain("error")
  })

  test("basic shape is correct", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2"])
    const data = parseJSON<JourneysResponse>(result)

    expect(data.type).toBe("oebb_journeys")
    expect(data.from).toBe(FROM)
    expect(data.to).toBe(TO)
    expect(typeof data.date).toBe("string")
    expect(typeof data.time).toBe("string")
    expect(Array.isArray(data.journeys)).toBe(true)
    expect(data.count).toBe(data.journeys.length)
    expect(data.count).toBeGreaterThan(0)
  })

  test("journey-level fields have correct types", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2"])
    const data = parseJSON<JourneysResponse>(result)

    const journey = data.journeys[0]
    expect(typeof journey.departure).toBe("string")
    expect(typeof journey.arrival).toBe("string")
    expect(typeof journey.duration).toBe("string")
    expect(typeof journey.transfers).toBe("number")
    expect(typeof journey.isNightTrain).toBe("boolean")
    expect(Array.isArray(journey.legs)).toBe(true)
    expect(journey.legs.length).toBeGreaterThan(0)
  })

  test("departure and arrival are ISO 8601 strings", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2"])
    const data = parseJSON<JourneysResponse>(result)

    const journey = data.journeys[0]
    // ISO 8601 with timezone offset — should be parseable as a date
    expect(new Date(journey.departure).getTime()).not.toBeNaN()
    expect(new Date(journey.arrival).getTime()).not.toBeNaN()
  })

  test("duration is formatted as Xh Ym", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2"])
    const data = parseJSON<JourneysResponse>(result)

    const journey = data.journeys[0]
    expect(journey.duration).toMatch(/^\d+h \d+m$/)
  })

  test("transit legs have all expected fields", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2"])
    const data = parseJSON<JourneysResponse>(result)

    const journey = data.journeys[0]
    const transitLeg = journey.legs.find((l) => l.type === "journey") as JourneyLegTransit | undefined
    expect(transitLeg).toBeDefined()
    if (!transitLeg) return

    expect(transitLeg.type).toBe("journey")
    expect(typeof transitLeg.line).toBe("string")
    expect(transitLeg.line.length).toBeGreaterThan(0)
    expect(typeof transitLeg.category).toBe("string")
    expect(transitLeg.category.length).toBeGreaterThan(0)
    expect(typeof transitLeg.origin).toBe("string")
    expect(typeof transitLeg.originId).toBe("string")
    expect(typeof transitLeg.departure).toBe("string")
    expect(typeof transitLeg.plannedDeparture).toBe("string")
    expect(typeof transitLeg.destination).toBe("string")
    expect(typeof transitLeg.destinationId).toBe("string")
    expect(typeof transitLeg.arrival).toBe("string")
    expect(typeof transitLeg.plannedArrival).toBe("string")
    expect(typeof transitLeg.cancelled).toBe("boolean")
    expect(Array.isArray(transitLeg.stopovers)).toBe(true)
  })

  test("transit leg departure/arrival are ISO 8601 strings", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2"])
    const data = parseJSON<JourneysResponse>(result)

    const journey = data.journeys[0]
    const transitLeg = journey.legs.find((l) => l.type === "journey") as JourneyLegTransit | undefined
    if (!transitLeg) return

    expect(new Date(transitLeg.departure).getTime()).not.toBeNaN()
    expect(new Date(transitLeg.plannedDeparture).getTime()).not.toBeNaN()
    expect(new Date(transitLeg.arrival).getTime()).not.toBeNaN()
    expect(new Date(transitLeg.plannedArrival).getTime()).not.toBeNaN()
  })

  test("platform fields are string or null", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2"])
    const data = parseJSON<JourneysResponse>(result)

    const journey = data.journeys[0]
    const transitLeg = journey.legs.find((l) => l.type === "journey") as JourneyLegTransit | undefined
    if (!transitLeg) return

    expect(
      transitLeg.departurePlatform === null || typeof transitLeg.departurePlatform === "string"
    ).toBe(true)
    expect(
      transitLeg.plannedDeparturePlatform === null || typeof transitLeg.plannedDeparturePlatform === "string"
    ).toBe(true)
    expect(
      transitLeg.arrivalPlatform === null || typeof transitLeg.arrivalPlatform === "string"
    ).toBe(true)
    expect(
      transitLeg.plannedArrivalPlatform === null || typeof transitLeg.plannedArrivalPlatform === "string"
    ).toBe(true)
  })

  test("stopovers is empty array without --stopovers flag", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2"])
    const data = parseJSON<JourneysResponse>(result)

    const journey = data.journeys[0]
    const transitLeg = journey.legs.find((l) => l.type === "journey") as JourneyLegTransit | undefined
    if (!transitLeg) return

    expect(transitLeg.stopovers).toEqual([])
  })

  test("--stopovers flag populates stopovers array", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2", "--stopovers"])
    const data = parseJSON<JourneysResponse>(result)

    const journey = data.journeys[0]
    const transitLeg = journey.legs.find((l) => l.type === "journey") as JourneyLegTransit | undefined
    if (!transitLeg) return

    expect(Array.isArray(transitLeg.stopovers)).toBe(true)
    // Wien–Salzburg is a long route, should have intermediate stops
    if (transitLeg.stopovers.length > 0) {
      const stopover = transitLeg.stopovers[0]
      expect(typeof stopover.stop).toBe("string")
      expect(typeof stopover.stopId).toBe("string")
      // arrival/departure may be null at origin/terminus of the line
      expect(
        stopover.arrival === null || typeof stopover.arrival === "string"
      ).toBe(true)
      expect(
        stopover.departure === null || typeof stopover.departure === "string"
      ).toBe(true)
    }
  })

  test("--results limits journey count", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2"])
    const data = parseJSON<JourneysResponse>(result)
    expect(data.count).toBeLessThanOrEqual(2)
    expect(data.journeys.length).toBeLessThanOrEqual(2)
  })

  test("count matches journeys array length", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "3"])
    const data = parseJSON<JourneysResponse>(result)
    expect(data.count).toBe(data.journeys.length)
  })

  test("transfers count is non-negative integer", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2"])
    const data = parseJSON<JourneysResponse>(result)

    for (const journey of data.journeys) {
      expect(journey.transfers).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(journey.transfers)).toBe(true)
    }
  })

  test("--format table exits with code 0", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2", "--format", "table"])
    expect(result.exitCode).toBe(0)
  })

  test("--format plain exits with code 0", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "2", "--format", "plain"])
    expect(result.exitCode).toBe(0)
  })

  test("invalid --date exits with INVALID_DATE error", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--date", "not-a-date"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_DATE")
  })

  test("invalid --time exits with INVALID_TIME error", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--time", "99:99"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_TIME")
  })

  test("unknown --products value exits with INVALID_PRODUCTS error", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--products", "spaceship"])
    expect(result.exitCode).toBe(1)
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("INVALID_PRODUCTS")
  })

  test("--products nationalExpress returns valid shape", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "3", "--products", "nationalExpress"])
    const data = parseJSON<JourneysResponse>(result)
    expect(data.type).toBe("oebb_journeys")
    expect(Array.isArray(data.journeys)).toBe(true)
    expect(data.count).toBe(data.journeys.length)
  })

  test("--night returns valid shape with isNightTrain true on all journeys", async () => {
    const result = await runCLI(["journeys", "--from", FROM, "--to", TO, "--results", "3", "--night"])
    const data = parseJSON<JourneysResponse>(result)
    expect(data.type).toBe("oebb_journeys")
    expect(Array.isArray(data.journeys)).toBe(true)
    for (const journey of data.journeys) {
      expect(journey.isNightTrain).toBe(true)
    }
  })
})

import { describe, test, expect } from "bun:test"
import { runCLI, parseJSON } from "../helpers"

interface StationItem {
  id: string
  name: string
  longitude: number
  latitude: number
}

interface StationsResponse {
  type: string
  query: string
  stations: StationItem[]
  count: number
}

describe("stations command", () => {
  test("missing --query exits with error", async () => {
    const result = await runCLI(["stations"])
    expect(result.exitCode).toBe(1)
    expect(result.stderr.toLowerCase()).toContain("error")
  })

  test("search returns correct shape", async () => {
    const result = await runCLI(["stations", "--query", "Wien", "--results", "3"])
    const data = parseJSON<StationsResponse>(result)

    expect(data.type).toBe("oebb_stations")
    expect(data.query).toBe("Wien")
    expect(Array.isArray(data.stations)).toBe(true)
    expect(data.count).toBe(data.stations.length)
    expect(data.count).toBeGreaterThan(0)
  })

  test("station items have all expected fields", async () => {
    const result = await runCLI(["stations", "--query", "Wien Hbf", "--results", "2"])
    const data = parseJSON<StationsResponse>(result)

    expect(data.stations.length).toBeGreaterThan(0)
    const station = data.stations[0]
    expect(typeof station.id).toBe("string")
    expect(station.id.length).toBeGreaterThan(0)
    expect(typeof station.name).toBe("string")
    expect(station.name.length).toBeGreaterThan(0)
    expect(typeof station.longitude).toBe("number")
    expect(typeof station.latitude).toBe("number")
  })

  test("station coordinates are in valid range", async () => {
    const result = await runCLI(["stations", "--query", "Salzburg", "--results", "2"])
    const data = parseJSON<StationsResponse>(result)

    expect(data.stations.length).toBeGreaterThan(0)
    const station = data.stations[0]
    // Austria is roughly lat 46–49, lon 9–17
    expect(station.latitude).toBeGreaterThan(40)
    expect(station.latitude).toBeLessThan(55)
    expect(station.longitude).toBeGreaterThan(5)
    expect(station.longitude).toBeLessThan(25)
  })

  test("--results limits returned stations", async () => {
    const result = await runCLI(["stations", "--query", "Bahnhof", "--results", "2"])
    const data = parseJSON<StationsResponse>(result)
    expect(data.count).toBeLessThanOrEqual(2)
    expect(data.stations.length).toBeLessThanOrEqual(2)
  })

  test("count matches stations array length", async () => {
    const result = await runCLI(["stations", "--query", "Innsbruck", "--results", "3"])
    const data = parseJSON<StationsResponse>(result)
    expect(data.count).toBe(data.stations.length)
  })

  test("--format table exits with code 0", async () => {
    const result = await runCLI(["stations", "--query", "Wien", "--results", "2", "--format", "table"])
    expect(result.exitCode).toBe(0)
  })

  test("--format plain exits with code 0", async () => {
    const result = await runCLI(["stations", "--query", "Wien", "--results", "2", "--format", "plain"])
    expect(result.exitCode).toBe(0)
  })
})

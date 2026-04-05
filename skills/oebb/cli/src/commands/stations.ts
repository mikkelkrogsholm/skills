import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { hafasFetch, parseCoord, writeError } from "../helpers.js"

interface LocMatchResponse {
  match: {
    locL: Array<{
      extId?: string
      name: string
      crd: {
        x: number
        y: number
      }
    }>
  }
}

interface StationItem {
  id: string
  name: string
  longitude: number
  latitude: number
}

export const stations = defineCommand({
  name: "stations",
  description: "Search for stations and stops by name",
  options: {
    query: option(z.string().optional(), {
      description: "Station name to search (required)",
    }),
    results: option(z.coerce.number().default(10), {
      description: "Max results (1–50, default: 10)",
    }),
    format: option(z.enum(["json", "table", "plain"]).default("plain"), {
      description: "Output format: json, table, plain",
    }),
  },
  handler: async ({ flags, signal }) => {
    if (signal.aborted) return

    if (!flags.query) {
      writeError(
        "--query is required",
        "MISSING_QUERY",
        "Provide a station name to search for, e.g.: stations --query Vienna",
      )
      process.exit(1)
    }

    try {
      const data = await hafasFetch<LocMatchResponse>("LocMatch", {
        input: {
          loc: { type: "S", name: flags.query },
          maxLoc: flags.results,
          field: "S",
        },
      })

      if (signal.aborted) return

      const stationItems: StationItem[] = (data.match.locL ?? [])
        .filter((loc) => loc.extId && loc.extId.length > 0)
        .map((loc) => ({
          id: loc.extId!,
          name: loc.name,
          longitude: parseCoord(loc.crd.x),
          latitude: parseCoord(loc.crd.y),
        }))

      const output = {
        type: "oebb_stations",
        query: flags.query,
        stations: stationItems,
        count: stationItems.length,
      }

      if (flags.format === "json") {
        console.log(JSON.stringify(output, null, 2))
      } else if (flags.format === "table") {
        console.log("ID          Name")
        for (const s of stationItems) {
          const id = s.id.padEnd(11)
          console.log(`${id} ${s.name}`)
        }
      } else {
        // plain
        for (const s of stationItems) {
          console.log(s.name)
          console.log(`  ID:        ${s.id}`)
          console.log(`  Longitude: ${s.longitude}`)
          console.log(`  Latitude:  ${s.latitude}`)
          console.log("")
        }
      }
    } catch (err) {
      writeError(err instanceof Error ? err.message : String(err), "API_ERROR")
      process.exit(1)
    }
  },
})

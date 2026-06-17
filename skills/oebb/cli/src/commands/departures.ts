import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import {
  hafasFetch,
  formatDate,
  formatTime,
  parseHafasDateTime,
  buildProductsBitmask,
  writeError,
  validateProducts,
  resolveStationId,
  writeStationError,
} from "../helpers.js"

// ── HAFAS response types ──────────────────────────────────────────────────────

interface HafasPlatform {
  type?: string
  txt?: string
}

interface HafasStbStop {
  locX?: number
  dTimeS?: string
  dTimeR?: string
  dPltfS?: HafasPlatform | string
  dPlatfS?: HafasPlatform | string
  dPltfR?: HafasPlatform | string
  dPlatfR?: HafasPlatform | string
  dCncl?: boolean
}

interface HafasJny {
  stbStop: HafasStbStop
  prodX: number
  dirTxt?: string
  date: string
  jid?: string
}

interface HafasProduct {
  name: string
  cls?: number
  prodCtx?: {
    catOut?: string
    catOutS?: string
  }
  oprX?: number
}

interface HafasCommon {
  locL: Array<{ name: string; extId?: string }>
  prodL: HafasProduct[]
  opL?: Array<{ name: string }>
}

interface StationBoardRes {
  common: HafasCommon
  jnyL?: HafasJny[]
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Extract platform text from a HAFAS platform value (object or string) */
function getPlatformText(plt?: HafasPlatform | string): string | null {
  if (plt == null) return null
  if (typeof plt === "string") return plt.trim() || null
  return plt.txt?.trim() || null
}

/**
 * Compute departure delay in seconds between realtime and scheduled times.
 * Returns null if realtime time is unavailable.
 */
function computeDelay(date: string, dTimeS?: string, dTimeR?: string): number | null {
  if (!dTimeR || !dTimeS) return null
  const planned = new Date(parseHafasDateTime(date, dTimeS)).getTime()
  const realtime = new Date(parseHafasDateTime(date, dTimeR)).getTime()
  return Math.round((realtime - planned) / 1000)
}

// ── output types ──────────────────────────────────────────────────────────────

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

// ── command ───────────────────────────────────────────────────────────────────

export const departures = defineCommand({
  name: "departures",
  description: "Show upcoming departures from a station",
  options: {
    station: option(z.string().optional(), {
      description: "Station name or ID (required)",
    }),
    when: option(z.string().optional(), {
      description: "Date and time YYYY-MM-DDTHH:MM (default: now)",
    }),
    duration: option(z.coerce.number().default(60), {
      description: "Time window in minutes (default: 60)",
    }),
    results: option(z.coerce.number().default(20), {
      description: "Max results (default: 20)",
    }),
    products: option(z.string().optional(), {
      description: "Comma-separated product IDs to include",
    }),
    format: option(z.enum(["json", "table", "plain"]).default("plain"), {
      description: "Output format: json, table, plain",
    }),
  },
  handler: async ({ flags, signal }) => {
    if (signal.aborted) return

    if (!flags.station) {
      writeError(
        "--station is required (station name or ID)",
        "MISSING_STATION",
        "Provide a station name (e.g. --station \"Odense St\") or numeric ID",
      )
      process.exit(1)
    }
    if (flags.when && isNaN(new Date(flags.when).getTime())) {
      writeError(
        `Invalid --when "${flags.when}" — expected YYYY-MM-DDTHH:MM (e.g. 2025-06-15T09:30)`,
        "INVALID_WHEN",
      )
      process.exit(1)
    }
    if (flags.products) {
      const err = validateProducts(flags.products)
      if (err) { writeError(err, "INVALID_PRODUCTS"); process.exit(1) }
    }

    // Resolve station name → ID (pass-through if already numeric)
    let stationId: string
    try {
      stationId = await resolveStationId(flags.station)
    } catch (err) {
      writeStationError(err)
      process.exit(1)
    }

    const now = flags.when ? new Date(flags.when) : new Date()
    const dateStr = formatDate(now)
    const timeStr = formatTime(now)

    const hasProductFilter = flags.products != null && flags.products.trim() !== ""

    try {
      // Request more when filtering client-side so we still return flags.results after filtering
      const apiLimit = hasProductFilter ? Math.min(flags.results * 3, 100) : flags.results

      const req: Record<string, unknown> = {
        type: "DEP",
        stbLoc: { type: "S", lid: `L=${stationId}` },
        maxJny: apiLimit,
        date: dateStr,
        time: timeStr,
        dur: flags.duration,
      }

      const res = await hafasFetch<StationBoardRes>("StationBoard", req)

      if (signal.aborted) return

      const prodL = res.common?.prodL ?? []

      // Client-side filter — API does not enforce jnyFltrL reliably
      let jnyList = res.jnyL ?? []
      if (hasProductFilter) {
        const allowedBitmask = buildProductsBitmask(flags.products)
        jnyList = jnyList.filter((jny) => {
          const prod = prodL[jny.prodX]
          return ((prod?.cls ?? 0) & allowedBitmask) !== 0
        })
      }

      const departureItems: DepartureItem[] = jnyList.slice(0, flags.results).map((jny) => {
        const stbStop = jny.stbStop
        const baseDate = jny.date ?? dateStr

        const dTimeS = stbStop.dTimeS
        const dTimeR = stbStop.dTimeR

        const plannedWhen = dTimeS ? parseHafasDateTime(baseDate, dTimeS) : ""
        const when = dTimeR ? parseHafasDateTime(baseDate, dTimeR) : plannedWhen

        const delay = computeDelay(baseDate, dTimeS, dTimeR)

        // Platform — try dPltfS first, then dPlatfS (API uses both field names)
        const rawPltfS = stbStop.dPltfS ?? stbStop.dPlatfS
        const rawPltfR = stbStop.dPltfR ?? stbStop.dPlatfR
        const plannedPlatform = getPlatformText(rawPltfS)
        const realtimePlatform = getPlatformText(rawPltfR)
        const platform = realtimePlatform ?? plannedPlatform

        const prod = prodL[jny.prodX]
        const line = prod?.name?.trim() ?? ""
        const category = prod?.prodCtx?.catOut?.trim() ?? prod?.prodCtx?.catOutS?.trim() ?? ""
        const direction = jny.dirTxt ?? ""
        const cancelled = !!(stbStop.dCncl)
        const tripId = jny.jid ?? ""

        return {
          line,
          category,
          direction,
          when,
          plannedWhen,
          delay,
          platform,
          plannedPlatform,
          cancelled,
          tripId,
        }
      })

      // Build the output "when" from the request time
      const outputWhen = parseHafasDateTime(dateStr, timeStr)

      const output = {
        type: "oebb_departures",
        station: stationId,
        when: outputWhen,
        departures: departureItems,
        count: departureItems.length,
      }

      if (flags.format === "json") {
        console.log(JSON.stringify(output, null, 2))
      } else if (flags.format === "table") {
        console.log("Line       Category  Direction                    When                       Delay    Platform  Cancelled")
        for (const dep of departureItems) {
          const whenTime = dep.when
            ? new Date(dep.when).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Vienna",
              })
            : "-"
          const delayStr = dep.delay != null ? `${dep.delay}s` : "-"
          const platStr = dep.platform ?? "-"
          const cancelStr = dep.cancelled ? "Yes" : "No"
          console.log(
            `${dep.line.padEnd(10)} ${dep.category.padEnd(9)} ${dep.direction.padEnd(28)} ${whenTime.padEnd(26)} ${delayStr.padEnd(8)} ${platStr.padEnd(9)} ${cancelStr}`,
          )
        }
      } else {
        // plain
        for (const dep of departureItems) {
          console.log(`${dep.line} → ${dep.direction}`)
          console.log(`  When:      ${dep.when}`)
          console.log(`  Planned:   ${dep.plannedWhen}`)
          console.log(`  Delay:     ${dep.delay != null ? `${dep.delay}s` : "-"}`)
          console.log(`  Platform:  ${dep.platform ?? "-"}`)
          console.log(`  Cancelled: ${dep.cancelled ? "Yes" : "No"}`)
          console.log(`  Trip ID:   ${dep.tripId}`)
          console.log("")
        }
      }
    } catch (err) {
      writeError(err instanceof Error ? err.message : String(err), "API_ERROR")
      process.exit(1)
    }
  },
})

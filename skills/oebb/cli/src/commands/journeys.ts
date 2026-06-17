import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import {
  hafasFetch,
  formatDate,
  formatTime,
  parseHafasDateTime,
  buildProductsBitmask,
  writeError,
  validateDate,
  validateTime,
  validateProducts,
  resolveStationId,
  writeStationError,
} from "../helpers.js"

// ── HAFAS response types ──────────────────────────────────────────────────────

interface HafasLocation {
  lid: string
  name: string
  extId: string
  crd?: { x: number; y: number }
}

interface HafasProdCtx {
  catOut: string
  catOutS?: string
  catOutL?: string
  num?: string
}

interface HafasProduct {
  name: string
  number?: string
  cls?: number
  prodCtx?: HafasProdCtx
  oprX?: number
}

/** Platform object as returned by the API — { type: "PL", txt: "7" } */
interface HafasPlatform {
  type?: string
  txt?: string
}

interface HafasStop {
  locX: number
  dTimeS?: string
  dTimeR?: string
  aTimeS?: string
  aTimeR?: string
  dPltfS?: HafasPlatform
  aPltfS?: HafasPlatform
  dPltfR?: HafasPlatform
  aPltfR?: HafasPlatform
}

interface HafasJny {
  prodX: number
  dirTxt?: string
  jid?: string
  stopL?: HafasStop[]
}

interface HafasGis {
  dist?: number
  [key: string]: unknown
}

interface HafasSec {
  type: string
  dep: {
    locX: number
    dTimeS?: string
    dTimeR?: string
    /** platform object e.g. { type: "PL", txt: "7" } */
    dPltfS?: HafasPlatform
    dPltfR?: HafasPlatform
    dCncl?: boolean
  }
  arr: {
    locX: number
    aTimeS?: string
    aTimeR?: string
    aPltfS?: HafasPlatform
    aPltfR?: HafasPlatform
    aCncl?: boolean
  }
  jny?: HafasJny
  gis?: HafasGis
}

interface HafasConnection {
  date: string
  secL: HafasSec[]
}

interface HafasCommon {
  locL: HafasLocation[]
  prodL: HafasProduct[]
  opL?: Array<{ name: string }>
}

interface TripSearchRes {
  common: HafasCommon
  outConL?: HafasConnection[]
}

// ── output types ──────────────────────────────────────────────────────────────

interface StopoverItem {
  stop: string
  stopId: string
  arrival: string | null
  plannedArrival: string | null
  departure: string | null
  plannedDeparture: string | null
}

interface TransitLeg {
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

interface WalkLeg {
  type: "walk"
  origin: string
  originId: string
  destination: string
  destinationId: string
  departure: string
  arrival: string
  distance: number | null
}

type JourneyLeg = TransitLeg | WalkLeg

interface JourneyItem {
  legs: JourneyLeg[]
  departure: string
  arrival: string
  duration: string
  transfers: number
  isNightTrain: boolean
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${m}m`
}

function isNightTrainCategory(category: string, line: string): boolean {
  const cat = category.trim().toUpperCase()
  if (cat.startsWith("NJ") || cat.startsWith("EN") || cat.startsWith("CNL")) return true
  if (line.toLowerCase().includes("nightjet")) return true
  return false
}

/** Extract platform text from a HAFAS platform object */
function getPlatformText(plt?: HafasPlatform): string | null {
  return plt?.txt ?? null
}

function parseConnection(
  conn: HafasConnection,
  common: HafasCommon,
  includeStopovers: boolean,
): JourneyItem {
  const baseDate = conn.date // YYYYMMDD

  const legs: JourneyLeg[] = conn.secL.map((sec) => {
    const depLoc = common.locL[sec.dep.locX]
    const arrLoc = common.locL[sec.arr.locX]

    const depTimeS = sec.dep.dTimeS ?? ""
    const depTimeR = sec.dep.dTimeR ?? null
    const arrTimeS = sec.arr.aTimeS ?? ""
    const arrTimeR = sec.arr.aTimeR ?? null

    if (sec.type === "JNY" && sec.jny) {
      const prod = common.prodL[sec.jny.prodX]
      const category = prod?.prodCtx?.catOut?.trim() ?? prod?.prodCtx?.catOutS?.trim() ?? ""
      const line = prod?.name?.trim() ?? ""
      const direction = sec.jny.dirTxt ?? ""

      const plannedDep = parseHafasDateTime(baseDate, depTimeS)
      const departure = depTimeR ? parseHafasDateTime(baseDate, depTimeR) : plannedDep

      const plannedArr = parseHafasDateTime(baseDate, arrTimeS)
      const arrival = arrTimeR ? parseHafasDateTime(baseDate, arrTimeR) : plannedArr

      const depPltfS = getPlatformText(sec.dep.dPltfS)
      const depPltfR = getPlatformText(sec.dep.dPltfR)
      const arrPltfS = getPlatformText(sec.arr.aPltfS)
      const arrPltfR = getPlatformText(sec.arr.aPltfR)

      let stopovers: StopoverItem[] = []
      if (includeStopovers && sec.jny.stopL) {
        stopovers = sec.jny.stopL.map((s) => {
          const stopLoc = common.locL[s.locX]
          const saTimeS = s.aTimeS ?? null
          const saTimeR = s.aTimeR ?? null
          const sdTimeS = s.dTimeS ?? null
          const sdTimeR = s.dTimeR ?? null

          return {
            stop: stopLoc?.name ?? "",
            stopId: stopLoc?.extId ?? "",
            arrival: saTimeS
              ? (saTimeR ? parseHafasDateTime(baseDate, saTimeR) : parseHafasDateTime(baseDate, saTimeS))
              : null,
            plannedArrival: saTimeS ? parseHafasDateTime(baseDate, saTimeS) : null,
            departure: sdTimeS
              ? (sdTimeR ? parseHafasDateTime(baseDate, sdTimeR) : parseHafasDateTime(baseDate, sdTimeS))
              : null,
            plannedDeparture: sdTimeS ? parseHafasDateTime(baseDate, sdTimeS) : null,
          }
        })
      }

      return {
        type: "journey",
        line,
        category,
        direction,
        origin: depLoc?.name ?? "",
        originId: depLoc?.extId ?? "",
        departure,
        plannedDeparture: plannedDep,
        departurePlatform: depPltfR ?? depPltfS,
        plannedDeparturePlatform: depPltfS,
        destination: arrLoc?.name ?? "",
        destinationId: arrLoc?.extId ?? "",
        arrival,
        plannedArrival: plannedArr,
        arrivalPlatform: arrPltfR ?? arrPltfS,
        plannedArrivalPlatform: arrPltfS,
        cancelled: !!(sec.dep.dCncl || sec.arr.aCncl),
        stopovers,
      } satisfies TransitLeg
    } else {
      // WALK or TRSF
      const plannedDep = depTimeS ? parseHafasDateTime(baseDate, depTimeS) : ""
      const plannedArr = arrTimeS ? parseHafasDateTime(baseDate, arrTimeS) : ""

      return {
        type: "walk",
        origin: depLoc?.name ?? "",
        originId: depLoc?.extId ?? "",
        destination: arrLoc?.name ?? "",
        destinationId: arrLoc?.extId ?? "",
        departure: plannedDep,
        arrival: plannedArr,
        distance: (sec.gis?.dist as number | undefined) ?? null,
      } satisfies WalkLeg
    }
  })

  // Journey-level departure = first leg departure, arrival = last leg arrival
  const firstLeg = legs[0]
  const lastLeg = legs[legs.length - 1]

  const journeyDep = firstLeg ? firstLeg.departure : ""
  const journeyArr = lastLeg ? lastLeg.arrival : ""

  // Duration in minutes
  let totalMinutes = 0
  if (journeyDep && journeyArr) {
    const depMs = new Date(journeyDep).getTime()
    const arrMs = new Date(journeyArr).getTime()
    totalMinutes = Math.round((arrMs - depMs) / 60000)
    if (totalMinutes < 0) totalMinutes = 0
  }

  const transitLegs = legs.filter((l): l is TransitLeg => l.type === "journey")
  const transfers = Math.max(0, transitLegs.length - 1)
  const isNightTrain = transitLegs.some((l) => isNightTrainCategory(l.category, l.line))

  return {
    legs,
    departure: journeyDep,
    arrival: journeyArr,
    duration: formatDuration(totalMinutes),
    transfers,
    isNightTrain,
  }
}

// ── command ───────────────────────────────────────────────────────────────────

export const journeys = defineCommand({
  name: "journeys",
  description: "Plan a journey between two stations",
  options: {
    from: option(z.string().optional(), {
      description: "Departure station name or ID (required)",
    }),
    to: option(z.string().optional(), {
      description: "Arrival station name or ID (required)",
    }),
    date: option(z.string().optional(), {
      description: "Travel date YYYY-MM-DD (default: today)",
    }),
    time: option(z.string().optional(), {
      description: "Departure time HH:MM (default: now)",
    }),
    results: option(z.coerce.number().default(5), {
      description: "Number of journeys to return (1-10, default: 5)",
    }),
    transfers: option(z.coerce.number().default(-1), {
      description: "Max transfers (-1 = unlimited)",
    }),
    products: option(z.string().optional(), {
      description: "Comma-separated product IDs to include",
    }),
    night: option(z.coerce.boolean().default(false), {
      description: "Include only night/sleeper trains",
    }),
    stopovers: option(z.coerce.boolean().default(false), {
      description: "Include intermediate stops for each transit leg",
    }),
    format: option(z.enum(["json", "table", "plain"]).default("plain"), {
      description: "Output format: json, table, plain",
    }),
  },
  handler: async ({ flags, signal }) => {
    if (signal.aborted) return

    const STATIONS_HINT = "Provide a station name or numeric ID — find IDs with: stations --query <city name>"

    if (!flags.from) {
      writeError("--from is required (departure station name or ID)", "MISSING_FROM", STATIONS_HINT)
      process.exit(1)
    }
    if (!flags.to) {
      writeError("--to is required (arrival station name or ID)", "MISSING_TO", STATIONS_HINT)
      process.exit(1)
    }
    if (flags.date) {
      const err = validateDate(flags.date)
      if (err) { writeError(err, "INVALID_DATE"); process.exit(1) }
    }
    if (flags.time) {
      const err = validateTime(flags.time)
      if (err) { writeError(err, "INVALID_TIME"); process.exit(1) }
    }
    if (flags.products) {
      const err = validateProducts(flags.products)
      if (err) { writeError(err, "INVALID_PRODUCTS"); process.exit(1) }
    }

    // Resolve station names → IDs (pass-through if already numeric)
    let fromId: string
    let toId: string
    try {
      fromId = await resolveStationId(flags.from)
    } catch (err) {
      writeStationError(err)
      process.exit(1)
    }
    try {
      toId = await resolveStationId(flags.to)
    } catch (err) {
      writeStationError(err)
      process.exit(1)
    }

    const now = new Date()
    // dateStr for output must be YYYY-MM-DD
    const dateStr = flags.date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const timeStr = flags.time ?? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

    // Parse date to YYYYMMDD for the HAFAS API request
    const outDate = flags.date ? flags.date.replace(/-/g, "") : formatDate(now)

    // Parse time to HHMMSS
    let outTime: string
    if (flags.time) {
      const [hh, mm] = flags.time.split(":")
      outTime = `${hh.padStart(2, "0")}${mm.padStart(2, "0")}00`
    } else {
      outTime = formatTime(now)
    }

    try {
      const req: Record<string, unknown> = {
        depLocL: [{ type: "S", lid: `L=${fromId}` }],
        arrLocL: [{ type: "S", lid: `L=${toId}` }],
        outDate,
        outTime,
        outFrwd: true,
        maxChg: flags.transfers,
        minChgTime: 0,
        getPT: true,
        getPasslist: flags.stopovers ? true : false,
        getTariff: false,
        ushrp: true,
        getPolyline: false,
      }

      const res = await hafasFetch<TripSearchRes>("TripSearch", req)

      if (signal.aborted) return

      let connections = res.outConL ?? []

      // Client-side filter — API does not enforce jnyFltrL reliably
      if (flags.night) {
        connections = connections.filter((conn) =>
          conn.secL.some((sec) => {
            if (sec.type !== "JNY" || !sec.jny) return false
            const prod = res.common.prodL[sec.jny.prodX]
            const category = prod?.prodCtx?.catOut?.trim() ?? ""
            const line = prod?.name?.trim() ?? ""
            return isNightTrainCategory(category, line)
          }),
        )
      } else if (flags.products) {
        const allowedBitmask = buildProductsBitmask(flags.products)
        connections = connections.filter((conn) => {
          const transitLegs = conn.secL.filter((s) => s.type === "JNY")
          if (transitLegs.length === 0) return true
          return transitLegs.every((sec) => {
            if (!sec.jny) return true
            const prod = res.common.prodL[sec.jny.prodX]
            return ((prod?.cls ?? 0) & allowedBitmask) !== 0
          })
        })
      }

      // Limit client-side
      connections = connections.slice(0, flags.results)

      const parsedJourneys: JourneyItem[] = connections.map((conn) =>
        parseConnection(conn, res.common, flags.stopovers)
      )

      const output = {
        type: "oebb_journeys",
        from: fromId,
        to: toId,
        date: dateStr,
        time: timeStr,
        journeys: parsedJourneys,
        count: parsedJourneys.length,
      }

      if (flags.format === "json") {
        console.log(JSON.stringify(output, null, 2))
      } else if (flags.format === "table") {
        console.log("#  Dep    Arr    Duration  Transfers  Night")
        parsedJourneys.forEach((j, i) => {
          const depTime = j.departure
            ? new Date(j.departure).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Vienna",
              })
            : "-"
          const arrTime = j.arrival
            ? new Date(j.arrival).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Vienna",
              })
            : "-"
          const nightStr = j.isNightTrain ? "Yes" : "No"
          const lines = j.legs
            .filter((l): l is TransitLeg => l.type === "journey")
            .map((l) => l.line)
            .join(", ")
          console.log(
            `${i + 1}  ${depTime}  ${arrTime}  ${j.duration.padEnd(9)}  ${String(j.transfers).padEnd(10)} ${nightStr}${lines ? `  ${lines}` : ""}`,
          )
        })
      } else {
        // plain
        parsedJourneys.forEach((j, i) => {
          const origin = j.legs[0]?.origin ?? ""
          const destination = j.legs[j.legs.length - 1]?.destination ?? ""
          console.log(`Journey ${i + 1}: ${origin} → ${destination}`)
          console.log(`  Departure: ${j.departure}`)
          console.log(`  Arrival:   ${j.arrival}`)
          console.log(`  Duration:  ${j.duration}`)
          console.log(`  Transfers: ${j.transfers}`)
          console.log(`  Legs:`)
          for (const leg of j.legs) {
            if (leg.type === "journey") {
              const depTime = new Date(leg.departure).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Vienna",
              })
              const arrTime = new Date(leg.arrival).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Vienna",
              })
              const depPlat = leg.departurePlatform ? ` (platform ${leg.departurePlatform})` : ""
              console.log(`    [${leg.line}] ${leg.origin} ${depTime}${depPlat} → ${leg.destination} ${arrTime}`)
            } else {
              const dist = leg.distance != null ? ` (${leg.distance}m)` : ""
              console.log(`    [Walk] ${leg.origin} → ${leg.destination}${dist}`)
            }
          }
          console.log("")
        })
      }
    } catch (err) {
      writeError(err instanceof Error ? err.message : String(err), "API_ERROR")
      process.exit(1)
    }
  },
})

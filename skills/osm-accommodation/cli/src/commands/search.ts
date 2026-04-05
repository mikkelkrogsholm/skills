import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import {
  nominatimGeocode,
  overpassFetch,
  toAccommodation,
  writeError,
  type Accommodation,
} from "../helpers.js"

const VALID_AMENITIES = ["wifi", "breakfast", "parking", "pool", "wheelchair"] as const

export const search = defineCommand({
  name: "search",
  description: "Find accommodation in a named city or area (e.g. 'Amsterdam', 'Paris 10th', 'Lisbon')",
  options: {
    type: option(z.enum(["hotel", "hostel", "guest_house", "motel", "all"]).default("all"), {
      description: "Filter by type: hotel, hostel, guest_house, motel, all (default: all)",
    }),
    stars: option(z.coerce.number().optional(), {
      description: "Minimum star rating (excludes properties with no star data)",
    }),
    amenity: option(z.string().optional(), {
      description: `Comma-separated amenities to require: ${VALID_AMENITIES.join(", ")}`,
    }),
    limit: option(z.coerce.number().default(20), {
      description: "Max results to return, client-side cap (default: 20)",
    }),
    format: option(z.enum(["json", "table", "plain"]).default("plain"), {
      description: "Output format: json, table, plain",
    }),
  },
  handler: async ({ positional, flags, signal }) => {
    if (signal.aborted) return

    const location = positional[0]
    if (!location) {
      writeError("location argument is required (e.g. 'Amsterdam', 'Berlin', 'Prague')", "MISSING_REQUIRED")
      process.exit(1)
    }

    try {
      const geo = await nominatimGeocode(location)
      if (!geo) {
        writeError(`Location not found: "${location}"`, "LOCATION_NOT_FOUND")
        process.exit(1)
      }

      if (signal.aborted) return

      // Nominatim bbox: [south, north, west, east]
      // Overpass query bbox order: (south, west, north, east)
      const [south, north, west, east] = geo.bbox
      const typeRegex = flags.type === "all" ? "hotel|hostel|guest_house|motel" : flags.type

      const query = `[out:json][timeout:25];
nwr(${south},${west},${north},${east})["tourism"~"^(${typeRegex})$"];
out center tags;`

      const data = await overpassFetch(query)

      if (signal.aborted) return

      let results: Accommodation[] = data.elements.map(toAccommodation)

      // Client-side filters — Overpass does not support these natively
      if (flags.stars !== undefined) {
        const minStars = flags.stars
        results = results.filter((r) => r.stars !== null && r.stars >= minStars)
      }

      if (flags.amenity) {
        const requested = flags.amenity.split(",").map((a) => a.trim())
        results = results.filter((r) => {
          for (const amenity of requested) {
            if (amenity === "wifi" && r.amenities.wifi !== true) return false
            if (amenity === "breakfast" && r.amenities.breakfast !== true) return false
            if (amenity === "parking" && r.amenities.parking !== true) return false
            if (amenity === "pool" && r.amenities.pool !== true) return false
            if (amenity === "wheelchair" && r.amenities.wheelchair !== true) return false
          }
          return true
        })
      }

      results = results.slice(0, flags.limit)

      if (results.length === 0) {
        writeError("No accommodation found matching your filters", "NO_RESULTS")
        process.exit(1)
      }

      const output = {
        type: "osm_accommodation_search",
        location,
        matched_location: geo.displayName,
        results,
        count: results.length,
      }

      if (flags.format === "json") {
        console.log(JSON.stringify(output, null, 2))
      } else if (flags.format === "table") {
        outputTable(results)
      } else {
        outputPlain(results)
      }
    } catch (err) {
      writeError(err instanceof Error ? err.message : String(err), "API_UNAVAILABLE")
      process.exit(1)
    }
  },
})

function outputTable(results: Accommodation[]): void {
  console.log("Name                            Type          Stars  City")
  console.log("-".repeat(72))
  for (const r of results) {
    const name = r.name.substring(0, 30).padEnd(32)
    const type = r.type.padEnd(13)
    const stars = r.stars !== null ? String(r.stars) : "-"
    const city = r.address.city ?? "-"
    console.log(`${name} ${type} ${stars.padEnd(6)} ${city}`)
  }
}

function outputPlain(results: Accommodation[]): void {
  for (const r of results) {
    const starStr = r.stars !== null ? ` ${r.stars}★` : ""
    console.log(`${r.name} (${r.type}${starStr})`)
    const addrParts = [r.address.street, r.address.postcode, r.address.city, r.address.country].filter(Boolean)
    if (addrParts.length > 0) console.log(`  Address: ${addrParts.join(", ")}`)
    if (r.contact.phone) console.log(`  Phone: ${r.contact.phone}`)
    if (r.contact.email) console.log(`  Email: ${r.contact.email}`)
    if (r.contact.website) console.log(`  Website: ${r.contact.website}`)
    const amenList: string[] = []
    if (r.amenities.wifi === true) amenList.push("wifi")
    if (r.amenities.breakfast === true) amenList.push("breakfast")
    if (r.amenities.parking === true) amenList.push("parking")
    if (r.amenities.pool === true) amenList.push("pool")
    if (r.amenities.wheelchair === true) amenList.push("wheelchair")
    if (amenList.length > 0) console.log(`  Amenities: ${amenList.join(", ")}`)
    console.log("")
  }
}

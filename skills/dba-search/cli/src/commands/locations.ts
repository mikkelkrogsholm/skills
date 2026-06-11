import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { apiFetch, outputResult, outputError } from "../helpers.js"

const SEARCH_PATH = "/recommerce/forsale/search/api/search/SEARCH_ID_BAP_COMMON"

interface ApiFilterItem {
  display_name: string
  name: string
  value: string
  hits: number
  filter_items: ApiFilterItem[]
  selected?: boolean
}

interface ApiSearchResponse {
  filters: ApiFilterItem[]
}

interface LocationFlat {
  id: string
  name: string
  hits: number
}

interface LocationTree extends LocationFlat {
  children: LocationTree[]
}

function mapFlat(items: ApiFilterItem[]): LocationFlat[] {
  return items.map((item) => ({
    id: item.value,
    name: item.display_name,
    hits: item.hits,
  }))
}

function mapTree(items: ApiFilterItem[]): LocationTree[] {
  return items.map((item) => ({
    id: item.value,
    name: item.display_name,
    hits: item.hits,
    children: mapTree(item.filter_items ?? []),
  }))
}

export const locations = defineCommand({
  name: "locations",
  description: "Browse the DBA location hierarchy",
  options: {
    path: option(z.string().optional(), {
      description: 'Slash-separated path to navigate, e.g. "Bornholm" or "Sjælland/København"',
    }),
    tree: option(z.coerce.boolean().default(false), {
      description: "Show full nested tree",
      argumentKind: "flag",
    }),
    format: option(z.enum(["json", "table", "plain"]).default("plain"), {
      description: "Output format",
    }),
  },
  async handler({ flags }) {
    const data = await apiFetch<ApiSearchResponse>(SEARCH_PATH)

    const locationFilter = data.filters?.find((f) => f.name === "location")
    if (!locationFilter) {
      outputError("Could not find location filter in API response", "API_ERROR")
    }

    let currentLevel: ApiFilterItem[] = locationFilter.filter_items ?? []
    const resolvedPath: string[] = []

    if (flags.path) {
      const segments = flags.path.split("/").filter(Boolean)

      for (const segment of segments) {
        const lower = segment.toLowerCase()
        const match = currentLevel.find((item) =>
          item.display_name.toLowerCase().includes(lower)
        )
        if (!match) {
          outputError(`Location not found: "${flags.path}"`, "NOT_FOUND")
        }
        resolvedPath.push(match.display_name)
        currentLevel = match.filter_items ?? []
      }
    }

    const result = flags.tree
      ? { path: resolvedPath, locations: mapTree(currentLevel) }
      : { path: resolvedPath, locations: mapFlat(currentLevel) }

    outputResult(result, flags.format)
  },
})

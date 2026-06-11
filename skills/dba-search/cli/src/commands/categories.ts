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

interface CategoryFlat {
  id: string
  name: string
  hits: number
}

interface CategoryTree extends CategoryFlat {
  children: CategoryTree[]
}

function mapFlat(items: ApiFilterItem[]): CategoryFlat[] {
  return items.map((item) => ({
    id: item.value,
    name: item.display_name,
    hits: item.hits,
  }))
}

function mapTree(items: ApiFilterItem[]): CategoryTree[] {
  return items.map((item) => ({
    id: item.value,
    name: item.display_name,
    hits: item.hits,
    children: mapTree(item.filter_items ?? []),
  }))
}

export const categories = defineCommand({
  name: "categories",
  description: "Browse the DBA category hierarchy",
  options: {
    path: option(z.string().optional(), {
      description: 'Slash-separated path to navigate, e.g. "Elektronik" or "Elektronik/Telefoner"',
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

    const categoryFilter = data.filters?.find((f) => f.name === "category")
    if (!categoryFilter) {
      outputError("Could not find category filter in API response", "API_ERROR")
    }

    let currentLevel: ApiFilterItem[] = categoryFilter.filter_items ?? []
    const resolvedPath: string[] = []

    if (flags.path) {
      const segments = flags.path.split("/").filter(Boolean)

      for (const segment of segments) {
        const lower = segment.toLowerCase()
        const match = currentLevel.find((item) =>
          item.display_name.toLowerCase().includes(lower)
        )
        if (!match) {
          outputError(`Category not found: "${flags.path}"`, "NOT_FOUND")
        }
        resolvedPath.push(match.display_name)
        currentLevel = match.filter_items ?? []
      }
    }

    const result = flags.tree
      ? { path: resolvedPath, categories: mapTree(currentLevel) }
      : { path: resolvedPath, categories: mapFlat(currentLevel) }

    outputResult(result, flags.format)
  },
})

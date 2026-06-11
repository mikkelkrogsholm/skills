import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import {
  apiFetch, outputResult, outputError, categoryParam, validateId,
  isNameInput, resolveLocationName, resolveCategoryName,
} from "../helpers.js"

const SEARCH_PATH = "/recommerce/forsale/search/api/search/SEARCH_ID_BAP_COMMON"

const tradeTypeMap: Record<string, string> = {
  sale: "1",
  free: "2",
  wanted: "3",
}

const sellerMap: Record<string, string> = {
  private: "1",
  dealer: "3",
}

interface ApiPrice {
  amount: number
  currency_code: string
}

interface ApiImage {
  url: string
}

interface ApiDoc {
  id: string
  heading: string
  price?: ApiPrice
  location: string
  distance: number
  trade_type: string
  flags?: string[]
  image?: ApiImage
  canonical_url: string
  timestamp: number
}

interface ApiPaging {
  current: number
  last: number
}

interface ApiMetadata {
  num_results: number
  paging: ApiPaging
  is_end_of_paging: boolean
}

interface ApiSearchResponse {
  docs: ApiDoc[]
  metadata: ApiMetadata
}

interface SearchResult {
  id: string
  title: string
  price: number | null
  currency: string
  location: string
  distance_km: number | null
  trade_type: string
  flags: string[]
  image_url: string | null
  url: string
  created_at: number
}

export const search = defineCommand({
  name: "search",
  description: "Search DBA listings with keyword and filter options",
  options: {
    query: option(z.string().optional(), {
      description: "Keyword search query",
      short: "q",
    }),
    filter: option(z.string().optional(), {
      description: "Client-side text filter: case-insensitive substring match on result titles",
    }),
    "price-from": option(z.coerce.number().optional(), {
      description: "Minimum price in DKK",
    }),
    "price-to": option(z.coerce.number().optional(), {
      description: "Maximum price in DKK",
    }),
    category: option(z.string().optional(), {
      description: "Category code from categories command (e.g. 0.93, 1.90.82, 2.90.82.5)",
    }),
    location: option(z.string().optional(), {
      description: "Location code from locations command (e.g. 0.200010)",
    }),
    condition: option(z.coerce.number().optional(), {
      description: "Item condition: 1=brand new, 2=like new, 3=good used, 4=visible wear, 5=needs repair",
    }),
    "trade-type": option(z.enum(["sale", "free", "wanted"]).optional(), {
      description: "sale (Til salg), free (Gives væk), or wanted (Ønsker at købe)",
    }),
    seller: option(z.enum(["private", "dealer"]).optional(), {
      description: "private or dealer",
    }),
    shipping: option(z.enum(["any", "shippable"]).default("any"), {
      description: "any (default, no filter) or shippable (items with shipping available)",
    }),
    today: option(z.coerce.boolean().default(false), {
      description: "Only show listings published today",
      argumentKind: "flag",
    }),
    page: option(z.coerce.number().default(1), {
      description: "Page number (1-based)",
    }),
    limit: option(z.coerce.number().default(20), {
      description: "Maximum number of results to return client-side (max 100)",
    }),
    format: option(z.enum(["json", "table", "plain"]).default("plain"), {
      description: "Output format: json, table, or plain",
    }),
  },
  async handler({ flags }) {
    // Build query params
    const params: Record<string, string | number | boolean | undefined> = {}

    if (flags.query) params.q = flags.query
    if (flags.page !== 1) params.page = flags.page
    else params.page = flags.page

    if (flags["price-from"] !== undefined) params.price_from = flags["price-from"]
    if (flags["price-to"] !== undefined) params.price_to = flags["price-to"]
    if (flags.condition !== undefined) params.condition = flags.condition

    if (flags["trade-type"]) {
      params.trade_type = tradeTypeMap[flags["trade-type"]]
    }

    if (flags.seller) {
      params.dealer_segment = sellerMap[flags.seller]
    }

    if (flags.today) {
      params.published = 1
    }

    if (flags.shipping === "shippable") {
      params.shipping_types = 0
    }

    if (flags.category) {
      let categoryCode = flags.category
      if (isNameInput(categoryCode)) {
        const resolved = await resolveCategoryName(categoryCode)
        if (!resolved) {
          outputError(
            `Category not found: "${categoryCode}". Use "categories --tree" to browse valid category names and IDs.`,
            "NOT_FOUND",
          )
        }
        categoryCode = resolved
      } else {
        const err = validateId(categoryCode, "category")
        if (err) outputError(err, "INVALID_ID")
      }
      const { paramName, paramValue } = categoryParam(categoryCode)
      params[paramName] = paramValue
    }

    if (flags.location) {
      let locationCode = flags.location
      if (isNameInput(locationCode)) {
        const resolved = await resolveLocationName(locationCode)
        if (!resolved) {
          outputError(
            `Location not found: "${locationCode}". Use "locations --tree" to browse valid location names and IDs.`,
            "NOT_FOUND",
          )
        }
        locationCode = resolved
      } else {
        const err = validateId(locationCode, "location")
        if (err) outputError(err, "INVALID_ID")
      }
      params.location = locationCode
    }

    let data: ApiSearchResponse
    try {
      data = await apiFetch<ApiSearchResponse>(SEARCH_PATH, params)
    } catch (err: unknown) {
      const e = err as Error & { code?: string }
      outputError(e.message ?? "Unknown error", e.code ?? "API_ERROR")
    }

    // Map docs to SearchResult shape
    let results: SearchResult[] = (data.docs ?? []).map((doc) => ({
      id: doc.id,
      title: doc.heading,
      price: doc.price?.amount ?? null,
      currency: doc.price?.currency_code ?? "DKK",
      location: doc.location,
      distance_km: doc.distance > 0 ? doc.distance : null,
      trade_type: doc.trade_type,
      flags: doc.flags ?? [],
      image_url: doc.image?.url ?? null,
      url: doc.canonical_url,
      created_at: doc.timestamp,
    }))

    // Client-side filter by title substring
    if (flags.filter) {
      const filterLower = flags.filter.toLowerCase()
      results = results.filter((r) => r.title.toLowerCase().includes(filterLower))
    }

    // Client-side limit
    results = results.slice(0, flags.limit)

    const metadata = data.metadata
    const output = {
      results,
      total: metadata.num_results,
      page: metadata.paging.current,
      is_last_page: metadata.is_end_of_paging || metadata.paging.current >= metadata.paging.last,
    }

    outputResult(output, flags.format)
  },
})

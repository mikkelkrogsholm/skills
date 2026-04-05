import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { apiFetch, outputResult, outputError } from "../helpers.js"

interface ApiPosition {
  lat: number
  lng: number
}

interface ApiLocation {
  postalName: string
  postalCode: string
  position?: ApiPosition
}

interface ApiCategory {
  id: number
  value: string
  parent?: ApiCategory
}

interface ApiExtra {
  id?: string
  label?: string
  value?: string
}

interface ApiImage {
  uri: string
}

interface ApiMeta {
  adId: string
  ownerId: number
  edited: string
  isInactive?: boolean
}

interface ApiItemData {
  title: string
  description: string
  price?: number
  location: ApiLocation
  category: ApiCategory
  extras: ApiExtra[]
  images: ApiImage[]
  meta: ApiMeta
  isWebstore: boolean
  disposed?: boolean
}

interface ApiTransactableData {
  eligibleForShipping?: boolean
  sellerPaysShipping?: boolean
  buyNow?: boolean
}

interface ApiDetailResponse {
  itemData: ApiItemData
  transactableData?: ApiTransactableData
}

function buildCategoryPath(cat: ApiCategory): { id: number; name: string; path: string[] } {
  const nodes: ApiCategory[] = []
  let cur: ApiCategory | undefined = cat
  while (cur) {
    nodes.unshift(cur)
    cur = cur.parent
  }
  return {
    id: cat.id,
    name: cat.value,
    path: nodes.map((n) => n.value),
  }
}

function extractCondition(extras: ApiExtra[]): string | null {
  const conditionExtra = extras.find((e) => e.id === "condition")
  return conditionExtra?.value ?? null
}

export const detail = defineCommand({
  name: "detail",
  description: "Get full details for a single DBA ad",
  options: {
    format: option(z.enum(["json", "table", "plain"]).default("plain"), {
      description: "Output format: json, table, or plain",
    }),
  },
  async handler({ flags, positional }) {
    const id = positional[0]

    if (!id || !/^\d+$/.test(id)) {
      outputError("Invalid ad ID: must be a numeric string", "INVALID_INPUT")
    }

    let response: ApiDetailResponse
    try {
      response = await apiFetch<ApiDetailResponse>(`/recommerce/forsale/item/${id}`)
    } catch (err: unknown) {
      const e = err as Error & { code?: string }
      if (e.code === "NOT_FOUND") {
        outputError(`Ad not found: ${id}`, "NOT_FOUND")
      }
      outputError(e.message ?? "Unknown error", e.code ?? "API_ERROR")
    }

    const { itemData } = response

    const result = {
      id: itemData.meta.adId,
      title: itemData.title,
      description: itemData.description,
      price: itemData.price ?? null,
      currency: "DKK",
      location: {
        city: itemData.location.postalName,
        postal_code: itemData.location.postalCode,
        lat: itemData.location.position?.lat ?? null,
        lon: itemData.location.position?.lng ?? null,
      },
      category: buildCategoryPath(itemData.category),
      condition: extractCondition(itemData.extras),
      extras: itemData.extras
        .filter((e) => e.label)
        .map((e) => ({ label: e.label as string, value: e.value as string })),
      seller: {
        type: itemData.isWebstore ? "webstore" : "private",
        is_webstore: itemData.isWebstore,
        owner_id: itemData.meta.ownerId,
      },
      images: {
        count: itemData.images.length,
        urls: itemData.images.map((img) => img.uri),
      },
      url: `https://www.dba.dk/recommerce/forsale/item/${itemData.meta.adId}`,
      last_edited: itemData.meta.edited,
      is_active: !itemData.meta.isInactive && !itemData.disposed,
      shipping: {
        eligible: response.transactableData?.eligibleForShipping ?? false,
        seller_pays: response.transactableData?.sellerPaysShipping ?? false,
        buy_now: response.transactableData?.buyNow ?? false,
      },
    }

    outputResult(result, flags.format)
  },
})

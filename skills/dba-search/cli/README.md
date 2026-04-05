# dba-search CLI

A CLI for searching Denmark's largest second-hand marketplace, [DBA.dk (Den Blå Avis)](https://www.dba.dk). Browse categories and locations, search classified ads, and fetch full ad details — all from the command line.

No authentication required.

---

## Installation

```bash
bun install
```

---

## Usage

```bash
bun run src/cli.ts <command> [options]
```

---

## Commands

- [`categories`](#categories) — Browse the category hierarchy
- [`locations`](#locations) — Browse the location hierarchy
- [`search`](#search) — Search listings
- [`detail`](#detail) — Get full details for a single ad

---

## `categories`

Browse the DBA category hierarchy. Categories are fetched live from the search API filter tree.

```bash
bun run src/cli.ts categories [--path <path>] [--tree] [--format json|table|plain]
```

### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--path` | string | — | Slash-separated name path to navigate into, e.g. `"Elektronik"` or `"Elektronik/Telefoner"`. Case-insensitive partial match against display names. |
| `--tree` | boolean | false | Show full nested tree (all descendant levels) |
| `--format` | string | `json` | Output format: `json`, `table`, or `plain` |

### Behaviour

- **No arguments:** Lists all root-level categories (depth 0).
- **With `path`:** Navigates to the first node whose display name contains the path segment (case-insensitive), then lists its immediate children. Multi-level paths are separated by `/`.
- **With `--tree`:** Returns full subtree rooted at the matched node (or all roots if no path given). Each node includes a `children` array.

### JSON output — flat (no `--tree`)

```json
{
  "path": [],
  "categories": [
    { "id": "0.90", "name": "Bil-, båd- og motorcykeludstyr", "hits": 12345 },
    { "id": "0.93", "name": "Elektronik og hvidevarer", "hits": 8900 }
  ]
}
```

With a `path` argument (e.g. `"Elektronik"`):

```json
{
  "path": ["Elektronik og hvidevarer"],
  "categories": [
    { "id": "1.93.xxx", "name": "Mobiltelefoner", "hits": 500 },
    { "id": "1.93.yyy", "name": "Computere", "hits": 300 }
  ]
}
```

### JSON output — tree (`--tree`)

```json
{
  "path": [],
  "categories": [
    {
      "id": "0.90",
      "name": "Bil-, båd- og motorcykeludstyr",
      "hits": 12345,
      "children": [
        {
          "id": "1.90.82",
          "name": "Biltilbehør og reservedele",
          "hits": 456,
          "children": [
            {
              "id": "2.90.82.5",
              "name": "Bilstereo",
              "hits": 12,
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```

### Category code format

The `id` field encodes the depth and hierarchy:

| Prefix | Depth | API param used |
|--------|-------|----------------|
| `0.X` | Root | `category` |
| `1.X.Y` | Sub-category | `sub_category` |
| `2.X.Y.Z` | Product/leaf | `product_category` |

Pass the `id` value directly to the `--category` flag of `search` — the CLI detects the depth and uses the correct API parameter automatically.

### Error

If `path` does not match any node:

```json
{ "error": "Category not found: \"Foo/Bar\"", "code": "NOT_FOUND" }
```

---

## `locations`

Browse the DBA location hierarchy. Identical interface to `categories` but for geographic areas.

```bash
bun run src/cli.ts locations [--path <path>] [--tree] [--format json|table|plain]
```

### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--path` | string | — | Slash-separated region path, e.g. `"Bornholm"` or `"Sjælland/København"`. Case-insensitive partial match. |
| `--tree` | boolean | false | Show full nested tree |
| `--format` | string | `json` | Output format: `json`, `table`, or `plain` |

### JSON output — flat (no `--tree`)

```json
{
  "path": [],
  "locations": [
    { "id": "0.200010", "name": "Bornholm", "hits": 16 },
    { "id": "0.200060", "name": "Fyn", "hits": 4321 }
  ]
}
```

With a `path` argument (e.g. `"Bornholm"`):

```json
{
  "path": ["Bornholm"],
  "locations": [
    { "id": "1.200010.213700", "name": "Rønne", "hits": 11 },
    { "id": "1.200010.213800", "name": "Nexø", "hits": 5 }
  ]
}
```

### JSON output — tree (`--tree`)

```json
{
  "path": [],
  "locations": [
    {
      "id": "0.200010",
      "name": "Bornholm",
      "hits": 16,
      "children": [
        {
          "id": "1.200010.213700",
          "name": "Rønne",
          "hits": 11,
          "children": []
        }
      ]
    }
  ]
}
```

### Error

If `path` does not match any node:

```json
{ "error": "Location not found: \"Foo/Bar\"", "code": "NOT_FOUND" }
```

---

## `search`

Search DBA listings with keyword and filter options.

```bash
bun run src/cli.ts search [options]
```

### Options

| Flag | Alias | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--query` | `-q` | string | — | Keyword search query. Can be empty to browse all listings. |
| `--filter` | | string | — | Client-side text filter: case-insensitive substring match applied to result titles after fetching |
| `--price-from` | | number | — | Minimum price in DKK |
| `--price-to` | | number | — | Maximum price in DKK |
| `--category` | | string | — | Category code (e.g. `0.93`, `1.90.82`, `2.90.82.5`) **or a plain name** (e.g. `Elektronik`, `Bilstereo`). Names are resolved automatically via the filter tree. |
| `--location` | | string | — | Location code (e.g. `0.200010`, `1.200009.215935`) **or a plain name** (e.g. `Bagenkop`, `Bornholm`). Names are resolved automatically via the filter tree. |
| `--condition` | | number | — | Item condition: `1`=brand new, `2`=like new, `3`=good used, `4`=visible wear, `5`=needs repair |
| `--trade-type` | | string | — | `sale` (Til salg), `free` (Gives væk), or `wanted` (Ønsker at købe) |
| `--seller` | | string | — | `private` or `dealer` |
| `--shipping` | | string | — | `any` (default, no filter) or `shippable` (items with shipping available) |
| `--today` | | boolean | false | Only show listings published today |
| `--page` | | number | `1` | Page number (1-based) |
| `--limit` | | number | `20` | Maximum number of results to return client-side (max 100) |
| `--format` | | string | `json` | Output format: `json`, `table`, or `plain` |

### Name resolution for `--category` and `--location`

Both flags accept either a numeric ID or a plain name (any value containing a letter is treated as a name):

- **Plain name** (e.g. `--location Bagenkop`, `--category Elektronik`) — the CLI fetches the filter tree and does a case-insensitive exact search through all levels. If found, the resolved ID is used transparently. If not found, the command exits with `NOT_FOUND`.
- **Numeric ID** (e.g. `--location 0.200010`, `--category 1.90.82`) — used directly after format validation.

#### ID format

IDs encode depth and hierarchy as `{level}.{seg1}[.{seg2}...]`. The leading digit is the nesting level (0-indexed) and the number of segments after must be exactly `level + 1`:

| Example | Level | Segments | Valid? |
|---------|-------|----------|--------|
| `0.200009` | 0 | 1 | ✓ |
| `1.200009.215935` | 1 | 2 | ✓ |
| `1.200009` | 1 | 1 | ✗ — level 1 needs 2 segments |
| `0.200009.215935` | 0 | 2 | ✗ — level 0 needs 1 segment |

A malformed ID exits with `INVALID_ID` before any network request is made.

### Category code routing

When `--category` is set (whether supplied as a name or an ID), the CLI inspects the leading digit of the resolved code and routes it to the correct API parameter:
- `0.X` → `category=0.X`
- `1.X.Y` → `sub_category=1.X.Y`
- `2.X.Y.Z` → `product_category=2.X.Y.Z`

### Trade type mapping

| `--trade-type` value | API `trade_type` |
|----------------------|-----------------|
| `sale` | `1` |
| `free` | `2` |
| `wanted` | `3` |

### Seller mapping

| `--seller` value | API `dealer_segment` |
|------------------|---------------------|
| `private` | `1` |
| `dealer` | `3` |

### Shipping mapping

| `--shipping` value | API `shipping_types` |
|--------------------|---------------------|
| `any` | (not sent) |
| `shippable` | `0` |

### JSON output

```json
{
  "results": [
    {
      "id": "20211144",
      "title": "Apple iPhone 11 med 64 GB",
      "price": 1000,
      "currency": "DKK",
      "location": "København S",
      "distance_km": null,
      "trade_type": "Til salg",
      "flags": ["private", "shipping_exists", "buy_now"],
      "image_url": "https://images.dbastatic.dk/...",
      "url": "https://www.dba.dk/recommerce/forsale/item/20211144",
      "created_at": 1775335113000
    }
  ],
  "total": 53,
  "page": 1,
  "is_last_page": false
}
```

#### Field notes

| Field | Notes |
|-------|-------|
| `id` | Numeric string ad ID. Pass to `detail` for full info. |
| `price` | Price in DKK as integer. `null` if not applicable (e.g. free items). |
| `currency` | Always `"DKK"`. |
| `distance_km` | Distance from search location in km, or `null` if no location filter used or distance is 0. |
| `trade_type` | Raw Danish label from API: `"Til salg"`, `"Gives væk"`, `"Ønsker at købe"`. |
| `flags` | Array of API flags, e.g. `"private"`, `"shipping_exists"`, `"buy_now"`. |
| `image_url` | Primary image URL, or `null` if no image. |
| `created_at` | Unix timestamp in milliseconds. |
| `is_last_page` | `true` when the current page is the last available page. |

### Error cases

Missing required context — returns no error; an empty `results` array with `total: 0` is valid.

Malformed location or category ID (validated before any network request):

```json
{ "error": "Invalid location ID \"1.200009\": nesting level 1 requires exactly 2 segments after the prefix, but got 1. Run \"locations --tree\" to browse valid IDs.", "code": "INVALID_ID" }
```

Unknown location or category name:

```json
{ "error": "Location not found: \"Bagenkop\". Use \"locations --tree\" to browse valid location names and IDs.", "code": "NOT_FOUND" }
```

API unreachable or non-2xx:

```json
{ "error": "Request failed: 500 Internal Server Error", "code": "API_ERROR" }
```

---

## `detail`

Fetch full details for a single DBA ad by its numeric ID.

```bash
bun run src/cli.ts detail <id> [--format json|table|plain]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `id` | Required. The numeric ad ID (e.g. `20211144`). Obtain from `search` results. |

### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--format` | string | `json` | Output format: `json`, `table`, or `plain` |

### JSON output

```json
{
  "id": "20211144",
  "title": "Apple iPhone 11 med 64 GB",
  "description": "Full ad text description...",
  "price": 1000,
  "currency": "DKK",
  "location": {
    "city": "København S",
    "postal_code": "2300",
    "lat": 55.67,
    "lon": 12.57
  },
  "category": {
    "id": 39,
    "name": "Mobiltelefoner",
    "path": ["Elektronik og hvidevarer", "Telefoner og telefontilbehør", "Mobiltelefoner"]
  },
  "condition": "Som ny - ingen synlige brugsspor",
  "extras": [
    { "label": "Stand", "value": "Som ny - ingen synlige brugsspor" },
    { "label": "Mærke", "value": "Apple" }
  ],
  "seller": {
    "type": "private",
    "is_webstore": false,
    "owner_id": 1672872658
  },
  "images": {
    "count": 3,
    "urls": ["https://images.dbastatic.dk/..."]
  },
  "url": "https://www.dba.dk/recommerce/forsale/item/20211144",
  "last_edited": "2026-04-04T20:52:26.461126+02:00",
  "is_active": true,
  "shipping": {
    "eligible": true,
    "seller_pays": false,
    "buy_now": true
  }
}
```

#### Field notes

| Field | Notes |
|-------|-------|
| `description` | Full text of the ad. May contain newlines. |
| `price` | Integer DKK, or `null` for free/wanted ads. |
| `location.lat` / `location.lon` | Coordinates, or `null` if not provided. |
| `condition` | Human-readable Danish condition string from `extras`, or `null` if not present. Extracted from the `extras` item with `id === "condition"`. |
| `extras` | All attribute pairs from the ad. Label and value are both Danish strings. |
| `seller.type` | `"private"` if `isWebstore` is false; `"webstore"` if true. |
| `is_active` | `true` if `!itemData.meta.isInactive && !itemData.disposed`. |
| `shipping.eligible` | `true` if the item can be shipped. |
| `shipping.seller_pays` | `true` if the seller covers shipping cost. |
| `shipping.buy_now` | `true` if buy-now is enabled (transactable). |

### Error cases

Ad not found (404):

```json
{ "error": "Ad not found: 99999999", "code": "NOT_FOUND" }
```

Invalid ID (non-numeric):

```json
{ "error": "Invalid ad ID: must be a numeric string", "code": "INVALID_INPUT" }
```

API unreachable or non-2xx:

```json
{ "error": "Request failed: 500 Internal Server Error", "code": "API_ERROR" }
```

---

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, full structured data |
| `table` | Quick human-readable overview of list results |
| `plain` | Easy reading of individual records (`detail`) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

---

## API reference

### Base URL

```
https://www.dba.dk
```

### Required headers (all requests)

```
User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0
Accept: application/json
Accept-Encoding: gzip, deflate, br
```

### Search endpoint

```
GET /recommerce/forsale/search/api/search/SEARCH_ID_BAP_COMMON
```

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Keyword search |
| `page` | int | Page number (1-based) |
| `price_from` | int | Min price DKK |
| `price_to` | int | Max price DKK |
| `condition` | int | 1–5 |
| `trade_type` | int | 1=for sale, 2=free, 3=wanted |
| `dealer_segment` | int | 1=private, 3=dealer |
| `published` | int | 1=today only |
| `shipping_types` | int | 0=local pickup / Fiks færdig |
| `location` | string | Area code e.g. `0.200010` |
| `category` | string | Top-level code e.g. `0.90` |
| `sub_category` | string | Sub-level code e.g. `1.90.82` |
| `product_category` | string | Leaf code e.g. `2.90.82.5` |

Note: the `sort` parameter is not reliably supported and is not exposed.

### Item detail endpoint

```
GET /recommerce/forsale/item/{id}
```

With header `Accept: application/json`.

### Retry policy

`apiFetch` retries on 429 and 5xx responses with exponential backoff and jitter:
- Max retries: 6
- Base delay: 500 ms
- Max delay: 5000 ms
- Jitter: random ±50%

---
name: dba-search
version: 1.0.0
description: >
  Make sure to use this skill whenever the user wants to search for second-hand goods,
  used items, or classified ads in Denmark — even if they don't mention DBA or Den Blå
  Avis specifically. Also use it when they want to buy or sell used items in Denmark,
  find cheap electronics, furniture, clothing, cars, bikes, or any goods on the Danish
  second-hand market, or when they ask about prices for used items in Denmark.
  Trigger phrases include: dba, den blå avis, brugt, brugte ting, second-hand, secondhand,
  used goods denmark, find brugt, køb brugt, sælg brugt, brugtmarked, loppemarked,
  search dba, dba.dk, classified ads denmark, danish classifieds, find second-hand,
  billige varer, brugt iphone, brugt cykel, brugt computer, brugt møbel, used bike denmark,
  used electronics denmark, used car parts denmark, buy used in denmark, sell used denmark,
  cheap used, hvad koster brugt, where to buy second-hand in denmark, danish marketplace,
  second-hand marketplace denmark, privat salg, privatsalg.
context: fork
allowed-tools: Bash(bun run skills/dba-search/cli/src/cli.ts *)
---

# DBA Search Skill

Search and browse Denmark's largest second-hand marketplace, [DBA.dk (Den Blå Avis)](https://www.dba.dk), directly from the command line. No authentication required.

## When to use this skill

Invoke this skill whenever the user wants to:

- Search for second-hand or used goods in Denmark
- Find classified ads on DBA.dk (Den Blå Avis)
- Look up prices for used items on the Danish market
- Browse categories of used goods (electronics, furniture, cars, bikes, clothing, etc.)
- Filter listings by price, condition, location, seller type, or trade type
- Get full details about a specific DBA listing
- Find free items (Gives væk) or wanted ads (Ønsker at købe)
- Search for items in a specific Danish region or city

## Commands

### Browse categories

```bash
bun run skills/dba-search/cli/src/cli.ts categories [--path <path>] [--tree] [--format json|table|plain]
```

Use this to discover category codes before searching. The `id` returned here is passed directly to `search --category`.

Key flags:
- `--path` — optional slash-separated name path to navigate, e.g. `"Elektronik"` or `"Elektronik/Mobiltelefoner"` (case-insensitive partial match)
- `--tree` — show full nested hierarchy from the matched node
- `--format json|table|plain`

### Browse locations

```bash
bun run skills/dba-search/cli/src/cli.ts locations [--path <path>] [--tree] [--format json|table|plain]
```

Use this to discover location codes before searching. The `id` returned here is passed directly to `search --location`.

Key flags:
- `--path` — optional slash-separated region path, e.g. `"Sjælland"` or `"Sjælland/København"` (case-insensitive partial match)
- `--tree` — show full nested hierarchy
- `--format json|table|plain`

### Search listings

```bash
bun run skills/dba-search/cli/src/cli.ts search [options]
```

Key flags:
- `--query` / `-q` — keyword search (can be empty to browse all)
- `--filter` — client-side substring filter applied to result titles
- `--price-from` / `--price-to` — price range in DKK
- `--category` — category code from `categories` (e.g. `0.93`, `1.90.82`, `2.90.82.5`)
- `--location` — location code from `locations` (e.g. `0.200010`)
- `--condition` — `1`=brand new, `2`=like new, `3`=good used, `4`=visible wear, `5`=needs repair
- `--trade-type` — `sale`, `free`, or `wanted`
- `--seller` — `private` or `dealer`
- `--shipping` — `any` or `shippable`
- `--today` — only listings from today
- `--page` — page number (default: 1)
- `--limit` — max results client-side (default: 20, max: 100)
- `--format json|table|plain`

### Get ad details

```bash
bun run skills/dba-search/cli/src/cli.ts detail <id> [--format json|table|plain]
```

Fetch the full listing detail for a single ad by its numeric ID (obtained from `search` results).

---

## How to use effectively

**Natural workflow: `categories` → `search` → `detail`.**

1. Use `categories` (optionally with `--path`) to find a category code matching what the user wants.
2. Use `locations` to find a location code if the user specifies a region or city.
3. Use `search` with the category/location codes to get matching listings.
4. Use `detail <id>` to inspect a specific listing in full, including description, extras, and shipping info.

**Omit `--query` to browse.** Passing no `--query` (or an empty string) returns all listings in the selected category/location. This is useful when the user wants to browse rather than search for a specific item.

**Use `--filter` for title-level filtering.** The DBA API does not always reliably enforce keyword filters. Use `--filter` as a client-side safety net to ensure result titles contain the expected term.

**Use `--limit` for quick overviews.** A small `--limit` (e.g. 5) is useful for a quick sample. Use `--page` to navigate through results.

**Category code routing.** The `--category` flag accepts any code from `categories` — the CLI automatically routes it to the right API parameter (`category`, `sub_category`, or `product_category`) based on the leading digit of the code.

---

## Usage examples

### Find used iPhones under 2000 DKK

```bash
bun run skills/dba-search/cli/src/cli.ts search --query "iPhone" --price-to 2000 --format table
```

### Browse electronics category

```bash
# First, find the category code
bun run skills/dba-search/cli/src/cli.ts categories --path "Elektronik" --format table

# Then search within it
bun run skills/dba-search/cli/src/cli.ts search --category 0.93 --format table
```

### Find free items in Copenhagen area

```bash
# Get location code
bun run skills/dba-search/cli/src/cli.ts locations --path "Sjælland/København" --format table

# Search for free items
bun run skills/dba-search/cli/src/cli.ts search --trade-type free --location 0.200030 --format table
```

### Find like-new bicycles from private sellers

```bash
bun run skills/dba-search/cli/src/cli.ts search \
  --query "cykel" \
  --condition 2 \
  --seller private \
  --format table
```

### Find items with shipping available, published today

```bash
bun run skills/dba-search/cli/src/cli.ts search \
  --query "laptop" \
  --shipping shippable \
  --today \
  --format table
```

### Get full details on a listing

```bash
bun run skills/dba-search/cli/src/cli.ts detail 20211144 --format plain
```

### Browse all Bornholm listings

```bash
# Get location code
bun run skills/dba-search/cli/src/cli.ts locations --path "Bornholm"

# Browse all listings in the area
bun run skills/dba-search/cli/src/cli.ts search --location 0.200010 --limit 10 --format table
```

### Explore the full category tree

```bash
bun run skills/dba-search/cli/src/cli.ts categories --tree --format json
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

## Notes

- All data is fetched live from DBA.dk — no credentials required.
- Pagination is 1-indexed (`--page 1` is the first page).
- `--limit` caps the number of results returned by the CLI; the API may return more per page.
- The `sort` parameter is not reliably supported by the DBA API and is not exposed.
- Category and location codes from `categories`/`locations` can be used directly with `search`.
- `distance_km` in search results is `null` unless a location-based search returns a nonzero distance.

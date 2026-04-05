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
- `--category` — category code (e.g. `0.93`, `1.90.82`, `2.90.82.5`) **or a plain name** (e.g. `Elektronik`, `Bilstereo`) — resolved automatically
- `--location` — location code (e.g. `0.200010`, `1.200009.215935`) **or a plain name** (e.g. `Bagenkop`, `Bornholm`) — resolved automatically
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

**Natural workflow: `search` → `detail`** (or `categories`/`locations` → `search` → `detail` if you need to browse the hierarchy first).

Both `--category` and `--location` accept plain names directly — you do not need to call `categories` or `locations` first if you already know the name:

```bash
# Plain names work directly in search
bun run skills/dba-search/cli/src/cli.ts search --location Bagenkop --category Elektronik --limit 10
```

If the name is not found the CLI exits with `NOT_FOUND` and suggests running `categories --tree` or `locations --tree` to browse. Use those commands when you need to discover names or when you want a code to reuse across multiple searches.

1. *(Optional)* Use `categories` / `locations` with `--tree` to discover the exact name or code for a category/region.
2. Use `search` with names or codes to get matching listings.
3. Use `detail <id>` to inspect a specific listing in full, including description, extras, and shipping info.

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

### Search by plain location and category name (no lookup step needed)

```bash
bun run skills/dba-search/cli/src/cli.ts search --location Bagenkop --category Elektronik --limit 10
```

### Browse electronics category

```bash
# First, find the category code
bun run skills/dba-search/cli/src/cli.ts categories --path "Elektronik" --format table

# Then search within it
bun run skills/dba-search/cli/src/cli.ts search --category "Elektronik" --format table
```

### Find free items in Copenhagen area

```bash
# Get location code
bun run skills/dba-search/cli/src/cli.ts locations --path "Bornholm" --format table

# Search for free items
bun run skills/dba-search/cli/src/cli.ts search --trade-type free --location "Bornholm" --format table
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
bun run skills/dba-search/cli/src/cli.ts search --location "Bornholm" --limit 10 --format table
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

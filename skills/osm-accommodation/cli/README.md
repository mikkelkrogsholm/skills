# osm-accommodation CLI

Find hotels, hostels, guest houses, motels, and B&Bs anywhere in Europe and beyond using [OpenStreetMap](https://www.openstreetmap.org) data. No API key. No account. Works immediately after `bun install`.

## Data source

This CLI uses two public, no-auth APIs:

| API | Purpose |
|-----|---------|
| [Nominatim](https://nominatim.openstreetmap.org) | Geocode a place name → bounding box |
| [Overpass API](https://overpass-api.de) | Query OSM nodes within a bounding box |

**Rate limits:** Nominatim requires a `User-Agent` header and allows 1 request/second per IP. The Overpass API is a shared public resource — this CLI uses a mirror (`overpass.kumi.systems`) as the primary endpoint with automatic fallback to `overpass-api.de`.

**Coverage:** Excellent in Western and Central Europe (Netherlands, Germany, France, Spain, Italy, UK, Austria, Czech Republic, Portugal, Scandinavia, and more). Good in Eastern Europe and major cities worldwide. Rural areas outside Europe are patchier.

**What this cannot provide:** Live pricing, availability, or photos. OSM is a geographic database, not a booking engine.

---

## Commands

### `search <location>`

Geocode a location name and find accommodation within its bounding box.

**Positional argument:** `location` — city, neighbourhood, region, or address (required)

**Flags:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--type` | string | `all` | Filter by type: `hotel`, `hostel`, `guest_house`, `motel`, `all` |
| `--stars` | number | — | Minimum star rating; excludes properties with no star data |
| `--amenity` | string | — | Comma-separated amenities: `wifi`, `breakfast`, `parking`, `pool`, `wheelchair` |
| `--limit` | number | `20` | Client-side cap on results |
| `--format` | string | `json` | Output format: `json`, `table`, `plain` |

**Example:**
```bash
bun run src/cli.ts search Amsterdam
bun run src/cli.ts search "Paris 10th" --type hotel --amenity wifi,breakfast
bun run src/cli.ts search Berlin --stars 3 --limit 5 --format table
```

**JSON output shape:**
```json
{
  "type": "osm_accommodation_search",
  "location": "Amsterdam",
  "matched_location": "Amsterdam, Noord-Holland, Netherlands, ...",
  "results": [
    {
      "id": 123456789,
      "name": "Hotel V Nesplein",
      "type": "hotel",
      "stars": 4,
      "address": {
        "street": "Nes 49",
        "postcode": "1012 KD",
        "city": "Amsterdam",
        "country": "NL"
      },
      "contact": {
        "phone": "+31 20 623 0066",
        "email": null,
        "website": "https://www.hotelv.nl"
      },
      "amenities": {
        "wifi": true,
        "breakfast": null,
        "pool": false,
        "parking": null,
        "wheelchair": null,
        "smoking": "no"
      },
      "rooms": null,
      "brand": null,
      "description": null,
      "coordinates": {
        "lat": 52.3731,
        "lon": 4.8958
      },
      "osm_id": 123456789
    }
  ],
  "count": 1
}
```

---

### `near <lat> <lon>`

Find accommodation near a coordinate pair. Skips the Nominatim geocoding step — useful when you already have coordinates.

**Positional arguments:** `lat` and `lon` as decimal numbers (required)

**Flags:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--radius` | number | `5` | Search radius in km |
| `--type` | string | `all` | Same as `search` |
| `--stars` | number | — | Same as `search` |
| `--amenity` | string | — | Same as `search` |
| `--limit` | number | `20` | Same as `search` |
| `--format` | string | `json` | Same as `search` |

**Radius to bounding box:** `delta = radius / 111` degrees (1 degree ≈ 111 km).

**Example:**
```bash
bun run src/cli.ts near 52.3731 4.8922              # Amsterdam center, 5 km radius
bun run src/cli.ts near 48.8566 2.3522 --radius 2   # Paris center, 2 km
bun run src/cli.ts near 51.5074 -0.1278 --type hostel --format plain
```

**JSON output shape:**
```json
{
  "type": "osm_accommodation_near",
  "lat": 52.3731,
  "lon": 4.8922,
  "radius": 5,
  "results": [ /* same Accommodation shape as search */ ],
  "count": 12
}
```

---

## Field reference

### Accommodation object

| Field | Type | Notes |
|-------|------|-------|
| `id` | number | OSM node/way/relation ID |
| `name` | string | Property name |
| `type` | string | `hotel`, `hostel`, `guest_house`, `motel` |
| `stars` | number \| null | Official star classification; null if not tagged. `"4s"` → `4` |
| `address.street` | string \| null | Combined street + house number |
| `address.postcode` | string \| null | |
| `address.city` | string \| null | |
| `address.country` | string \| null | ISO country code (e.g. `NL`, `DE`, `FR`) |
| `contact.phone` | string \| null | |
| `contact.email` | string \| null | |
| `contact.website` | string \| null | |
| `amenities.wifi` | boolean \| null | `true`=wifi available, `false`=no wifi, `null`=not tagged |
| `amenities.breakfast` | boolean \| null | Same semantics |
| `amenities.pool` | boolean \| null | Same semantics |
| `amenities.parking` | boolean \| null | `true` if parking exists and is not `"no"` |
| `amenities.wheelchair` | boolean \| null | Same semantics |
| `amenities.smoking` | string \| null | Raw value: `"yes"`, `"no"`, `"outside"` |
| `rooms` | number \| null | Number of rooms if tagged |
| `brand` | string \| null | Brand or operator chain name |
| `description` | string \| null | Free-text description |
| `coordinates.lat` | number | |
| `coordinates.lon` | number | |
| `osm_id` | number | Same as `id` — included for explicitness |

---

## Error output

All errors go to **stderr** as JSON with exit code `1`:

```json
{ "error": "Location not found: \"Atlantis\"", "code": "LOCATION_NOT_FOUND" }
{ "error": "Overpass API unavailable (both endpoints failed)", "code": "API_UNAVAILABLE" }
{ "error": "No accommodation found matching your filters", "code": "NO_RESULTS" }
{ "error": "lat and lon must be valid decimal numbers", "code": "INVALID_ARGS" }
```

Error codes: `LOCATION_NOT_FOUND`, `API_UNAVAILABLE`, `NO_RESULTS`, `INVALID_ARGS`, `MISSING_REQUIRED`

---

## Known limitations

1. **No pricing or availability.** OSM is a geographic database; prices require commercial API partnerships.
2. **Star ratings are sparse.** Many properties do not have `stars` tagged. Using `--stars` will exclude all untagged properties, even high-quality ones.
3. **Coverage varies.** Major European cities have excellent coverage. Rural areas and cities outside Europe are patchier.
4. **Data can be outdated.** OSM is community-maintained; closed properties are not always removed promptly.
5. **Overpass server load.** The Overpass API is a shared public resource that is sometimes slow. The CLI retries automatically on a mirror.
6. **Bounding box search.** The `search` command covers the geocoded bounding box of the location, which may include properties slightly outside the city limits.

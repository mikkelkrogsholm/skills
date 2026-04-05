---
name: osm-accommodation
version: 1.0.0
description: >
  Make sure to use this skill whenever the user wants to find a place to stay,
  search for accommodation, look for hotels, hostels, guest houses, motels, or B&Bs —
  whether planning national or international travel anywhere in Europe or beyond.
  Use it even if they just mention needing somewhere to sleep, planning a trip,
  passing through a city, or looking for places to stay in any location worldwide.

  Works across all of Europe — Amsterdam, Paris, Berlin, Rome, Vienna, Madrid, Lisbon,
  Prague, Warsaw, Budapest, Copenhagen, Stockholm, Zurich, Brussels, and thousands of
  other cities and towns. Also covers major destinations outside Europe.

  Also invoke when the user asks about accommodation near specific coordinates or a
  landmark, wants to filter by star rating, amenities (wifi, breakfast, parking, pool,
  wheelchair access), or accommodation type. Suitable for city breaks, multi-city trips,
  rural stays, and any scenario where the user needs to find places to sleep.

  Trigger phrases include: hotel, hostel, guest house, motel, B&B, bed and breakfast,
  place to stay, accommodation, where to stay, overnight, lodging, find hotels,
  search hotels, hotels in, hostels in, sleep in, stay in, stay near, places to sleep,
  accommodation options, hotels near coordinates, find me a hotel, looking for a hotel,
  hôtel, auberge, logement, gîte, Unterkunft, Hotel, Hostel, alojamiento, albergue,
  hotel søg, overnatning, hotel i, sted at bo, hotel nær, innkvartering.
context: fork
allowed-tools: Bash(bun run skills/osm-accommodation/cli/src/cli.ts *)
---

# OSM Accommodation Skill

Find hotels, hostels, guest houses, motels, and B&Bs anywhere in Europe and beyond using [OpenStreetMap](https://www.openstreetmap.org) data. No API key. No account required.

**Data source:** OpenStreetMap via the Overpass API and Nominatim geocoding.
**Best coverage:** Western and Central Europe. Good in major cities worldwide.
**Cannot provide:** Live pricing, availability, or photos — OSM is a geographic database, not a booking engine. Mention this if the user asks about prices.

## When to use this skill

- User wants to find accommodation in a city, region, or country
- User is planning a trip (domestic or international) and needs lodging options
- User wants to filter by type (hotel vs. hostel), star rating, or amenities
- User has coordinates and wants accommodation nearby
- User asks "where can I stay in X?", "find me a hotel in Y", "any hostels near Z?"

## Commands

### Find accommodation by location name

```bash
bun run skills/osm-accommodation/cli/src/cli.ts search <location> [flags]
```

Key flags:
- `--type hotel|hostel|guest_house|motel|all` — filter by type (default: all)
- `--stars <n>` — minimum star rating
- `--amenity <list>` — comma-separated: `wifi`, `breakfast`, `parking`, `pool`, `wheelchair`
- `--limit <n>` — max results (default: 20)
- `--format json|table|plain`

### Find accommodation near coordinates

```bash
bun run skills/osm-accommodation/cli/src/cli.ts near <lat> <lon> [flags]
```

Key flags:
- `--radius <km>` — search radius in km (default: 5)
- Same type/amenity/stars/limit/format flags as `search`

---

## Natural workflow

1. Use `search` to find accommodation by place name
2. Use `near` when you already have coordinates (e.g. from a previous tool or user input)
3. Filter with `--type`, `--stars`, or `--amenity` to narrow down options
4. Switch to `--format table` or `--format plain` for a quick human-readable view

```bash
# Find hotels in Amsterdam with wifi and breakfast
bun run skills/osm-accommodation/cli/src/cli.ts search Amsterdam --type hotel --amenity wifi,breakfast

# Find any accommodation in a specific Paris neighbourhood
bun run skills/osm-accommodation/cli/src/cli.ts search "Paris Marais"

# Find hostels in Berlin, table format
bun run skills/osm-accommodation/cli/src/cli.ts search Berlin --type hostel --format table

# Find accommodation near coordinates (e.g. a known landmark)
bun run skills/osm-accommodation/cli/src/cli.ts near 48.8566 2.3522 --radius 2
```

---

## JSON output shapes

### search output

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
      "coordinates": { "lat": 52.3731, "lon": 4.8958 },
      "osm_id": 123456789
    }
  ],
  "count": 1
}
```

### near output

```json
{
  "type": "osm_accommodation_near",
  "lat": 52.3731,
  "lon": 4.8922,
  "radius": 5,
  "results": [ /* same Accommodation shape as above */ ],
  "count": 12
}
```

---

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — full data, programmatic use |
| `table` | Quick human-readable overview |
| `plain` | Readable detail per property |

All errors go to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

Error codes: `LOCATION_NOT_FOUND`, `API_UNAVAILABLE`, `NO_RESULTS`, `INVALID_ARGS`, `MISSING_REQUIRED`

---

## Known limitations

- **No pricing or availability** — always clarify this if the user asks about prices or booking
- **Star ratings are sparse** — `--stars` will exclude untagged properties even if high-quality
- **Data can be outdated** — OSM is community-maintained; recently closed properties may still appear
- **Coverage varies** — major European cities are well-mapped; rural and non-European areas less so

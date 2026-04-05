# European Rail CLI (via ÖBB HAFAS)

CLI for European public transport journey planning via the [ÖBB HAFAS API](https://fahrplan.oebb.at). Covers the full European rail network — Germany, Austria, Switzerland, Denmark, Netherlands, Belgium, Italy, France, and more. No API key required — authentication is embedded in the request body.

## API Base URL

```
https://fahrplan.oebb.at/bin/mgate.exe
```

All requests are HTTP POST with `Content-Type: application/json`.

### Request envelope

Every request wraps its method in this envelope:

```json
{
  "auth": { "type": "AID", "aid": "OWDL4fE4ixNiPBBm" },
  "client": { "type": "IPH", "id": "OEBB", "v": "6030600", "name": "oebbPROD-ADHOC" },
  "ver": "1.45",
  "lang": "en",
  "svcReqL": [{ "meth": "METHOD", "req": { ... }, "cfg": { "polyEnc": "GPA" } }]
}
```

### Response envelope

```json
{
  "svcResL": [{ "meth": "METHOD", "err": "OK", "res": { ... } }]
}
```

Check `svcResL[0].err !== "OK"` for errors.

### Date/time format

- **Request dates:** `YYYYMMDD` (e.g., `"20250526"`)
- **Request times:** `HHMMSS` (e.g., `"120000"`)
- **Response times:** `HHMMSS`. If the string is longer than 6 characters, the leading digits are a **day offset** (e.g., `"1120000"` = next day 12:00:00). Parse by taking `time.slice(-6)` for the HH:MM:SS part and `parseInt(time.slice(0, -6))` for the day offset.
- **Timezone:** Europe/Vienna (UTC+1 in winter, UTC+2 in summer)
- **Coordinates:** WGS84 × 1,000,000 (e.g., `x=16376532` → longitude `16.376532`)

### Common data structure

All methods except `LocMatch` return a `res.common` object:
- `res.common.locL[]` — stations/stops array; transit legs reference these by index (`locX`)
- `res.common.prodL[]` — products/lines array; each has `name`, `number`, `cls` (bitmask), `prodCtx.catOut` (category like `"ICE"`, `"NJ"`, `"EC"`), `oprX` (operator index)
- `res.common.opL[]` — operators array; each has `name`

### Products / bitmasks

| Product ID | Bitmask | Description | Short |
|---|---|---|---|
| `nationalExpress` | 1 | InterCityExpress & RailJet | ICE/RJ |
| `national` | 2, 4 | InterCity & EuroCity | IC/EC |
| `interregional` | 8, 4096 | Durchgangszug & EuroNight | D/EN |
| `regional` | 16 | Regional & RegionalExpress | R/REX |
| `suburban` | 32 | S-Bahn | S |
| `bus` | 64 | Bus | B |
| `ferry` | 128 | Ferry | F |
| `subway` | 256 | U-Bahn | U |
| `tram` | 512 | Tram | T |
| `onCall` | 2048 | On-call transit | on-call |

All products bitmask = `7167` (sum of 1+2+4+8+16+32+64+128+256+512+2048+4096).

Night trains bitmask = `4096` (EuroNight). Additionally filter client-side: keep legs where `prodCtx.catOut` starts with `"NJ"`, `"EN"`, or `"CNL"`, or the line name contains `"Nightjet"`.

Product filtering is applied **client-side** after the fetch.

---

## Station names vs IDs

All commands that take a station (`--from`, `--to`, `--station`) accept **either a station name or a numeric ID**. Prefer names — the CLI resolves them automatically via a LocMatch lookup.

- **Exact or single match** → used immediately, no extra step needed
- **Ambiguous name** → CLI returns `AMBIGUOUS_STATION` error with a list of `options` (name + id); retry with a name from that list or the numeric `id`
- **No match** → CLI returns `NO_STATION_FOUND` error

Use the `stations` command to browse when you're unsure of the exact name.

---

## Commands

### `stations` — Search for stations

Search for stations and stops by name. Useful for discovering the exact name a station is known by in the HAFAS system.

**HAFAS method:** `LocMatch`

**Flags:**

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--query` | string | yes | — | Station name to search |
| `--results` | number | no | 10 | Max results (1–50) |
| `--format` | string | no | json | Output format: json, table, plain |

**HAFAS request:**

```json
{
  "meth": "LocMatch",
  "req": {
    "input": {
      "loc": { "type": "S", "name": "<query>" },
      "maxLoc": 10,
      "field": "S"
    }
  }
}
```

**HAFAS response field:** `res.match.locL[]` — array of location objects:

```json
{
  "lid": "A=1@O=Wien Hbf@X=16376532@Y=48185127@U=81@L=1190100@",
  "type": "S",
  "name": "Wien Hbf",
  "extId": "1190100",
  "crd": { "x": 16376532, "y": 48185127 }
}
```

Extract `id` from `extId`. Compute `longitude` as `crd.x / 1_000_000` and `latitude` as `crd.y / 1_000_000`.

**JSON output:**

```json
{
  "type": "oebb_stations",
  "query": "Wien",
  "stations": [
    {
      "id": "1190100",
      "name": "Wien Hbf",
      "longitude": 16.376532,
      "latitude": 48.185127
    }
  ],
  "count": 1
}
```

**Table format** columns: `ID`, `Name`, `Longitude`, `Latitude`

**Plain format** — one station per block:
```
Wien Hbf
  ID:        1190100
  Longitude: 16.376532
  Latitude:  48.185127
```

---

### `journeys` — Plan a journey

Plan a journey between two stations.

**HAFAS method:** `TripSearch`

**Flags:**

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--from` | string | yes | — | Departure station name or numeric ID |
| `--to` | string | yes | — | Arrival station name or numeric ID |
| `--date` | string | no | today | Travel date (YYYY-MM-DD) |
| `--time` | string | no | now | Departure time (HH:MM) |
| `--results` | number | no | 5 | Number of journeys to return (1–10) |
| `--transfers` | number | no | -1 | Max transfers (-1 = unlimited) |
| `--products` | string | no | all | Comma-separated product types to include. Valid: `nationalExpress,national,interregional,regional,suburban,bus,ferry,subway,tram,onCall` |
| `--night` | boolean | no | false | Include only night/sleeper trains (sets bitmask to 4096, then filters client-side by category NJ/EN/CNL or name containing "Nightjet") |
| `--stopovers` | boolean | no | false | Include intermediate stops for each transit leg |
| `--format` | string | no | json | Output format: json, table, plain |

When `--products` is specified, compute the bitmask by summing the bitmask values for each named product. When `--night` is set, force bitmask to `4096` and ignore `--products`.

**HAFAS request:**

```json
{
  "meth": "TripSearch",
  "req": {
    "depLocL": [{ "type": "S", "lid": "L=<from_id>" }],
    "arrLocL": [{ "type": "S", "lid": "L=<to_id>" }],
    "outDate": "20250526",
    "outTime": "120000",
    "outFrwd": true,
    "maxChg": -1,
    "minChgTime": 0,
    "getPT": true,
    "getPasslist": false,
    "getTariff": false,
    "ushrp": true,
    "getPolyline": false
  },
  "cfg": { "polyEnc": "GPA" }
}
```

Set `getPasslist: true` when `--stopovers` is used. Set `maxChg` to the value of `--transfers`. Limit results client-side to `--results` count.

**HAFAS response:** `res.outConL[]` — array of journey connections. Each connection has:
- `date` — base date string `YYYYMMDD`
- `legs[]` — array of legs

**Leg types:**
- `type: "JNY"` — transit leg. Fields:
  - `dep.locX` → index into `common.locL` for departure stop
  - `dep.dTimeS` → scheduled departure time (HHMMSS, may have day offset prefix)
  - `dep.dTimeR` → realtime departure time (HHMMSS, may have day offset prefix); null if unavailable
  - `dep.dPlatfS` → scheduled platform; null if unavailable
  - `dep.dPlatfR` → realtime platform; null if unavailable
  - `dep.dCncl` → boolean, true if departure is cancelled
  - `arr.locX` → index into `common.locL` for arrival stop
  - `arr.aTimeS` → scheduled arrival time (HHMMSS, may have day offset prefix)
  - `arr.aTimeR` → realtime arrival time (HHMMSS, may have day offset prefix); null if unavailable
  - `arr.aPlatfS` → scheduled platform; null if unavailable
  - `arr.aPlatfR` → realtime platform; null if unavailable
  - `arr.aCncl` → boolean, true if arrival is cancelled
  - `jny.prodX` → index into `common.prodL`
  - `jny.dirTxt` → destination direction text
  - `jny.jid` → journey/trip ID
  - `jny.stopL[]` → intermediate stops (populated when `getPasslist: true`)

- `type: "WALK"` or `type: "TRSF"` — walking/transfer leg. Fields:
  - `dep.locX`, `arr.locX` — stop indices
  - `dep.dTimeS`, `arr.aTimeS` — times
  - `gis.dist` — distance in metres; null if unavailable

Resolve stop names via `common.locL[locX].name` and `common.locL[locX].extId`. Resolve product via `common.prodL[prodX]`: use `name` for line name, `prodCtx.catOut` for category.

**Intermediate stop shape** (from `jny.stopL[]` when `getPasslist: true`):
```json
{
  "locX": 5,
  "aTimeS": "131500",
  "aTimeR": "131500",
  "dTimeS": "131700",
  "dTimeR": "131700"
}
```

**JSON output:**

```json
{
  "type": "oebb_journeys",
  "from": "1190100",
  "to": "8100002",
  "date": "2025-05-26",
  "time": "12:00",
  "journeys": [
    {
      "legs": [
        {
          "type": "journey",
          "line": "RJ 123",
          "category": "RJ",
          "direction": "Salzburg Hbf",
          "origin": "Wien Hbf",
          "originId": "1190100",
          "departure": "2025-05-26T12:00:00+02:00",
          "plannedDeparture": "2025-05-26T12:00:00+02:00",
          "departurePlatform": "3",
          "plannedDeparturePlatform": "3",
          "destination": "Salzburg Hbf",
          "destinationId": "8100002",
          "arrival": "2025-05-26T14:50:00+02:00",
          "plannedArrival": "2025-05-26T14:50:00+02:00",
          "arrivalPlatform": "1",
          "plannedArrivalPlatform": "1",
          "cancelled": false,
          "stopovers": []
        },
        {
          "type": "walk",
          "origin": "Salzburg Hbf",
          "originId": "8100002",
          "destination": "Salzburg Hbf",
          "destinationId": "8100002",
          "departure": "2025-05-26T14:50:00+02:00",
          "arrival": "2025-05-26T14:55:00+02:00",
          "distance": 200
        }
      ],
      "departure": "2025-05-26T12:00:00+02:00",
      "arrival": "2025-05-26T14:50:00+02:00",
      "duration": "2h 50m",
      "transfers": 0,
      "isNightTrain": false
    }
  ],
  "count": 5
}
```

**Field notes:**

- `type` is `"journey"` for transit legs and `"walk"` for walking/transfer legs
- `departure` / `arrival` are ISO 8601 strings with Vienna timezone offset (e.g., `+01:00` or `+02:00`); use realtime time if available, else planned
- `plannedDeparture` / `plannedArrival` always reflect the scheduled time
- `departurePlatform` / `arrivalPlatform` use realtime platform if available, else planned; null if not known
- `plannedDeparturePlatform` / `plannedArrivalPlatform` always reflect the scheduled platform; null if not known
- `cancelled` is true when `dep.dCncl` or `arr.aCncl` is true on any relevant side
- `stopovers` is an empty array `[]` unless `--stopovers` is passed; when passed, contains stopover objects (see below)
- Journey-level `departure` is the first leg's departure; `arrival` is the last leg's arrival
- `duration` is formatted as `"Xh Ym"` (hours and minutes between first departure and last arrival)
- `transfers` is the count of transit legs minus 1 (minimum 0); walk-only journeys have 0 transfers
- `isNightTrain` is `true` when any transit leg has a category starting with `"NJ"`, `"EN"`, or `"CNL"`, or a line name containing `"Nightjet"` (case-insensitive)
- `distance` on walk legs is in metres; null if `gis.dist` is unavailable
- `count` reflects the number of journeys returned (after client-side limiting to `--results`)

**Stopover shape** (when `--stopovers` is set, each entry in `stopovers`):

```json
{
  "stop": "Linz Hbf",
  "stopId": "8100173",
  "arrival": "2025-05-26T13:15:00+02:00",
  "plannedArrival": "2025-05-26T13:15:00+02:00",
  "departure": "2025-05-26T13:17:00+02:00",
  "plannedDeparture": "2025-05-26T13:17:00+02:00"
}
```

`arrival` / `departure` use realtime time if available, else planned. Null if the stop only has one of arrival or departure (e.g., origin or terminus of the line).

**Table format** — one row per journey:

| # | Departure | Arrival | Duration | Transfers | Night |
|---|-----------|---------|----------|-----------|-------|
| 1 | 12:00 | 14:50 | 2h 50m | 0 | No |

**Plain format** — one journey per block, with legs indented:

```
Journey 1: Wien Hbf → Salzburg Hbf
  Departure: 2025-05-26T12:00:00+02:00
  Arrival:   2025-05-26T14:50:00+02:00
  Duration:  2h 50m
  Transfers: 0
  Legs:
    [RJ 123] Wien Hbf 12:00 → Salzburg Hbf 14:50 (platform 3)
    [Walk]   Salzburg Hbf → Salzburg Hbf (200m)
```

---

### `departures` — Station departure board

Show upcoming departures from a station.

**HAFAS method:** `StationBoard`

**Flags:**

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--station` | string | yes | — | Station name or numeric ID |
| `--when` | string | no | now | Date and time (YYYY-MM-DDTHH:MM) |
| `--duration` | number | no | 60 | Time window in minutes |
| `--results` | number | no | 20 | Max results |
| `--products` | string | no | all | Comma-separated product types (same values as `journeys`) |
| `--format` | string | no | json | Output format: json, table, plain |

**HAFAS request:**

```json
{
  "meth": "StationBoard",
  "req": {
    "type": "DEP",
    "stbLoc": { "type": "S", "lid": "L=<station_id>" },
    "maxJny": 20,
    "date": "20250526",
    "time": "120000",
    "dur": 60
  }
}
```

Product filtering is applied client-side after the fetch (see [Products](#products) section).

**HAFAS response:** `res.jnyL[]` — array of departures. Each entry has:
- `jny.stbStop` — the board stop info:
  - `locX` — index into `common.locL`
  - `dTimeS` — scheduled departure time (HHMMSS, may have day offset prefix)
  - `dTimeR` — realtime departure time (HHMMSS, may have day offset prefix); null if unavailable
  - `dPlatfS` — scheduled platform; null if unavailable
  - `dPlatfR` — realtime platform; null if unavailable
  - `dCncl` — boolean, true if cancelled
- `jny.prodX` — product index → `common.prodL[prodX]`
- `jny.dirTxt` — destination name
- `jny.date` — base date string `YYYYMMDD`
- `jny.jid` — trip ID

Compute `delay` in seconds: if realtime time is available, subtract scheduled from realtime (may be negative for early arrivals). Null if realtime is unavailable.

**JSON output:**

```json
{
  "type": "oebb_departures",
  "station": "1190100",
  "when": "2025-05-26T12:00:00+02:00",
  "departures": [
    {
      "line": "RJ 123",
      "category": "RJ",
      "direction": "Salzburg Hbf",
      "when": "2025-05-26T12:00:00+02:00",
      "plannedWhen": "2025-05-26T12:00:00+02:00",
      "delay": 0,
      "platform": "3",
      "plannedPlatform": "3",
      "cancelled": false,
      "tripId": "1|12345|0|81|26052025"
    }
  ],
  "count": 20
}
```

**Field notes:**

- `when` uses realtime time if available, else planned time
- `plannedWhen` always reflects scheduled time
- `delay` is in seconds (integer); null if realtime departure time is unavailable
- `platform` uses realtime platform if available, else planned; null if not known
- `plannedPlatform` always reflects the scheduled platform; null if not known
- `cancelled` is true when `dCncl` is true
- `tripId` is `jny.jid`

**Table format** columns: `Line`, `Category`, `Direction`, `When`, `Delay`, `Platform`, `Cancelled`

**Plain format** — one departure per block:
```
RJ 123 → Salzburg Hbf
  When:      2025-05-26T12:00:00+02:00
  Planned:   2025-05-26T12:00:00+02:00
  Delay:     0s
  Platform:  3
  Cancelled: No
  Trip ID:   1|12345|0|81|26052025
```

---

### `arrivals` — Station arrival board

Show upcoming arrivals at a station.

**HAFAS method:** `StationBoard`

Same as `departures` but with `type: "ARR"`. Uses `aTimeS`, `aTimeR`, `aPlatfS`, `aPlatfR`, `aCncl` from `jny.stbStop`. Origin name comes from `jny.stbStop` or `jny.stopL[0]` (first stop in journey).

**Flags:** identical to `departures` — `--station` accepts a station name or numeric ID.

**HAFAS request:**

```json
{
  "meth": "StationBoard",
  "req": {
    "type": "ARR",
    "stbLoc": { "type": "S", "lid": "L=<station_id>" },
    "maxJny": 20,
    "date": "20250526",
    "time": "120000",
    "dur": 60
  }
}
```

Product filtering is applied client-side after the fetch (see [Products](#products) section).

**JSON output:**

```json
{
  "type": "oebb_arrivals",
  "station": "1190100",
  "when": "2025-05-26T14:50:00+02:00",
  "arrivals": [
    {
      "line": "RJ 123",
      "category": "RJ",
      "origin": "Wien Hbf",
      "when": "2025-05-26T14:50:00+02:00",
      "plannedWhen": "2025-05-26T14:50:00+02:00",
      "delay": 0,
      "platform": "1",
      "plannedPlatform": "1",
      "cancelled": false,
      "tripId": "1|12345|0|81|26052025"
    }
  ],
  "count": 20
}
```

**Field notes:**

- `origin` is the origin station name for this service; sourced from `jny.stbStop` direction or first stop in `jny.stopL`
- All other fields behave identically to `departures` (using arrival times/platforms instead of departure times/platforms)

**Table format** columns: `Line`, `Category`, `Origin`, `When`, `Delay`, `Platform`, `Cancelled`

**Plain format** — one arrival per block:
```
RJ 123 from Wien Hbf
  When:      2025-05-26T14:50:00+02:00
  Planned:   2025-05-26T14:50:00+02:00
  Delay:     0s
  Platform:  1
  Cancelled: No
  Trip ID:   1|12345|0|81|26052025
```

---

## Error handling

All errors are written to **stderr** as JSON and the process exits with code `1`. Errors may include an optional `hint` field with a suggested next action.

```json
{ "error": "...", "code": "...", "hint": "..." }
```

Error codes:

| Code | Description |
|------|-------------|
| `MISSING_FROM` | `--from` was not provided |
| `MISSING_TO` | `--to` was not provided |
| `MISSING_STATION` | `--station` was not provided |
| `MISSING_QUERY` | `--query` was not provided |
| `AMBIGUOUS_STATION` | Station name matched multiple stations; response includes `options` array with `id` and `name` for each match — retry using a name from the list or the numeric `id` |
| `NO_STATION_FOUND` | Station name matched nothing; try a different search term |
| `INVALID_DATE` | `--date` value is not a valid YYYY-MM-DD date |
| `INVALID_TIME` | `--time` value is not a valid HH:MM time |
| `INVALID_WHEN` | `--when` value cannot be parsed as a datetime |
| `INVALID_PRODUCTS` | One or more `--products` values are not recognised product type IDs |
| `STATION_RESOLUTION_ERROR` | Unexpected error while resolving a station name |
| `API_ERROR` | HAFAS API returned a non-OK error code or HTTP error |

### Ambiguous station example

```json
{
  "error": "Multiple stations found for \"Wien Hbf\" — please specify one by ID",
  "code": "AMBIGUOUS_STATION",
  "hint": "Retry the command using one of the listed station IDs",
  "options": [
    { "id": "1290401", "name": "Wien Hbf (U)" },
    { "id": "1190100", "name": "Wien" }
  ]
}
```

---

## Time parsing reference

The HAFAS time format requires careful parsing:

```typescript
// time: string like "120000" or "1120000" (day offset + HHMMSS)
function parseHafasTime(date: string, time: string, tz = "Europe/Vienna"): string {
  const dayOffset = time.length > 6 ? parseInt(time.slice(0, -6)) : 0;
  const hms = time.slice(-6); // always 6 chars: HHMMSS
  const h = hms.slice(0, 2);
  const m = hms.slice(2, 4);
  const s = hms.slice(4, 6);
  // date is YYYYMMDD
  // combine and offset by dayOffset days, then format as ISO 8601 with Vienna tz offset
}
```

---

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, full data |
| `table` | Quick human-readable overview |
| `plain` | Easy reading of individual items |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

---
name: oebb
version: 1.0.0
description: >
  Make sure to use this skill whenever the user asks about train travel or public transport
  anywhere in Europe — including Germany, Austria, Switzerland, Denmark, the Netherlands,
  Belgium, Italy, France, Poland, Czech Republic, Hungary, Croatia, or any other country
  served by the European rail network. Use it for journey planning between any two European
  cities or stations, even if the user doesn't mention ÖBB or Austria specifically.
  Also use this skill for station departure boards, arrival boards, or searching for a
  station by name anywhere in Europe.
  Use it for night train and sleeper train queries across Europe: Nightjet (NJ), EuroNight
  (EN), City Night Line (CNL) — e.g., "night train from Copenhagen to Berlin",
  "sleeper train from Vienna to Paris", "how do I get from Hamburg to Zurich overnight".
  Trigger phrases include: train, tog, tog rejse, zug, bahn, train schedule, rail travel,
  journey planner, trip planner, European rail, intercity, nightjet, night jet, sleeper train,
  nachtzug, nattog, euronight, railjet, ICE, IC, EC, RJ, RegionalExpress, S-Bahn,
  departures, arrivals, station board, abfahrt, ankunft, afgange, ankomster,
  train from X to Y, how do I get from X to Y by train, next train from,
  Berlin, Vienna, Wien, Copenhagen, København, Zurich, Zürich, Paris, Amsterdam,
  Brussels, Prague, Budapest, Warsaw, Hamburg, Munich, München, Frankfurt, Salzburg,
  Innsbruck, Graz, Linz, Basel, Geneva, Genève, Milan, Milano, Rome, Roma,
  ÖBB, oebb, österreichische bundesbahnen, DSB, SBB, DB, NS, SNCB, PKP, MÁV.
context: fork
allowed-tools: Bash(bun run skills/oebb/cli/src/cli.ts *)
---

# European Rail Skill (via ÖBB HAFAS)

Plan journeys, check departures/arrivals, and search for stations across Europe via the [ÖBB HAFAS API](https://fahrplan.oebb.at). Covers the full European rail network — Germany, Austria, Switzerland, Denmark, Netherlands, Belgium, Italy, France, and more. No API key required.

## When to use this skill

Invoke this skill when the user wants to:

- Plan a train journey between any two European cities (e.g., "How do I get from Copenhagen to Berlin by train?")
- Check upcoming departures or arrivals at any European station
- Search for stations by name anywhere in Europe
- Find Nightjet, EuroNight, or other sleeper/night train routes
- Look up real-time delay and platform information
- Browse train schedules for any European operator (ÖBB, DB, SBB, DSB, SNCB, NS, etc.)

## Using station names

All commands accept **station names directly** — you do not need to look up IDs first.

```bash
# Use names directly — the CLI resolves them automatically
bun run skills/oebb/cli/src/cli.ts journeys --from "Copenhagen" --to "Berlin Hbf"
bun run skills/oebb/cli/src/cli.ts departures --station "Odense St"
bun run skills/oebb/cli/src/cli.ts arrivals --station "Hamburg Hbf"
```

If a name matches exactly one station, it is used immediately. If the name is ambiguous, the CLI returns a list of matching stations with their names — pick the closest match and retry. Use the `stations` command to browse what's available when you're unsure of the exact name.

### When the name is ambiguous

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

In this case, retry using the name from the options list that best matches the user's intent (e.g. `--station "Wien"` or `--station "Wien Hbf (U)"`), or use the numeric ID from the `id` field.

## Commands

### Search for stations

```bash
bun run skills/oebb/cli/src/cli.ts stations --query <name> [flags]
```

Key flags:
- `--query <name>` — Station name to search (required)
- `--results <n>` — Max results (default: 10)
- `--format json|table|plain`

### Plan a journey

```bash
bun run skills/oebb/cli/src/cli.ts journeys --from <name> --to <name> [flags]
```

Key flags:
- `--from <name>` — Departure station name or ID (required)
- `--to <name>` — Arrival station name or ID (required)
- `--date <YYYY-MM-DD>` — Travel date (default: today)
- `--time <HH:MM>` — Departure time (default: now)
- `--results <n>` — Number of journeys (default: 5)
- `--transfers <n>` — Max transfers, -1 = unlimited (default: -1)
- `--products <list>` — Comma-separated product types: `nationalExpress,national,interregional,regional,suburban,bus,ferry,subway,tram,onCall`
- `--night` — Include only night/sleeper trains (Nightjet, EuroNight, etc.)
- `--stopovers` — Include intermediate stops for each leg
- `--format json|table|plain`

### Check departures from a station

```bash
bun run skills/oebb/cli/src/cli.ts departures --station <name> [flags]
```

Key flags:
- `--station <name>` — Station name or ID (required)
- `--when <YYYY-MM-DDTHH:MM>` — Date and time (default: now)
- `--duration <minutes>` — Time window in minutes (default: 60)
- `--results <n>` — Max results (default: 20)
- `--products <list>` — Comma-separated product types (same as journeys)
- `--format json|table|plain`

### Check arrivals at a station

```bash
bun run skills/oebb/cli/src/cli.ts arrivals --station <name> [flags]
```

Same flags as `departures`.

---

## Natural workflow

Try station names directly — only fall back to the `stations` command when a name is unclear.

```bash
# Plan a journey using names directly
bun run skills/oebb/cli/src/cli.ts journeys --from "Copenhagen" --to "Berlin Hbf" --date 2025-06-01 --time 08:00

# Check departures using a name
bun run skills/oebb/cli/src/cli.ts departures --station "Hamburg Hbf" --format table

# If a name is ambiguous, the CLI returns options — retry with the closest match
bun run skills/oebb/cli/src/cli.ts journeys --from "Wien" --to "Salzburg" --night

# Browse stations when you're unsure of the exact name
bun run skills/oebb/cli/src/cli.ts stations --query "Copenhagen" --format table
```

---

## Usage examples

### Plan a journey between European cities

```bash
bun run skills/oebb/cli/src/cli.ts journeys --from "Copenhagen" --to "Hamburg Hbf" --date 2025-06-01 --time 09:00
```

### Find night trains (Nightjet / EuroNight)

```bash
bun run skills/oebb/cli/src/cli.ts journeys --from "Wien" --to "Zürich" --night
```

### Departures board at a station

```bash
bun run skills/oebb/cli/src/cli.ts departures --station "Odense St" --duration 30 --format table
```

### Arrivals filtered to long-distance trains only

```bash
bun run skills/oebb/cli/src/cli.ts arrivals --station "Salzburg" --products nationalExpress,national --format table
```

### Journey with intermediate stops

```bash
bun run skills/oebb/cli/src/cli.ts journeys --from "Wien" --to "Salzburg" --stopovers
```

### Browse stations in a city

```bash
bun run skills/oebb/cli/src/cli.ts stations --query "Zürich" --format table
```

---

## JSON output shapes

### stations output

```json
{
  "type": "oebb_stations",
  "query": "Copenhagen",
  "stations": [
    {
      "id": "8600626",
      "name": "Koebenhavn H",
      "longitude": 12.565567,
      "latitude": 55.672845
    }
  ],
  "count": 1
}
```

### journeys output

```json
{
  "type": "oebb_journeys",
  "from": "8600626",
  "to": "8000261",
  "date": "2025-05-26",
  "time": "12:00",
  "journeys": [
    {
      "legs": [
        {
          "type": "journey",
          "line": "IC 39",
          "category": "IC",
          "direction": "Hamburg Hbf",
          "origin": "Koebenhavn H",
          "originId": "8600626",
          "departure": "2025-05-26T12:00:00+02:00",
          "plannedDeparture": "2025-05-26T12:00:00+02:00",
          "departurePlatform": "3",
          "plannedDeparturePlatform": "3",
          "destination": "Hamburg Hbf",
          "destinationId": "8000261",
          "arrival": "2025-05-26T15:30:00+02:00",
          "plannedArrival": "2025-05-26T15:30:00+02:00",
          "arrivalPlatform": "12",
          "plannedArrivalPlatform": "12",
          "cancelled": false,
          "stopovers": []
        }
      ],
      "departure": "2025-05-26T12:00:00+02:00",
      "arrival": "2025-05-26T15:30:00+02:00",
      "duration": "3h 30m",
      "transfers": 0,
      "isNightTrain": false
    }
  ],
  "count": 5
}
```

### departures output

```json
{
  "type": "oebb_departures",
  "station": "8600626",
  "when": "2025-05-26T12:00:00+02:00",
  "departures": [
    {
      "line": "IC 39",
      "category": "IC",
      "direction": "Hamburg Hbf",
      "when": "2025-05-26T12:00:00+02:00",
      "plannedWhen": "2025-05-26T12:00:00+02:00",
      "delay": 0,
      "platform": "3",
      "plannedPlatform": "3",
      "cancelled": false,
      "tripId": "1|12345|0|86|26052025"
    }
  ],
  "count": 20
}
```

### arrivals output

```json
{
  "type": "oebb_arrivals",
  "station": "8600626",
  "when": "2025-05-26T11:50:00+02:00",
  "arrivals": [
    {
      "line": "IC 38",
      "category": "IC",
      "origin": "Hamburg Hbf",
      "when": "2025-05-26T11:50:00+02:00",
      "plannedWhen": "2025-05-26T11:50:00+02:00",
      "delay": 0,
      "platform": "5",
      "plannedPlatform": "5",
      "cancelled": false,
      "tripId": "1|12344|0|86|26052025"
    }
  ],
  "count": 20
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

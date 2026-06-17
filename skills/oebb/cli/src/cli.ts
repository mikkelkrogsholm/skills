import { createCLI } from "@bunli/core"
import { stations } from "./commands/stations.js"
import { journeys } from "./commands/journeys.js"
import { departures } from "./commands/departures.js"
import { arrivals } from "./commands/arrivals.js"

const cli = await createCLI({
  name: "oebb",
  version: "1.0.0",
  description: "European public transport journey planning via the HAFAS API (powered by ÖBB)",
})

cli.command(stations)
cli.command(journeys)
cli.command(departures)
cli.command(arrivals)

await cli.run()

import { createCLI } from "@bunli/core"
import { search } from "./commands/search.js"
import { near } from "./commands/near.js"

const cli = await createCLI({
  name: "osm-accommodation",
  version: "1.0.0",
  description: "Find accommodation worldwide using OpenStreetMap data — no API key required",
})

cli.command(search)
cli.command(near)

await cli.run()

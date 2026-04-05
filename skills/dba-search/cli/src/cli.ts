import { createCLI } from "@bunli/core"
import { categories } from "./commands/categories.js"
import { locations } from "./commands/locations.js"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"

const cli = await createCLI({
  name: "dba-search",
  version: "1.0.0",
  description: "Search Denmark's largest second-hand marketplace, DBA.dk (Den Blå Avis)",
})

cli.command(categories)
cli.command(locations)
cli.command(search)
cli.command(detail)

await cli.run()

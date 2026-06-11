# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **rejseplanen** — Danish public transport journey planning via the Rejseplanen API (6 commands: location, trip, departures, arrivals, nearby, disruptions)
- **Den Blå Avis** – Denmark's largest second-hand marketplace.

### Fixed

- **jobindex-search** — `search` command broke after Jobindex retired its `/jobsoegning.json` endpoint (now returns `204 No Content`) and moved results client-side. The command now fetches the `/jobsoegning` HTML page and parses the embedded `var Stash = {...}` payload (`searchResponse.results` + `hitcount`). Results gain a `deadline` field.

## [1.0.0] - 2026-03-13

### Added

- **jobindex-search** — Search live job listings from Jobindex.dk
- **jobnet-search** — Search job listings from Jobnet.dk
- **jobdanmark-search** — Search job listings from Jobdanmark.dk
- **jobbank-search** — Search job listings from Akademikernes Jobbank
- **boliga** — Property data from Boliga.dk
- **boligsiden** — Property data from Boligsiden.dk
- **pubmed-database** — Search 35M+ citations from PubMed/MEDLINE
- **medrxiv-search** — Search medical preprints from medRxiv

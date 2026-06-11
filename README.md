# Mikkel's Agent Skills

<p align="center">
  <img src="assets/banner.gif" alt="Agent Skills" width="640">
</p>

Agent skills that help people navigate everyday life in Denmark — finding a home, landing a job, saving on groceries, checking the weather, planning a trip, or looking up health information. Each skill connects your AI agent to real Danish data sources so it can give answers grounded in live data, not guesswork.

Framework agnostic. Contributions welcome.

## Available Skills

### Danish Job Search

**jobindex-search** ![tests](assets/badges/jobindex-search.svg) — Search live job listings from [Jobindex.dk](https://jobindex.dk) — Denmark's largest job portal

```bash
npx skills add https://github.com/mikkelkrogsholm/skills --skill jobindex-search
```

**jobnet-search** ![tests](assets/badges/jobnet-search.svg) — Search job listings from [Jobnet.dk](https://jobnet.dk) — the public employment service

```bash
npx skills add https://github.com/mikkelkrogsholm/skills --skill jobnet-search
```

**jobdanmark-search** ![tests](assets/badges/jobdanmark-search.svg) — Search job listings from [Jobdanmark.dk](https://jobdanmark.dk)

```bash
npx skills add https://github.com/mikkelkrogsholm/skills --skill jobdanmark-search
```

**jobbank-search** ![tests](assets/badges/jobbank-search.svg) — Search job listings from [Akademikernes Jobbank](https://jobbank.dk) — portal for highly educated candidates

```bash
npx skills add https://github.com/mikkelkrogsholm/skills --skill jobbank-search
```

### Danish Property Market

**boliga** ![tests](assets/badges/boliga.svg) — Property data from [Boliga.dk](https://boliga.dk) — sales history, listings, and price statistics

```bash
npx skills add https://github.com/mikkelkrogsholm/skills --skill boliga
```

**boligsiden** ![tests](assets/badges/boligsiden.svg) — Property data from [Boligsiden.dk](https://boligsiden.dk) — listings, sales, and market stats

```bash
npx skills add https://github.com/mikkelkrogsholm/skills --skill boligsiden
```

### Danish Food & Groceries

**salling-food-waste** ![tests](assets/badges/salling-food-waste.svg) — Find discounted food waste items at Netto, føtex, and Bilka via the [Salling Group API](https://developer.sallinggroup.com)

```bash
npx skills add https://github.com/mikkelkrogsholm/skills --skill salling-food-waste
```

### Biomedical Research

**pubmed-database** ![tests](assets/badges/pubmed-database.svg) — Search 35M+ citations from PubMed/MEDLINE via the NCBI E-utilities API

```bash
npx skills add https://github.com/mikkelkrogsholm/skills --skill pubmed-database
```

**medrxiv-search** ![tests](assets/badges/medrxiv-search.svg) — Search medical preprints from medRxiv across 51 subject categories

```bash
npx skills add https://github.com/mikkelkrogsholm/skills --skill medrxiv-search
```

### Other

**DBA – Den blå avis** ![tests](assets/badges/dba-search.svg) —  Denmark's largest second-hand marketplace, [DBA.dk (Den Blå Avis)](https://www.dba.dk). Browse categories and locations, search classified ads, and fetch full ad details

```bash
npx skills add https://github.com/mikkelkrogsholm/skills --skill dba-search
```


## Want a New Skill?

Check the [open issues](https://github.com/mikkelkrogsholm/skills/issues?q=is%3Aissue+label%3A%22new+skill%22) to see what's planned, in progress, or up for grabs. Feel free to open a new issue to suggest a data source!

## Requirements

- [Bun](https://bun.sh) runtime
- An AI agent framework that supports skills

## License

MIT

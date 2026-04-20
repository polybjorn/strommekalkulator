# Strømmekalkulator

Calculator for Norwegian streaming services. Pick services, tiers, and add-ons and see the monthly and yearly total.

**Live:** https://polybjorn.github.io/strommekalkulator/

## Features

- Monthly and yearly total for any combination of services
- Sports filter (football, winter sports, tennis, Formula 1, etc.)
- Current selection is encoded in the URL hash, so the link is shareable
- Vanilla HTML, CSS, and JS. No build step, no dependencies

## Data

Prices live in `data.json`. Each service has a `lastChecked` date. Bump it when you verify prices, and the footer's "Sist oppdatert" label follows the most recent date across all services.

Prices in other currencies are converted to NOK using the rate in `exchange-rate.json`, which a GitHub Action refreshes monthly.

## Local dev

Serve the directory with any static server:

```sh
python3 -m http.server 8765
```

Validate `data.json` before committing:

```sh
node scripts/validate.mjs
```

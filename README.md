# Strømmekalkulator

Interactive calculator for comparing and combining streaming services available in Norway.

**Live:** https://polybjorn.github.io/strommekalkulator/

## Features

- Select services, tiers, and add-ons; see monthly and yearly totals
- Sports filter (football, winter sports, tennis, Formula 1, etc.)
- Shareable URL — current selection is encoded in the hash
- No build step, no dependencies — vanilla HTML/CSS/JS

## Data

Prices live in `data.json`. Each service has a `lastChecked` date; bump it when you verify prices and the footer's "Sist oppdatert" will follow the most recent date across all services.

EUR/NOK rate in `exchange-rate.json` is refreshed monthly by a GitHub Action (only F1 TV bills in EUR).

## Local dev

Serve the directory with any static server:

```sh
python3 -m http.server 8765
```

Validate `data.json` before committing:

```sh
node scripts/validate.mjs
```

## License

MIT

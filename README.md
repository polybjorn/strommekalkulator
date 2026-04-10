# Strømmekalkulator

Interactive calculator for comparing and combining streaming services available in Norway. Select services, tiers, and add-ons to see total monthly and yearly cost.

## Services

Streaming services, bundle packages, and an internet option. Each card supports tier selection, add-ons, yearly billing where applicable, and detailed content info via the info button.

## Sports filter

Filter services by sport (football leagues, winter sports, tennis, etc.) from the bottom-left Sportsfilter button. Matching services show a badge per sport; services that can't provide the selected sports are dimmed.

## State sharing

The current selection is encoded in the URL hash, so you can share a link with a specific configuration.

## Usage

Serve via any web server and open `index.html`. No dependencies or build step.

Prices are stored in `data.json` and loaded at runtime.

## Prices

All prices are sourced from official service pages. Each service in `data.json` has a `lastChecked` date; bump it when you verify a service's prices, and the footer's "Sist oppdatert" label will follow the most recent date across all services.

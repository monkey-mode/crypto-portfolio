# Crypto Portfolio Tracker

A lightweight, static crypto portfolio tracker. Add your coin holdings and see
live prices, 24h change, total portfolio value, and allocation — all in the
browser, no backend required.

## Features

- Live prices from the [CoinGecko API](https://www.coingecko.com/en/api) (no API key needed)
- Track holdings by coin + amount, with autocomplete over the top 250 coins by market cap
- Total portfolio value, 24h change, and per-coin allocation
- Switch between USD, EUR, GBP, THB
- Holdings persist in `localStorage` — nothing is sent to a server

## Running locally

This is a static site with no build step. Serve the folder with any static
file server, e.g.:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploying to GitHub Pages

A GitHub Actions workflow (`.github/workflows/deploy.yml`) deploys the site
automatically on every push to `main`.

To enable it on a new repo:

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab).

The site will be published at `https://<owner>.github.io/<repo>/`.

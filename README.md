# Liquidity Scanner

A simple React + Vite website for a liquidity scanner dashboard. The site builds
to static assets and includes a GitHub Actions workflow for GitHub Pages.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## SEC ticker data

The app downloads US ticker metadata on page load, parses it with
`SecCompanyTickerCatalog`, and caches the raw ticker payload in browser storage
for 24 hours. A bundled snapshot is included as a fallback for static hosting.

```bash
npm run update:sec-tickers
```

The update command fetches:

```txt
https://www.sec.gov/files/company_tickers.json
```

For automated refreshes, set `SEC_USER_AGENT` to a descriptive value with contact
info so the request follows SEC fair access guidance.

## Yahoo Finance

This repo includes `yahoo-finance2` for server-side or local scripts. The browser
dashboard also loads Yahoo calendar events for IPOs, SEC reports, earnings, and
macro releases from the plain Yahoo calendar endpoint, then caches the response
in browser storage for 5 minutes. In local development, Vite proxies the calendar
request through
`/api/yahoo/calendar-events` to avoid browser CORS blocking; static deployments
may need their own proxy if Yahoo blocks direct browser requests.

```bash
npm run yahoo:quote -- AAPL MSFT
npm run yahoo:top-traded -- 20
```

## GitHub Pages

This repo includes `.github/workflows/deploy.yml`. After pushing to `main`, enable
GitHub Pages in the repository settings and choose **GitHub Actions** as the
source. The Vite base path is configured for:

```txt
/liquidity_scanner/
```

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

## GitHub Pages

This repo includes `.github/workflows/deploy.yml`. After pushing to `main`, enable
GitHub Pages in the repository settings and choose **GitHub Actions** as the
source. The Vite base path is configured for:

```txt
/liquidity_scanner/
```

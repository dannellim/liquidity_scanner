import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadSecCompanyTickerCatalog,
  SEC_COMPANY_TICKERS_URL,
} from '../src/data/secTickerSource.js';

const defaultUserAgent =
  'liquidity_scanner/0.1.0 (set SEC_USER_AGENT with contact info)';
const userAgent = process.env.SEC_USER_AGENT ?? defaultUserAgent;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(
  repoRoot,
  'public',
  'data',
  'sec-company-tickers.json',
);

const catalog = await loadSecCompanyTickerCatalog({
  sourceUrl: SEC_COMPANY_TICKERS_URL,
  headers: {
    'User-Agent': userAgent,
  },
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(catalog.toSecJson())}\n`);

console.log(
  `Wrote ${catalog.count.toLocaleString()} SEC company tickers to ${path.relative(
    repoRoot,
    outputPath,
  )}`,
);

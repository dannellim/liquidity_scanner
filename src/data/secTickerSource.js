import { SecCompanyTickerCatalog } from '../models/secCompanyTicker.js';

export const SEC_COMPANY_TICKERS_URL =
  'https://www.sec.gov/files/company_tickers.json';

export const SEC_TICKERS_SNAPSHOT_PATH = 'data/sec-company-tickers.json';
export const SEC_TICKERS_CACHE_KEY = 'liquidity-scanner:sec-company-tickers:v1';
export const SEC_TICKERS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let cachedCatalogPromise;

export function getSecTickerSnapshotUrl() {
  const baseUrl = import.meta.env?.BASE_URL ?? '/';
  return `${baseUrl}${SEC_TICKERS_SNAPSHOT_PATH}`;
}

export async function loadSecCompanyTickerCatalog({
  sourceUrl = SEC_COMPANY_TICKERS_URL,
  fallbackSourceUrl = getSecTickerSnapshotUrl(),
  fetcher = fetch,
  headers = {},
  storage = getBrowserStorage(),
  cacheKey = SEC_TICKERS_CACHE_KEY,
  cacheTtlMs = SEC_TICKERS_CACHE_TTL_MS,
  now = Date.now,
} = {}) {
  const cachedPayload = readCachedTickerPayload({
    storage,
    cacheKey,
    cacheTtlMs,
    now,
  });

  if (cachedPayload) {
    return SecCompanyTickerCatalog.fromSecJson(cachedPayload);
  }

  const payload = await downloadSecCompanyTickerPayload({
    sourceUrl,
    fallbackSourceUrl,
    fetcher,
    headers,
  });

  writeCachedTickerPayload({
    storage,
    cacheKey,
    payload,
    now,
  });

  return SecCompanyTickerCatalog.fromSecJson(payload);
}

export async function downloadSecCompanyTickerPayload({
  sourceUrl = SEC_COMPANY_TICKERS_URL,
  fallbackSourceUrl = getSecTickerSnapshotUrl(),
  fetcher = fetch,
  headers = {},
} = {}) {
  try {
    return await fetchSecTickerPayload({ sourceUrl, fetcher, headers });
  } catch (error) {
    if (!fallbackSourceUrl || fallbackSourceUrl === sourceUrl) {
      throw error;
    }

    return fetchSecTickerPayload({
      sourceUrl: fallbackSourceUrl,
      fetcher,
      headers,
    });
  }
}

async function fetchSecTickerPayload({ sourceUrl, fetcher, headers }) {
  const response = await fetcher(sourceUrl, {
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Could not load SEC company tickers from ${sourceUrl}: ${response.status}`,
    );
  }

  return response.json();
}

export function getCachedSecCompanyTickerCatalog(options) {
  cachedCatalogPromise ??= loadSecCompanyTickerCatalog(options);
  return cachedCatalogPromise;
}

export function clearSecCompanyTickerCache() {
  cachedCatalogPromise = undefined;
}

function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readCachedTickerPayload({ storage, cacheKey, cacheTtlMs, now }) {
  if (!storage) {
    return null;
  }

  try {
    const cacheRecord = JSON.parse(storage.getItem(cacheKey));
    const ageMs = now() - cacheRecord?.savedAt;

    if (!cacheRecord?.payload || ageMs < 0 || ageMs > cacheTtlMs) {
      return null;
    }

    return cacheRecord.payload;
  } catch {
    return null;
  }
}

function writeCachedTickerPayload({ storage, cacheKey, payload, now }) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      cacheKey,
      JSON.stringify({
        savedAt: now(),
        payload,
      }),
    );
  } catch {
    // Private browsing or storage quotas can block caching; the catalog still loads.
  }
}

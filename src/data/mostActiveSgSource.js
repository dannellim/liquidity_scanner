export const MOST_ACTIVE_SG_LAMBDA_URL =
  'https://rwnlyyhxp5jn6bu57e5yrpa7dm0kqdyf.lambda-url.ap-southeast-1.on.aws/';
export const MOST_ACTIVE_SG_YAHOO_URL =
  'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=MOST_ACTIVES_SG';
export const MOST_ACTIVE_SG_CACHE_KEY = 'liquidity-scanner:most-active-sg:v1';
export const MOST_ACTIVE_SG_CACHE_TTL_MS = 60 * 1000;

let cached;
let inFlight;

export async function loadMostActiveSg({
  lambdaUrl = MOST_ACTIVE_SG_LAMBDA_URL,
  yahooUrl = MOST_ACTIVE_SG_YAHOO_URL,
  fetcher = fetch,
  storage = getBrowserStorage(),
  cacheKey = MOST_ACTIVE_SG_CACHE_KEY,
  cacheTtlMs = MOST_ACTIVE_SG_CACHE_TTL_MS,
  now = Date.now,
} = {}) {
  if (cached && now() - cached.savedAt < cacheTtlMs) {
    return cached.result;
  }

  const stored = readStoredPayload({ storage, cacheKey, cacheTtlMs, now });
  if (stored) {
    cached = stored;
    return stored.result;
  }

  if (!inFlight) {
    inFlight = (async () => {
      try {
        const result = await fetchFromLambda({ lambdaUrl, yahooUrl, fetcher });
        const record = { result, savedAt: now() };
        cached = record;
        writeStoredPayload({ storage, cacheKey, record });
        return result;
      } finally {
        inFlight = undefined;
      }
    })();
  }

  return inFlight;
}

export function clearMostActiveSgCache() {
  cached = undefined;
  inFlight = undefined;
}

async function fetchFromLambda({ lambdaUrl, yahooUrl, fetcher }) {
  const response = await fetcher(lambdaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: yahooUrl }),
  });

  if (!response.ok) {
    throw new Error(`Most-active SG proxy returned ${response.status}`);
  }

  return normalizePayload(await response.json());
}

export function normalizePayload(payload) {
  const result = payload?.finance?.result?.[0] ?? {};
  const quotes = Array.isArray(result.quotes) ? result.quotes : [];
  return {
    title: typeof result.title === 'string' ? result.title : 'Most Actives',
    description: typeof result.description === 'string' ? result.description : '',
    fetchedAt: Date.now(),
    quotes: quotes.map(normalizeQuote).filter((q) => q.symbol),
  };
}

function normalizeQuote(quote) {
  if (!quote || typeof quote !== 'object') {
    return { symbol: '' };
  }

  return {
    symbol: toCleanString(quote.symbol),
    shortName: toCleanString(quote.shortName) || toCleanString(quote.longName),
    longName: toCleanString(quote.longName) || toCleanString(quote.shortName),
    exchange:
      toCleanString(quote.fullExchangeName) || toCleanString(quote.exchange),
    currency: toCleanString(quote.currency),
    marketState: toCleanString(quote.marketState),
    price: toNumber(quote.regularMarketPrice),
    change: toNumber(quote.regularMarketChange),
    changePercent: toNumber(quote.regularMarketChangePercent),
    dayLow: toNumber(quote.regularMarketDayLow),
    dayHigh: toNumber(quote.regularMarketDayHigh),
    fiftyTwoWeekLow: toNumber(quote.fiftyTwoWeekLow),
    fiftyTwoWeekHigh: toNumber(quote.fiftyTwoWeekHigh),
    fiftyTwoWeekChangePercent: toNumber(quote.fiftyTwoWeekChangePercent),
    volume: toNumber(quote.regularMarketVolume),
    avgVolume: toNumber(quote.averageDailyVolume3Month),
    marketCap: toNumber(quote.marketCap),
    trailingPE: toNumber(quote.trailingPE),
    quoteUrl: quote.symbol
      ? `https://finance.yahoo.com/quote/${encodeURIComponent(quote.symbol)}`
      : '',
  };
}

function toCleanString(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredPayload({ storage, cacheKey, cacheTtlMs, now }) {
  if (!storage) return null;
  try {
    const record = JSON.parse(storage.getItem(cacheKey));
    if (!record?.result || !Number.isFinite(record.savedAt)) return null;
    if (now() - record.savedAt > cacheTtlMs) return null;
    return record;
  } catch {
    return null;
  }
}

function writeStoredPayload({ storage, cacheKey, record }) {
  if (!storage) return;
  try {
    storage.setItem(cacheKey, JSON.stringify(record));
  } catch {
    // storage quota / private mode — non-fatal
  }
}

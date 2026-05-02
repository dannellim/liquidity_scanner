import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SEC_TICKERS_CACHE_TTL_MS,
  loadSecCompanyTickerCatalog,
} from './secTickerSource.js';

const sampleSecPayload = {
  0: { cik_str: 1045810, ticker: 'NVDA', title: 'NVIDIA CORP' },
  1: { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
};

class MemoryStorage {
  records = new Map();

  getItem(key) {
    return this.records.get(key) ?? null;
  }

  setItem(key, value) {
    this.records.set(key, value);
  }
}

function createJsonResponse(payload, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  };
}

test('downloads SEC ticker payload and caches it for later page loads', async () => {
  const storage = new MemoryStorage();
  let fetchCount = 0;

  const firstCatalog = await loadSecCompanyTickerCatalog({
    sourceUrl: 'https://example.test/company_tickers.json',
    fetcher: async () => {
      fetchCount += 1;
      return createJsonResponse(sampleSecPayload);
    },
    storage,
    now: () => 1000,
  });

  const secondCatalog = await loadSecCompanyTickerCatalog({
    sourceUrl: 'https://example.test/company_tickers.json',
    fetcher: async () => {
      throw new Error('Network should not be needed for a fresh cache');
    },
    storage,
    now: () => 1000 + SEC_TICKERS_CACHE_TTL_MS - 1,
  });

  assert.equal(fetchCount, 1);
  assert.equal(firstCatalog.getByTicker('NVDA').paddedCik, '0001045810');
  assert.equal(secondCatalog.getByTicker('AAPL').title, 'Apple Inc.');
});

test('refreshes the ticker payload after the one-day cache expires', async () => {
  const storage = new MemoryStorage();
  let fetchCount = 0;

  await loadSecCompanyTickerCatalog({
    sourceUrl: 'https://example.test/company_tickers.json',
    fetcher: async () => {
      fetchCount += 1;
      return createJsonResponse(sampleSecPayload);
    },
    storage,
    now: () => 1000,
  });

  const refreshedCatalog = await loadSecCompanyTickerCatalog({
    sourceUrl: 'https://example.test/company_tickers.json',
    fetcher: async () => {
      fetchCount += 1;
      return createJsonResponse({
        0: { cik_str: 789019, ticker: 'MSFT', title: 'MICROSOFT CORP' },
      });
    },
    storage,
    now: () => 1000 + SEC_TICKERS_CACHE_TTL_MS + 1,
  });

  assert.equal(fetchCount, 2);
  assert.equal(refreshedCatalog.getByTicker('MSFT').paddedCik, '0000789019');
});

test('falls back to the static snapshot if the direct download fails', async () => {
  const requestedUrls = [];

  const catalog = await loadSecCompanyTickerCatalog({
    sourceUrl: 'https://example.test/direct.json',
    fallbackSourceUrl: '/data/sec-company-tickers.json',
    fetcher: async (url) => {
      requestedUrls.push(url);

      if (url === 'https://example.test/direct.json') {
        throw new Error('direct download unavailable');
      }

      return createJsonResponse(sampleSecPayload);
    },
    storage: null,
  });

  assert.deepEqual(requestedUrls, [
    'https://example.test/direct.json',
    '/data/sec-company-tickers.json',
  ]);
  assert.equal(catalog.count, 2);
});

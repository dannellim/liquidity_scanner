import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CALENDAR_EVENTS_CACHE_TTL_MS,
  YAHOO_CALENDAR_EVENTS_URL,
  clearCalendarEventsCache,
  getCachedCalendarEvents,
  loadCalendarEvents,
  normalizeCalendarEventsPayload,
} from './calendarEventsSource.js';

const sampleCalendarEventsPayload = {
  finance: {
    result: {
      ipoEvents: [
        {
          timestamp: 1777348800000,
          timestampString: '2026-04-28',
          records: [
            {
              ticker: 'CRY',
              companyShortName: 'GraniteShares YieldBOOST CRCL ETF',
              exchangeShortName: 'Nasdaq',
              startDateTime: 1777348800000,
              currencyName: 'USD',
              dealType: 'Expected',
              dealId: '38747T666',
            },
          ],
        },
      ],
      secReports: [
        {
          timestamp: 1777248000000,
          timestampString: '2026-04-27',
          records: [
            {
              id: '0001045810-26-000026_1045810',
              type: '8-K',
              description: 'Current report filing',
              filingDate: 1777248000000,
              ticker: 'NVDA',
              companyName: 'NVIDIA Corporation',
              category: 'Corporate Changes & Voting Matters',
              exhibits: [
                {
                  url: 'https://cdn.yahoofinance.com/nvda-20260424.htm',
                  type: '8-K',
                },
              ],
            },
          ],
        },
      ],
      earnings: [
        {
          timestamp: 1777248000000,
          timestampString: '2026-04-27',
          records: [
            {
              ticker: 'NE',
              companyShortName: 'Noble Corporation plc',
              dateIsEstimate: false,
              startDateTime: 1777235700000,
              fiscalYear: '2026',
              quarter: 'Q1',
              epsActual: 0.26,
              epsEstimate: 0.21,
              surprisePercent: 26.2,
            },
          ],
        },
      ],
      economicEvents: [
        {
          timestamp: 1777435200000,
          timestampString: '2026-04-29',
          records: [
            {
              event: 'Fed Funds Tgt Rate',
              countryCode: 'US',
              eventTime: 1777485600000,
              actual: '3.75',
              prior: '3.62',
              description: 'Federal funds target rate decision.',
            },
          ],
        },
      ],
    },
    error: null,
  },
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

test('uses the bare Yahoo calendar events endpoint without query parameters', () => {
  const url = new URL(YAHOO_CALENDAR_EVENTS_URL);

  assert.equal(
    url.href,
    'https://query1.finance.yahoo.com/ws/screeners/v1/finance/calendar-events',
  );
  assert.equal(url.search, '');
});

test('normalizes Yahoo calendar response modules into groups and counts', () => {
  const normalized = normalizeCalendarEventsPayload(sampleCalendarEventsPayload);

  assert.deepEqual(normalized.counts, {
    total: 4,
    ipoEvents: 1,
    secReports: 1,
    earnings: 1,
    economicEvents: 1,
  });
  assert.deepEqual(Object.keys(normalized.groups), [
    'ipoEvents',
    'secReports',
    'earnings',
    'economicEvents',
  ]);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(normalized.groups).map(([key, events]) => [
        key,
        events.length,
      ]),
    ),
    {
      ipoEvents: 1,
      secReports: 1,
      earnings: 1,
      economicEvents: 1,
    },
  );
});

test('uses a five-minute browser cache for Yahoo calendar events', () => {
  assert.equal(CALENDAR_EVENTS_CACHE_TTL_MS, 5 * 60 * 1000);
});

test('expires the in-memory Yahoo calendar request after five minutes', async () => {
  clearCalendarEventsCache();
  let fetchCount = 0;

  const createOptions = (now) => ({
    sourceUrl: 'https://example.test/calendar-events',
    fetcher: async () => {
      fetchCount += 1;
      return createJsonResponse(sampleCalendarEventsPayload);
    },
    storage: null,
    now: () => now,
  });

  await getCachedCalendarEvents(createOptions(1000));
  await getCachedCalendarEvents(
    createOptions(1000 + CALENDAR_EVENTS_CACHE_TTL_MS - 1),
  );
  await getCachedCalendarEvents(
    createOptions(1000 + CALENDAR_EVENTS_CACHE_TTL_MS + 1),
  );

  assert.equal(fetchCount, 2);
  clearCalendarEventsCache();
});

test('normalizes Yahoo calendar response events into chronological rows', () => {
  const normalized = normalizeCalendarEventsPayload(sampleCalendarEventsPayload);

  assert.deepEqual(normalized.counts, {
    total: 4,
    ipoEvents: 1,
    secReports: 1,
    earnings: 1,
    economicEvents: 1,
  });
  assert.deepEqual(
    normalized.events.map((event) => [
      event.type,
      event.typeLabel,
      event.symbol,
      event.title,
      event.detail,
    ]),
    [
      [
        'earnings',
        'Earnings',
        'NE',
        'Noble Corporation plc',
        'EPS 0.26 | Est 0.21 | Surprise 26.2%',
      ],
      [
        'sec',
        'SEC',
        'NVDA',
        'NVIDIA Corporation',
        'Current report filing',
      ],
      [
        'ipo',
        'IPO',
        'CRY',
        'GraniteShares YieldBOOST CRCL ETF',
        'Expected | USD',
      ],
      [
        'economic',
        'Macro',
        'US',
        'Fed Funds Tgt Rate',
        'Actual 3.75 | Prior 3.62',
      ],
    ],
  );
});

test('loads and caches Yahoo calendar events', async () => {
  const storage = new MemoryStorage();
  const requestedUrls = [];

  const firstResult = await loadCalendarEvents({
    sourceUrl: 'https://example.test/calendar-events',
    fetcher: async (url) => {
      requestedUrls.push(url);
      return createJsonResponse(sampleCalendarEventsPayload);
    },
    storage,
    now: () => 1000,
  });

  const secondResult = await loadCalendarEvents({
    sourceUrl: 'https://example.test/calendar-events',
    fetcher: async () => {
      throw new Error('Network should not be needed for a fresh cache');
    },
    storage,
    now: () => 1000 + CALENDAR_EVENTS_CACHE_TTL_MS - 1,
  });

  await loadCalendarEvents({
    sourceUrl: 'https://example.test/calendar-events',
    fetcher: async (url) => {
      requestedUrls.push(url);
      return createJsonResponse(sampleCalendarEventsPayload);
    },
    storage,
    now: () => 1000 + CALENDAR_EVENTS_CACHE_TTL_MS + 1,
  });

  assert.deepEqual(requestedUrls, [
    'https://example.test/calendar-events',
    'https://example.test/calendar-events',
  ]);
  assert.equal(firstResult.events.length, 4);
  assert.equal(firstResult.counts.earnings, 1);
  assert.equal(firstResult.stale, false);
  assert.equal(secondResult.events[0].title, 'Noble Corporation plc');
});

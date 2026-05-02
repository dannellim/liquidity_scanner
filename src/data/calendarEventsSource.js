export const YAHOO_CALENDAR_EVENTS_URL =
  'https://query1.finance.yahoo.com/ws/screeners/v1/finance/calendar-events';
export const YAHOO_CALENDAR_EVENTS_DEV_PROXY_PATH =
  '/api/yahoo/calendar-events';
export const CALENDAR_EVENTS_CACHE_KEY =
  'liquidity-scanner:calendar-events:v1';
export const CALENDAR_EVENTS_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedCalendarEventsPromise;
let cachedCalendarEventsPromiseExpiresAt = 0;

export function getYahooCalendarEventsSourceUrl() {
  return import.meta.env?.DEV
    ? YAHOO_CALENDAR_EVENTS_DEV_PROXY_PATH
    : YAHOO_CALENDAR_EVENTS_URL;
}

export async function loadCalendarEvents({
  sourceUrl = getYahooCalendarEventsSourceUrl(),
  fetcher = fetch,
  storage = getBrowserStorage(),
  cacheKey = CALENDAR_EVENTS_CACHE_KEY,
  cacheTtlMs = CALENDAR_EVENTS_CACHE_TTL_MS,
  now = Date.now,
} = {}) {
  const cacheRecordKey = `${cacheKey}:${sourceUrl}`;
  const cachedPayload = readCachedCalendarEventsPayload({
    storage,
    cacheKey: cacheRecordKey,
    cacheTtlMs,
    now,
  });

  if (cachedPayload) {
    return createCalendarEventsResult({
      payload: cachedPayload,
      sourceUrl,
      stale: false,
    });
  }

  try {
    const payload = await fetchCalendarEventsPayload({ url: sourceUrl, fetcher });

    writeCachedCalendarEventsPayload({
      storage,
      cacheKey: cacheRecordKey,
      payload,
      now,
    });

    return createCalendarEventsResult({
      payload,
      sourceUrl,
      stale: false,
    });
  } catch (error) {
    const stalePayload = readCachedCalendarEventsPayload({
      storage,
      cacheKey: cacheRecordKey,
      cacheTtlMs: Number.POSITIVE_INFINITY,
      now,
    });

    if (stalePayload) {
      return createCalendarEventsResult({
        payload: stalePayload,
        sourceUrl,
        stale: true,
      });
    }

    throw error;
  }
}

export function getCachedCalendarEvents(options) {
  const now = options?.now ?? Date.now;
  const cacheTtlMs = options?.cacheTtlMs ?? CALENDAR_EVENTS_CACHE_TTL_MS;
  const currentTime = now();

  if (!cachedCalendarEventsPromise || currentTime >= cachedCalendarEventsPromiseExpiresAt) {
    cachedCalendarEventsPromise = loadCalendarEvents(options).catch((error) => {
      cachedCalendarEventsPromise = undefined;
      cachedCalendarEventsPromiseExpiresAt = 0;
      throw error;
    });
    cachedCalendarEventsPromiseExpiresAt = currentTime + cacheTtlMs;
  }

  return cachedCalendarEventsPromise;
}

export function clearCalendarEventsCache() {
  cachedCalendarEventsPromise = undefined;
  cachedCalendarEventsPromiseExpiresAt = 0;
}

export function normalizeCalendarEventsPayload(payload) {
  const result = payload?.finance?.result ?? {};
  const ipoEvents = normalizeDailyEventModule({
    dailyEvents: result.ipoEvents,
    type: 'ipo',
    normalizer: normalizeIpoEvent,
  });
  const secReports = normalizeDailyEventModule({
    dailyEvents: result.secReports,
    type: 'sec',
    normalizer: normalizeSecReportEvent,
  });
  const earnings = normalizeDailyEventModule({
    dailyEvents: result.earnings,
    type: 'earnings',
    normalizer: normalizeEarningsEvent,
  });
  const economicEvents = normalizeDailyEventModule({
    dailyEvents: result.economicEvents,
    type: 'economic',
    normalizer: normalizeEconomicEvent,
  });
  ipoEvents.sort(sortCalendarEvents);
  secReports.sort(sortCalendarEvents);
  earnings.sort(sortCalendarEvents);
  economicEvents.sort(sortCalendarEvents);

  const events = [
    ...ipoEvents,
    ...secReports,
    ...earnings,
    ...economicEvents,
  ].sort(sortCalendarEvents);

  return {
    events,
    groups: {
      ipoEvents,
      secReports,
      earnings,
      economicEvents,
    },
    counts: {
      total: events.length,
      ipoEvents: ipoEvents.length,
      secReports: secReports.length,
      earnings: earnings.length,
      economicEvents: economicEvents.length,
    },
  };
}

async function fetchCalendarEventsPayload({ url, fetcher }) {
  const response = await fetcher(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Could not load Yahoo calendar events: ${response.status}`,
    );
  }

  return response.json();
}

function createCalendarEventsResult({
  payload,
  sourceUrl,
  stale,
}) {
  return {
    ...normalizeCalendarEventsPayload(payload),
    sourceUrl,
    stale,
  };
}

function normalizeDailyEventModule({ dailyEvents, type, normalizer }) {
  if (!Array.isArray(dailyEvents)) {
    return [];
  }

  return dailyEvents.flatMap((day) => {
    const records = Array.isArray(day?.records) ? day.records : [];

    return records
      .map((record, index) => normalizer(record, day, index))
      .filter((event) => event.title)
      .map((event) => ({
        ...event,
        type,
      }));
  });
}

function normalizeIpoEvent(record, day, index) {
  const time = getFiniteNumber(record?.startDateTime ?? day?.timestamp);
  const symbol = toCleanString(record?.ticker).toUpperCase();
  const exchange = toCleanString(record?.exchangeShortName);
  const dealType = toCleanString(record?.dealType);
  const currency = toCleanString(record?.currencyName);

  return {
    id: buildCalendarEventId('ipo', [
      record?.dealId,
      symbol,
      time,
      day?.timestampString,
      index,
    ]),
    typeLabel: 'IPO',
    time,
    date: toCleanString(day?.timestampString),
    symbol,
    title: toCleanString(record?.companyShortName) || symbol,
    subtitle: joinEventParts([symbol, exchange]),
    detail: joinEventParts([dealType, currency]) || 'IPO calendar event',
    href: '',
  };
}

function normalizeSecReportEvent(record, day, index) {
  const time = getFiniteNumber(record?.filingDate ?? day?.timestamp);
  const symbol = toCleanString(record?.ticker).toUpperCase();
  const reportType = toCleanString(record?.type);
  const category = toCleanString(record?.category);
  const exhibitUrl = Array.isArray(record?.exhibits)
    ? toCleanString(record.exhibits[0]?.url)
    : '';

  return {
    id: buildCalendarEventId('sec', [
      record?.id,
      symbol,
      reportType,
      time,
      index,
    ]),
    typeLabel: 'SEC',
    time,
    date: toCleanString(day?.timestampString),
    symbol,
    title: toCleanString(record?.companyName) || symbol,
    subtitle: joinEventParts([symbol, reportType, category]),
    detail: toCleanString(record?.description) || 'SEC filing',
    href: exhibitUrl,
  };
}

function normalizeEarningsEvent(record, day, index) {
  const time = getFiniteNumber(record?.startDateTime ?? day?.timestamp);
  const symbol = toCleanString(record?.ticker).toUpperCase();
  const fiscalPeriod = joinEventParts([
    toCleanString(record?.fiscalYear),
    toCleanString(record?.quarter),
  ]);
  const details = [
    toPrefixedNumber('EPS', record?.epsActual),
    toPrefixedNumber('Est', record?.epsEstimate),
    toPrefixedPercent('Surprise', record?.surprisePercent),
    record?.dateIsEstimate ? 'Estimated date' : '',
  ].filter(Boolean);

  return {
    id: buildCalendarEventId('earnings', [
      symbol,
      fiscalPeriod,
      time,
      index,
    ]),
    typeLabel: 'Earnings',
    time,
    date: toCleanString(day?.timestampString),
    symbol,
    title: toCleanString(record?.companyShortName) || symbol,
    subtitle: joinEventParts([symbol, fiscalPeriod]),
    detail: joinEventParts(details) || 'Earnings event',
    href: '',
  };
}

function normalizeEconomicEvent(record, day, index) {
  const time = getFiniteNumber(record?.eventTime ?? day?.timestamp);
  const countryCode = toCleanString(record?.countryCode).toUpperCase();
  const details = [
    toCleanString(record?.period),
    toPrefixedText('Actual', record?.actual),
    toPrefixedText('Prior', record?.prior),
    toPrefixedText('Revised', record?.revisedFrom),
  ].filter(Boolean);

  return {
    id: buildCalendarEventId('economic', [
      countryCode,
      record?.event,
      time,
      day?.timestampString,
      index,
    ]),
    typeLabel: 'Macro',
    time,
    date: toCleanString(day?.timestampString),
    symbol: countryCode,
    title: toCleanString(record?.event),
    subtitle: joinEventParts([countryCode, toCleanString(record?.period)]),
    detail: joinEventParts(details) || 'Values pending',
    href: '',
  };
}

function sortCalendarEvents(left, right) {
  const leftTime = left.time ?? 0;
  const rightTime = right.time ?? 0;

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left.typeLabel.localeCompare(right.typeLabel);
}

function buildCalendarEventId(type, parts) {
  return [type, ...parts.map(toCleanString).filter(Boolean)].join('-');
}

function joinEventParts(parts) {
  return parts.map(toCleanString).filter(Boolean).join(' | ');
}

function toPrefixedText(prefix, value) {
  const text = toCleanString(value);
  return text ? `${prefix} ${text}` : '';
}

function toPrefixedNumber(prefix, value) {
  const text = formatNumber(value);
  return text ? `${prefix} ${text}` : '';
}

function toPrefixedPercent(prefix, value) {
  const text = formatNumber(value);
  return text ? `${prefix} ${text}%` : '';
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return toCleanString(value);
  }

  return numericValue.toFixed(2).replace(/\.?0+$/, '');
}

function toCleanString(value) {
  return String(value ?? '').trim();
}

function getFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getBrowserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readCachedCalendarEventsPayload({
  storage,
  cacheKey,
  cacheTtlMs,
  now,
}) {
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

function writeCachedCalendarEventsPayload({
  storage,
  cacheKey,
  payload,
  now,
}) {
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
    // Storage limits should not block the dashboard from showing live data.
  }
}

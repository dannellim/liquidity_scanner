import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { getCachedSecCompanyTickerCatalog } from './data/secTickerSource.js';
import {
  loadMostActiveSg,
  MOST_ACTIVE_SG_CACHE_TTL_MS,
} from './data/mostActiveSgSource.js';

function App() {
  const [tickerCatalog, setTickerCatalog] = useState(null);
  const [tickerQuery, setTickerQuery] = useState('');
  const [tickerStatus, setTickerStatus] = useState('loading');
  const [tickerError, setTickerError] = useState('');

  const [moversResult, setMoversResult] = useState(null);
  const [moversStatus, setMoversStatus] = useState('loading');
  const [moversError, setMoversError] = useState('');
  const [moversTick, setMoversTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let isCurrent = true;

    getCachedSecCompanyTickerCatalog()
      .then((catalog) => {
        if (!isCurrent) return;
        setTickerCatalog(catalog);
        setTickerStatus('ready');
      })
      .catch((error) => {
        if (!isCurrent) return;
        setTickerError(error.message);
        setTickerStatus('error');
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    loadMostActiveSg()
      .then((result) => {
        if (!isCurrent) return;
        setMoversResult(result);
        setMoversStatus('ready');
        setMoversError('');
      })
      .catch((error) => {
        if (!isCurrent) return;
        setMoversError(error.message);
        setMoversStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
      });

    return () => {
      isCurrent = false;
    };
  }, [moversTick]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(
      () => setMoversTick((t) => t + 1),
      MOST_ACTIVE_SG_CACHE_TTL_MS,
    );
    return () => clearInterval(interval);
  }, []);

  const tickerMatches = useMemo(() => {
    return tickerCatalog?.search(tickerQuery, { limit: 12 }) ?? [];
  }, [tickerCatalog, tickerQuery]);

  const moversAgeLabel = moversResult
    ? formatRelativeTime(now - moversResult.fetchedAt)
    : '';
  const moversSourceLabel = 'Live · cached 1 min';

  return (
    <main className="shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">SEC EDGAR Search</p>
            <h1>Liquidity Scanner</h1>
          </div>

          <div className="actions">
            <label className="search-field ticker-search-field">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search SEC tickers</span>
              <input
                type="search"
                placeholder="Search ticker, company, or CIK"
                value={tickerQuery}
                onChange={(event) => setTickerQuery(event.target.value)}
                autoFocus
              />
            </label>
          </div>
        </header>

        <section className="panel movers-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{moversSourceLabel}</p>
              <h2>Most Active — Singapore</h2>
            </div>
            <button
              type="button"
              className="refresh-button"
              onClick={() => setMoversTick((t) => t + 1)}
              disabled={moversStatus === 'loading'}
              aria-label="Refresh most-active stocks"
            >
              <RefreshCw size={16} aria-hidden="true" />
              {moversAgeLabel || 'Refresh'}
            </button>
          </div>

          {moversError && moversStatus !== 'ready' ? (
            <p className="load-error">{moversError}</p>
          ) : moversStatus === 'loading' && !moversResult ? (
            <p className="empty-state">Loading Singapore movers…</p>
          ) : !moversResult || moversResult.quotes.length === 0 ? (
            <p className="empty-state">No quotes returned.</p>
          ) : (
            <div className="movers-grid" aria-label="Singapore most-active stocks">
              {moversResult.quotes.map((quote) => (
                <MoverCard quote={quote} key={quote.symbol} />
              ))}
            </div>
          )}
        </section>

        <section className="panel ticker-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Click a card to open EDGAR</p>
              <h2>Companies</h2>
            </div>
          </div>

          {tickerStatus === 'error' ? (
            <p className="load-error">{tickerError}</p>
          ) : tickerStatus === 'loading' ? (
            <p className="empty-state">Loading SEC company catalog…</p>
          ) : tickerMatches.length === 0 ? (
            <p className="empty-state">
              {tickerQuery
                ? 'No companies matched your search.'
                : 'Type a symbol, company name, or CIK to search.'}
            </p>
          ) : (
            <div
              className="ticker-results"
              aria-label="SEC ticker search results"
            >
              {tickerMatches.map((company) => (
                <a
                  className="ticker-result"
                  href={company.secCompanyUrl}
                  target="_blank"
                  rel="noreferrer"
                  key={`${company.ticker}-${company.cik}`}
                >
                  <strong>{company.ticker}</strong>
                  <span>{company.title}</span>
                  <code>CIK {company.paddedCik}</code>
                </a>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function MoverCard({ quote }) {
  const direction = directionOf(quote.changePercent);
  const ChangeIcon =
    direction === 'down'
      ? ArrowDownRight
      : direction === 'up'
        ? ArrowUpRight
        : Minus;
  const dayPosition = positionInRange(
    quote.price,
    quote.dayLow,
    quote.dayHigh,
  );

  return (
    <a
      className={`mover-card mover-${direction}`}
      href={quote.quoteUrl}
      target="_blank"
      rel="noreferrer"
    >
      <div className="mover-head">
        <div className="mover-symbol">
          <strong>{stripExchangeSuffix(quote.symbol)}</strong>
          <span>{quote.shortName}</span>
        </div>
        <span className={`mover-change mover-change-${direction}`}>
          <ChangeIcon size={14} aria-hidden="true" />
          {formatPercent(quote.changePercent)}
        </span>
      </div>

      <div className="mover-price">
        <strong>{formatPrice(quote.price)}</strong>
        <span>{quote.currency || ''}</span>
      </div>

      <div className="mover-range" aria-hidden="true">
        <div className="mover-range-track">
          {dayPosition !== null ? (
            <span
              className="mover-range-thumb"
              style={{ left: `${dayPosition}%` }}
            />
          ) : null}
        </div>
        <div className="mover-range-labels">
          <span>{formatPrice(quote.dayLow)}</span>
          <span className="mover-range-label-mid">Day range</span>
          <span>{formatPrice(quote.dayHigh)}</span>
        </div>
      </div>

      <div className="mover-meta">
        <span title="Regular market volume">
          Vol {formatCompactNumber(quote.volume)}
        </span>
        <span title="Average daily volume (3 mo)">
          Avg {formatCompactNumber(quote.avgVolume)}
        </span>
      </div>
    </a>
  );
}

function directionOf(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'flat';
  if (Math.abs(value) < 0.005) return 'flat';
  return value > 0 ? 'up' : 'down';
}

function stripExchangeSuffix(symbol) {
  if (!symbol) return '';
  const dot = symbol.lastIndexOf('.');
  return dot > 0 ? symbol.slice(0, dot) : symbol;
}

function positionInRange(value, low, high) {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(low) ||
    !Number.isFinite(high) ||
    high <= low
  ) {
    return null;
  }
  const ratio = (value - low) / (high - low);
  return Math.max(0, Math.min(100, ratio * 100));
}

function formatPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.005) return '0.00%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatPrice(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 100) return value.toFixed(2);
  if (Math.abs(value) >= 1) return value.toFixed(3);
  return value.toFixed(4);
}

const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatCompactNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return compactFormatter.format(value);
}

function formatRelativeTime(deltaMs) {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return 'just now';
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default App;

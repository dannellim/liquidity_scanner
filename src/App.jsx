import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  Building2,
  CalendarClock,
  FileText,
  Landmark,
  Search,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { getCachedCalendarEvents } from './data/calendarEventsSource.js';
import { getCachedSecCompanyTickerCatalog } from './data/secTickerSource.js';

const markets = [
  { name: 'US Equities', score: 84, change: '+6.8%', depth: '$41.2B', tone: 'green' },
  { name: 'Treasury Futures', score: 71, change: '+2.1%', depth: '$18.7B', tone: 'blue' },
  { name: 'Crypto Majors', score: 63, change: '-1.4%', depth: '$6.4B', tone: 'amber' },
  { name: 'Asia FX', score: 78, change: '+4.2%', depth: '$12.9B', tone: 'violet' },
];

const orderBooks = [
  { venue: 'CME', symbol: 'ESM6', spread: '0.25', imbalance: '62%', depth: '$7.8B', state: 'Healthy' },
  { venue: 'NASDAQ', symbol: 'NVDA', spread: '0.03', imbalance: '55%', depth: '$3.2B', state: 'Watch' },
  { venue: 'Binance', symbol: 'BTCUSDT', spread: '0.01%', imbalance: '49%', depth: '$862M', state: 'Stable' },
  { venue: 'EBS', symbol: 'USDJPY', spread: '0.2', imbalance: '69%', depth: '$1.6B', state: 'Thin' },
  { venue: 'ICE', symbol: 'DXM6', spread: '0.01', imbalance: '58%', depth: '$912M', state: 'Healthy' },
];

const flowBars = [52, 74, 46, 88, 67, 91, 72, 56, 83, 61, 79, 95];

const calendarEventIcons = {
  earnings: TrendingUp,
  economic: Landmark,
  ipo: Building2,
  sec: FileText,
};

const defaultCalendarCounts = {
  total: 0,
  ipoEvents: 0,
  secReports: 0,
  earnings: 0,
  economicEvents: 0,
};

const defaultCalendarGroups = {
  ipoEvents: [],
  secReports: [],
  earnings: [],
  economicEvents: [],
};

const calendarSectionDefinitions = [
  {
    key: 'ipoEvents',
    title: 'IPO Events',
    type: 'ipo',
    Icon: Building2,
  },
  {
    key: 'secReports',
    title: 'SEC Reports',
    type: 'sec',
    Icon: FileText,
  },
  {
    key: 'earnings',
    title: 'Earnings',
    type: 'earnings',
    Icon: TrendingUp,
  },
  {
    key: 'economicEvents',
    title: 'Economic Events',
    type: 'economic',
    Icon: Landmark,
  },
];

function formatCalendarEventTime(timestamp, locale) {
  if (!timestamp) {
    return 'Time TBA';
  }

  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

function getDateTimeAttribute(timestamp) {
  return timestamp ? new Date(timestamp).toISOString() : undefined;
}

function CalendarEventItem({ event, locale, showType = true }) {
  const TypeIcon = calendarEventIcons[event.type] ?? CalendarClock;
  const content = (
    <>
      <div className="calendar-event-time">
        <CalendarClock size={17} aria-hidden="true" />
        <time dateTime={getDateTimeAttribute(event.time)}>
          {formatCalendarEventTime(event.time, locale)}
        </time>
      </div>
      <div className="calendar-event-body">
        <div className="calendar-event-titleline">
          <strong>{event.title}</strong>
          {showType ? (
            <span className={`calendar-event-type type-${event.type}`}>
              <TypeIcon size={14} aria-hidden="true" />
              {event.typeLabel}
            </span>
          ) : null}
        </div>
        {event.subtitle ? <span>{event.subtitle}</span> : null}
        <p>{event.detail}</p>
      </div>
    </>
  );

  if (event.href) {
    return (
      <a
        className="calendar-event"
        href={event.href}
        target="_blank"
        rel="noreferrer"
      >
        {content}
      </a>
    );
  }

  return <article className="calendar-event">{content}</article>;
}

function App() {
  const [tickerCatalog, setTickerCatalog] = useState(null);
  const [tickerQuery, setTickerQuery] = useState('');
  const [tickerStatus, setTickerStatus] = useState('loading');
  const [tickerError, setTickerError] = useState('');
  const [calendarEventsResult, setCalendarEventsResult] = useState({
    events: [],
    groups: defaultCalendarGroups,
    counts: defaultCalendarCounts,
    sourceUrl: '',
    stale: false,
  });
  const [calendarEventsStatus, setCalendarEventsStatus] = useState('loading');
  const [calendarEventsError, setCalendarEventsError] = useState('');

  useEffect(() => {
    let isCurrent = true;

    getCachedSecCompanyTickerCatalog()
      .then((catalog) => {
        if (!isCurrent) {
          return;
        }

        setTickerCatalog(catalog);
        setTickerStatus('ready');
      })
      .catch((error) => {
        if (!isCurrent) {
          return;
        }

        setTickerError(error.message);
        setTickerStatus('error');
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    getCachedCalendarEvents()
      .then((result) => {
        if (!isCurrent) {
          return;
        }

        setCalendarEventsResult(result);
        setCalendarEventsStatus('ready');
      })
      .catch((error) => {
        if (!isCurrent) {
          return;
        }

        setCalendarEventsError(error.message);
        setCalendarEventsStatus('error');
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const tickerMatches = useMemo(() => {
    return tickerCatalog?.search(tickerQuery, { limit: 9 }) ?? [];
  }, [tickerCatalog, tickerQuery]);

  const calendarSections = useMemo(() => {
    const now = Date.now();

    return calendarSectionDefinitions.map((section) => {
      const allEvents = calendarEventsResult.groups[section.key] ?? [];
      const upcomingEvents = allEvents.filter((event) => {
        return event.time && event.time >= now;
      });
      const eventsToShow = upcomingEvents.length
        ? upcomingEvents
        : [...allEvents].reverse();

      return {
        ...section,
        count: calendarEventsResult.counts[section.key] ?? 0,
        events: eventsToShow.slice(0, 5),
      };
    });
  }, [calendarEventsResult.counts, calendarEventsResult.groups]);

  const tickerCountLabel = tickerCatalog
    ? tickerCatalog.count.toLocaleString()
    : 'Loading';
  const calendarEventsCountLabel =
    calendarEventsStatus === 'ready'
      ? `${calendarEventsResult.counts.total.toLocaleString()} events`
      : calendarEventsStatus;
  const calendarEventsSourceLabel =
    calendarEventsStatus === 'ready' && calendarEventsResult.stale
      ? 'Yahoo default endpoint / cached'
      : 'Yahoo default endpoint';

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark">LS</span>
          <div>
            <strong>Liquidity Scanner</strong>
            <span>Market depth monitor</span>
          </div>
        </div>

        <nav className="nav-list">
          <a className="active" href="#dashboard">Dashboard</a>
          <a href="#events">Events</a>
          <a href="#tickers">Tickers</a>
          <a href="#venues">Venues</a>
          <a href="#alerts">Alerts</a>
          <a href="#settings">Settings</a>
        </nav>

        <section className="signal-card" aria-label="Risk signal">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Signal quality</strong>
            <span>92% confidence</span>
          </div>
        </section>
      </aside>

      <section className="workspace" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">Ticker Search</p>
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
              />
            </label>
          </div>
        </header>

        <section className="summary-grid" aria-label="Market summary">
          {markets.map((market) => (
            <article className={`metric-card ${market.tone}`} key={market.name}>
              <div className="metric-topline">
                <span>{market.name}</span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </div>
              <strong>{market.score}</strong>
              <div className="metric-meta">
                <span>{market.change}</span>
                <span>{market.depth}</span>
              </div>
              <div className="meter" aria-label={`${market.name} liquidity score ${market.score}`}>
                <span style={{ width: `${market.score}%` }} />
              </div>
            </article>
          ))}
        </section>

        <section className="calendar-dashboard" id="events">
          <div className="calendar-dashboard-heading">
            <div>
              <p className="eyebrow">Yahoo Calendar</p>
              <h2>Market Events</h2>
            </div>
            <span
              className={`status-pill ${
                calendarEventsStatus === 'ready' ? 'positive' : 'neutral'
              }`}
            >
              {calendarEventsCountLabel}
            </span>
          </div>

          <div className="calendar-events-meta">
            <span>{calendarEventsSourceLabel}</span>
            <span>Cached for 5 minutes</span>
          </div>

          {calendarEventsStatus === 'error' ? (
            <p className="load-error">{calendarEventsError}</p>
          ) : calendarEventsStatus === 'loading' ? (
            <p className="empty-state">Loading market calendar...</p>
          ) : (
            <div className="calendar-sections-grid">
              {calendarSections.map((section) => (
                <article
                  className={`panel calendar-section-panel section-${section.type}`}
                  key={section.key}
                >
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">{section.key}</p>
                      <h2>{section.title}</h2>
                    </div>
                    <span className={`calendar-section-icon type-${section.type}`}>
                      <section.Icon size={18} aria-hidden="true" />
                      {section.count.toLocaleString()}
                    </span>
                  </div>

                  <div
                    className="calendar-section-events"
                    aria-label={`Yahoo Finance ${section.title}`}
                  >
                    {section.events.length ? (
                      section.events.map((event) => (
                        <CalendarEventItem
                          event={event}
                          showType={false}
                          key={event.id}
                        />
                      ))
                    ) : (
                      <p className="empty-state">No events returned.</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel ticker-panel" id="tickers">
          <div className="panel-heading">
            <div>
              <h2>Ticker Info</h2>
            </div>
            <span
              className={`status-pill ${
                tickerStatus === 'ready' ? 'positive' : 'neutral'
              }`}
            >
              {tickerCountLabel}
            </span>
          </div>

          <div className="ticker-source-meta">
            <span>
              {tickerStatus === 'ready'
                ? 'Search by symbol, company name, or CIK'
                : tickerStatus}
            </span>
          </div>

          {tickerStatus === 'error' ? (
            <p className="load-error">{tickerError}</p>
          ) : (
            <div className="ticker-results" aria-label="SEC ticker search results">
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

        <section className="content-grid">
          <article className="panel flow-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Cross-venue flow</p>
                <h2>Depth Pulse</h2>
              </div>
              <span className="status-pill positive">+8.4%</span>
            </div>

            <div className="chart" aria-label="Hourly liquidity flow chart">
              {flowBars.map((height, index) => (
                <span
                  className="chart-bar"
                  style={{ height: `${height}%` }}
                  key={`flow-${index}`}
                />
              ))}
            </div>
          </article>

          <article className="panel alert-panel" id="alerts">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Alert Queue</p>
                <h2>2 Active</h2>
              </div>
              <Bell size={20} aria-hidden="true" />
            </div>

            <div className="alert-list">
              <div>
                <strong>USDJPY depth thinning</strong>
                <span>Asia FX top-of-book depth down 14% in 20 minutes.</span>
              </div>
              <div>
                <strong>NVDA imbalance rising</strong>
                <span>Bid-side concentration crossed the watch threshold.</span>
              </div>
            </div>
          </article>
        </section>

        <section className="panel table-panel" id="venues">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Venue Watchlist</p>
              <h2>Order Book Conditions</h2>
            </div>
            <span className="timestamp">Updated 14:08 SGT</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Symbol</th>
                  <th>Spread</th>
                  <th>Imbalance</th>
                  <th>Depth</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orderBooks.map((book) => (
                  <tr key={`${book.venue}-${book.symbol}`}>
                    <td>{book.venue}</td>
                    <td>{book.symbol}</td>
                    <td>{book.spread}</td>
                    <td>{book.imbalance}</td>
                    <td>{book.depth}</td>
                    <td>
                      <span className={`state state-${book.state.toLowerCase()}`}>
                        {book.state}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;

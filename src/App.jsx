import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  Search,
  ShieldCheck,
} from 'lucide-react';
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

function App() {
  const [tickerCatalog, setTickerCatalog] = useState(null);
  const [tickerQuery, setTickerQuery] = useState('');
  const [tickerStatus, setTickerStatus] = useState('loading');
  const [tickerError, setTickerError] = useState('');

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

  const tickerMatches = useMemo(() => {
    return tickerCatalog?.search(tickerQuery, { limit: 9 }) ?? [];
  }, [tickerCatalog, tickerQuery]);

  const tickerCountLabel = tickerCatalog
    ? tickerCatalog.count.toLocaleString()
    : 'Loading';

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

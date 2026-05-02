import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { getCachedSecCompanyTickerCatalog } from './data/secTickerSource.js';

function App() {
  const [tickerCatalog, setTickerCatalog] = useState(null);
  const [tickerQuery, setTickerQuery] = useState('');
  const [tickerStatus, setTickerStatus] = useState('loading');
  const [tickerError, setTickerError] = useState('');

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

  const tickerMatches = useMemo(() => {
    return tickerCatalog?.search(tickerQuery, { limit: 12 }) ?? [];
  }, [tickerCatalog, tickerQuery]);

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

export default App;

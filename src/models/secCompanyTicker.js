const DEFAULT_SEARCH_LIMIT = 20;

function toCleanString(value) {
  return String(value ?? '').trim();
}

function normalizeTicker(ticker) {
  return toCleanString(ticker).toUpperCase();
}

function normalizeCik(cik) {
  const numericCik = Number(cik);

  if (!Number.isInteger(numericCik) || numericCik <= 0) {
    throw new TypeError(`Invalid SEC CIK: ${cik}`);
  }

  return numericCik;
}

export class SecCompanyTicker {
  constructor({ cik, ticker, title, rank }) {
    this.cik = normalizeCik(cik);
    this.ticker = normalizeTicker(ticker);
    this.title = toCleanString(title);
    this.rank = Number.isInteger(rank) ? rank : 0;
    this.titleSearch = this.title.toUpperCase();

    if (!this.ticker) {
      throw new TypeError('SEC ticker records must include a ticker');
    }

    if (!this.title) {
      throw new TypeError('SEC ticker records must include a company title');
    }
  }

  static fromSecRecord(record, rank = 0) {
    if (!record || typeof record !== 'object') {
      throw new TypeError('SEC ticker record must be an object');
    }

    return new SecCompanyTicker({
      cik: record.cik_str,
      ticker: record.ticker,
      title: record.title,
      rank,
    });
  }

  get paddedCik() {
    return String(this.cik).padStart(10, '0');
  }

  get secCompanyUrl() {
    return `https://www.sec.gov/edgar/browse/?CIK=${this.paddedCik}`;
  }

  matches(query) {
    const term = normalizeTicker(query);

    if (!term) {
      return true;
    }

    return (
      this.ticker.includes(term) ||
      this.titleSearch.includes(term) ||
      String(this.cik).includes(term) ||
      this.paddedCik.includes(term)
    );
  }

  toSecRecord() {
    return {
      cik_str: this.cik,
      ticker: this.ticker,
      title: this.title,
    };
  }
}

export class SecCompanyTickerCatalog {
  constructor(tickers) {
    this.tickers = [...tickers].sort((left, right) => left.rank - right.rank);
    this.tickersByTicker = new Map();
    this.tickersByCik = new Map();

    for (const ticker of this.tickers) {
      this.tickersByTicker.set(ticker.ticker, ticker);

      const cikMatches = this.tickersByCik.get(ticker.cik) ?? [];
      cikMatches.push(ticker);
      this.tickersByCik.set(ticker.cik, cikMatches);
    }
  }

  static fromSecJson(secJson) {
    if (!secJson || typeof secJson !== 'object') {
      throw new TypeError('SEC company ticker payload must be an object');
    }

    const entries = Array.isArray(secJson)
      ? secJson.map((record, index) => [index, record])
      : Object.entries(secJson).sort(([leftKey], [rightKey]) => {
          return Number(leftKey) - Number(rightKey);
        });

    const tickers = entries.map(([rank, record], index) => {
      const numericRank = Number.isInteger(Number(rank)) ? Number(rank) : index;
      return SecCompanyTicker.fromSecRecord(record, numericRank);
    });

    return new SecCompanyTickerCatalog(tickers);
  }

  get count() {
    return this.tickers.length;
  }

  top(limit = DEFAULT_SEARCH_LIMIT) {
    return this.tickers.slice(0, limit);
  }

  getByTicker(ticker) {
    return this.tickersByTicker.get(normalizeTicker(ticker)) ?? null;
  }

  getByCik(cik) {
    return this.getAllByCik(cik)[0] ?? null;
  }

  getAllByCik(cik) {
    try {
      return this.tickersByCik.get(normalizeCik(cik)) ?? [];
    } catch {
      return [];
    }
  }

  search(query, { limit = DEFAULT_SEARCH_LIMIT } = {}) {
    const term = normalizeTicker(query);

    if (!term) {
      return this.top(limit);
    }

    return this.tickers
      .reduce((matches, company) => {
        const tickerIndex = company.ticker.indexOf(term);
        const titleIndex = company.titleSearch.indexOf(term);
        const cik = String(company.cik);
        const cikIndex = cik.indexOf(term);
        const paddedCikIndex = company.paddedCik.indexOf(term);

        if (
          tickerIndex === -1 &&
          titleIndex === -1 &&
          cikIndex === -1 &&
          paddedCikIndex === -1
        ) {
          return matches;
        }

        matches.push({
          company,
          score: getSearchScore({
            tickerIndex,
            titleIndex,
            cikIndex,
            paddedCikIndex,
          }),
        });

        return matches;
      }, [])
      .sort((left, right) => {
        return left.score - right.score || left.company.rank - right.company.rank;
      })
      .slice(0, limit)
      .map((match) => match.company);
  }

  toSecJson() {
    return this.tickers.reduce((payload, ticker, index) => {
      payload[index] = ticker.toSecRecord();
      return payload;
    }, {});
  }
}

function getSearchScore({ tickerIndex, titleIndex, cikIndex, paddedCikIndex }) {
  if (tickerIndex === 0) {
    return 0;
  }

  if (tickerIndex > 0) {
    return 1 + tickerIndex;
  }

  if (cikIndex === 0 || paddedCikIndex === 0) {
    return 20;
  }

  if (titleIndex === 0) {
    return 30;
  }

  if (titleIndex > 0) {
    return 40 + titleIndex;
  }

  return 80;
}

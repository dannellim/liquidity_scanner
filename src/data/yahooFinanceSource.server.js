import YahooFinance from 'yahoo-finance2';

function normalizeSymbol(symbol) {
  return String(symbol ?? '').trim().toUpperCase();
}

export class YahooFinanceSource {
  constructor({
    client = new YahooFinance({ suppressNotices: ['yahooSurvey'] }),
  } = {}) {
    this.client = client;
  }

  async getQuote(symbol) {
    const normalizedSymbol = normalizeSymbol(symbol);

    if (!normalizedSymbol) {
      throw new TypeError('Yahoo Finance quote lookup requires a symbol');
    }

    return normalizeYahooQuote(await this.client.quote(normalizedSymbol));
  }

  async getQuotes(symbols) {
    return Promise.all(symbols.map((symbol) => this.getQuote(symbol)));
  }

  async getTopTradedTickers({ count = 25, region = 'US' } = {}) {
    const result = await this.client.screener('most_actives', {
      count,
      region,
    });

    return (result?.quotes ?? [])
      .map(normalizeYahooMostActiveTicker)
      .sort((left, right) => right.volume - left.volume);
  }

  async search(query) {
    const term = String(query ?? '').trim();

    if (!term) {
      return [];
    }

    const results = await this.client.search(term);
    return (results?.quotes ?? []).map(normalizeYahooSearchResult);
  }
}

export function normalizeYahooQuote(quote) {
  return {
    symbol: quote.symbol,
    shortName: quote.shortName ?? '',
    longName: quote.longName ?? '',
    exchange: quote.fullExchangeName ?? quote.exchange ?? '',
    quoteType: quote.quoteType ?? '',
    currency: quote.currency ?? '',
    regularMarketPrice: quote.regularMarketPrice ?? null,
    regularMarketChange: quote.regularMarketChange ?? null,
    regularMarketChangePercent: quote.regularMarketChangePercent ?? null,
    regularMarketTime: quote.regularMarketTime ?? null,
    marketState: quote.marketState ?? '',
  };
}

export function normalizeYahooMostActiveTicker(result) {
  return {
    symbol: result.symbol,
    shortName: result.shortName ?? result.shortname ?? '',
    longName: result.longName ?? result.longname ?? '',
    exchange: result.fullExchangeName ?? result.exchange ?? '',
    quoteType: result.quoteType ?? '',
    currency: result.currency ?? '',
    regularMarketPrice: result.regularMarketPrice ?? null,
    regularMarketChangePercent: result.regularMarketChangePercent ?? null,
    volume: result.regularMarketVolume ?? result.volume ?? 0,
    averageDailyVolume3Month: result.averageDailyVolume3Month ?? null,
    marketCap: result.marketCap ?? null,
    marketState: result.marketState ?? '',
  };
}

export function normalizeYahooSearchResult(result) {
  return {
    symbol: result.symbol,
    shortName: result.shortname ?? result.shortName ?? '',
    longName: result.longname ?? result.longName ?? '',
    exchange: result.exchDisp ?? result.exchange ?? '',
    quoteType: result.quoteType ?? '',
  };
}

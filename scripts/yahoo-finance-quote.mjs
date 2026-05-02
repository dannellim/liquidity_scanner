import { YahooFinanceSource } from '../src/data/yahooFinanceSource.server.js';

const symbols = process.argv.slice(2);

if (symbols.length === 0) {
  console.error('Usage: npm run yahoo:quote -- AAPL MSFT');
  process.exit(1);
}

const yahooFinance = new YahooFinanceSource();
const quotes = await yahooFinance.getQuotes(symbols);

console.table(
  quotes.map((quote) => ({
    symbol: quote.symbol,
    name: quote.shortName || quote.longName,
    price: quote.regularMarketPrice,
    currency: quote.currency,
    changePercent: quote.regularMarketChangePercent,
    exchange: quote.exchange,
    marketState: quote.marketState,
  })),
);

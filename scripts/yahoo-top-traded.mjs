import { YahooFinanceSource } from '../src/data/yahooFinanceSource.server.js';

const count = Number(process.argv[2] ?? 20);

if (!Number.isInteger(count) || count <= 0) {
  console.error('Usage: npm run yahoo:top-traded -- 20');
  process.exit(1);
}

const yahooFinance = new YahooFinanceSource();
const tickers = await yahooFinance.getTopTradedTickers({ count });

console.table(
  tickers.map((ticker, index) => ({
    rank: index + 1,
    symbol: ticker.symbol,
    name: ticker.shortName || ticker.longName,
    volume: ticker.volume,
    price: ticker.regularMarketPrice,
    changePercent: ticker.regularMarketChangePercent,
    exchange: ticker.exchange,
    marketState: ticker.marketState,
  })),
);

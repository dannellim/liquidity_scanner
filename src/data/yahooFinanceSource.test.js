import assert from 'node:assert/strict';
import { test } from 'node:test';
import { YahooFinanceSource } from './yahooFinanceSource.server.js';

test('normalizes Yahoo Finance quote responses', async () => {
  const source = new YahooFinanceSource({
    client: {
      quote: async (symbol) => ({
        symbol,
        shortName: 'Apple Inc.',
        longName: 'Apple Inc.',
        fullExchangeName: 'NasdaqGS',
        quoteType: 'EQUITY',
        currency: 'USD',
        regularMarketPrice: 189.5,
        regularMarketChange: 1.25,
        regularMarketChangePercent: 0.66,
        marketState: 'REGULAR',
      }),
    },
  });

  assert.deepEqual(await source.getQuote(' aapl '), {
    symbol: 'AAPL',
    shortName: 'Apple Inc.',
    longName: 'Apple Inc.',
    exchange: 'NasdaqGS',
    quoteType: 'EQUITY',
    currency: 'USD',
    regularMarketPrice: 189.5,
    regularMarketChange: 1.25,
    regularMarketChangePercent: 0.66,
    regularMarketTime: null,
    marketState: 'REGULAR',
  });
});

test('normalizes Yahoo Finance search responses', async () => {
  const source = new YahooFinanceSource({
    client: {
      search: async () => ({
        quotes: [
          {
            symbol: 'AMZN',
            shortname: 'Amazon.com, Inc.',
            longname: 'Amazon.com, Inc.',
            exchDisp: 'NASDAQ',
            quoteType: 'EQUITY',
          },
        ],
      }),
    },
  });

  assert.deepEqual(await source.search('amazon'), [
    {
      symbol: 'AMZN',
      shortName: 'Amazon.com, Inc.',
      longName: 'Amazon.com, Inc.',
      exchange: 'NASDAQ',
      quoteType: 'EQUITY',
    },
  ]);
});

test('gets top traded tickers from Yahoo Finance most active screener', async () => {
  const source = new YahooFinanceSource({
    client: {
      screener: async (screenId, options) => {
        assert.equal(screenId, 'most_actives');
        assert.deepEqual(options, { count: 2, region: 'US' });

        return {
          quotes: [
            {
              symbol: 'ABC',
              shortName: 'ABC Corp',
              fullExchangeName: 'NYSE',
              quoteType: 'EQUITY',
              currency: 'USD',
              regularMarketPrice: 12.5,
              regularMarketChangePercent: 1.2,
              regularMarketVolume: 10,
              marketState: 'REGULAR',
            },
            {
              symbol: 'XYZ',
              shortName: 'XYZ Inc.',
              fullExchangeName: 'NasdaqGS',
              quoteType: 'EQUITY',
              currency: 'USD',
              regularMarketPrice: 4.2,
              regularMarketChangePercent: -0.3,
              regularMarketVolume: 50,
              marketState: 'REGULAR',
            },
          ],
        };
      },
    },
  });

  assert.deepEqual(await source.getTopTradedTickers({ count: 2 }), [
    {
      symbol: 'XYZ',
      shortName: 'XYZ Inc.',
      longName: '',
      exchange: 'NasdaqGS',
      quoteType: 'EQUITY',
      currency: 'USD',
      regularMarketPrice: 4.2,
      regularMarketChangePercent: -0.3,
      volume: 50,
      averageDailyVolume3Month: null,
      marketCap: null,
      marketState: 'REGULAR',
    },
    {
      symbol: 'ABC',
      shortName: 'ABC Corp',
      longName: '',
      exchange: 'NYSE',
      quoteType: 'EQUITY',
      currency: 'USD',
      regularMarketPrice: 12.5,
      regularMarketChangePercent: 1.2,
      volume: 10,
      averageDailyVolume3Month: null,
      marketCap: null,
      marketState: 'REGULAR',
    },
  ]);
});

test('rejects empty quote symbols before calling Yahoo Finance', async () => {
  const source = new YahooFinanceSource({
    client: {
      quote: async () => {
        throw new Error('should not call client');
      },
    },
  });

  await assert.rejects(() => source.getQuote(''), {
    name: 'TypeError',
    message: 'Yahoo Finance quote lookup requires a symbol',
  });
});

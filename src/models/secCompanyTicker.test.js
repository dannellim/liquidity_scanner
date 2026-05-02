import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SecCompanyTickerCatalog } from './secCompanyTicker.js';

const sampleSecPayload = {
  0: { cik_str: 1045810, ticker: 'NVDA', title: 'NVIDIA CORP' },
  1: { cik_str: 1652044, ticker: 'GOOGL', title: 'Alphabet Inc.' },
  2: { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
};

test('parses SEC company_tickers.json into a searchable catalog', () => {
  const catalog = SecCompanyTickerCatalog.fromSecJson(sampleSecPayload);

  assert.equal(catalog.count, 3);
  assert.equal(catalog.getByTicker('nvda').title, 'NVIDIA CORP');
  assert.equal(catalog.getByTicker('aapl').paddedCik, '0000320193');
  assert.equal(catalog.getByCik('1652044').ticker, 'GOOGL');
});

test('searches by ticker, company title, and CIK', () => {
  const catalog = SecCompanyTickerCatalog.fromSecJson(sampleSecPayload);

  assert.deepEqual(
    catalog.search('app').map((company) => company.ticker),
    ['AAPL'],
  );
  assert.deepEqual(
    catalog.search('alphabet').map((company) => company.ticker),
    ['GOOGL'],
  );
  assert.deepEqual(
    catalog.search('320193').map((company) => company.ticker),
    ['AAPL'],
  );
});

test('exports back to the SEC numeric-keyed shape', () => {
  const catalog = SecCompanyTickerCatalog.fromSecJson(sampleSecPayload);

  assert.deepEqual(catalog.toSecJson(), sampleSecPayload);
});

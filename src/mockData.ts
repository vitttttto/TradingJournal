export interface TradeRecord {
  id?: string;
  symbol: string;
  _priceFormat: string;
  _priceFormatType: string;
  _tickSize: number;
  buyFillId: string;
  sellFillId: string;
  qty: number;
  buyPrice: number;
  sellPrice: number;
  pnl: number;
  boughtTimestamp: number;
  soldTimestamp: number;
  duration: number;
  direction?: "long" | "short";
  maxPointsProfit?: number;
  commission?: number;
  confluenceTags?: string[];
  mistakeTags?: string[];
  entryTags?: string[];
  images?: string[];
  notes?: string;
  source?: "csv" | "manual" | "seed";
  accountId?: string;
}

// Helper to get timestamps relative to today (assuming year 2026)
const NOW = new Date("2026-03-15T14:30:00Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

export const INITIAL_TRADES: TradeRecord[] = [
  {
    symbol: "BTC/USD",
    _priceFormat: "0.00",
    _priceFormatType: "price",
    _tickSize: 0.1,
    buyFillId: "bf_1001",
    sellFillId: "sf_1001",
    qty: 0.5,
    buyPrice: 65120.50,
    sellPrice: 66200.00,
    pnl: 539.75,
    boughtTimestamp: NOW - 12 * DAY_MS,
    soldTimestamp: NOW - 12 * DAY_MS + 3600000,
    duration: 3600
  },
  {
    symbol: "ETH/USD",
    _priceFormat: "0.00",
    _priceFormatType: "price",
    _tickSize: 0.01,
    buyFillId: "bf_1002",
    sellFillId: "sf_1002",
    qty: 4.0,
    buyPrice: 3450.25,
    sellPrice: 3510.00,
    pnl: 239.00,
    boughtTimestamp: NOW - 10 * DAY_MS,
    soldTimestamp: NOW - 10 * DAY_MS + 5400000,
    duration: 5400
  },
  {
    symbol: "SOL/USD",
    _priceFormat: "0.00",
    _priceFormatType: "price",
    _tickSize: 0.01,
    buyFillId: "bf_1003",
    sellFillId: "sf_1003",
    qty: 25.0,
    buyPrice: 145.60,
    sellPrice: 138.20,
    pnl: -185.00,
    boughtTimestamp: NOW - 8 * DAY_MS,
    soldTimestamp: NOW - 8 * DAY_MS + 1200000,
    duration: 1200
  },
  {
    symbol: "NVDA",
    _priceFormat: "0.00",
    _priceFormatType: "price",
    _tickSize: 0.01,
    buyFillId: "bf_1004",
    sellFillId: "sf_1004",
    qty: 15.0,
    buyPrice: 850.40,
    sellPrice: 885.60,
    pnl: 528.00,
    boughtTimestamp: NOW - 6 * DAY_MS,
    soldTimestamp: NOW - 6 * DAY_MS + 18000000,
    duration: 18000
  },
  {
    symbol: "AAPL",
    _priceFormat: "0.00",
    _priceFormatType: "price",
    _tickSize: 0.01,
    buyFillId: "bf_1005",
    sellFillId: "sf_1005",
    qty: 50.0,
    buyPrice: 172.10,
    sellPrice: 175.80,
    pnl: 185.00,
    boughtTimestamp: NOW - 5 * DAY_MS,
    soldTimestamp: NOW - 5 * DAY_MS + 7200000,
    duration: 7200
  },
  {
    symbol: "BTC/USD",
    _priceFormat: "0.00",
    _priceFormatType: "price",
    _tickSize: 0.1,
    buyFillId: "bf_1006",
    sellFillId: "sf_1006",
    qty: 1.0,
    buyPrice: 67100.00,
    sellPrice: 66800.00,
    pnl: -300.00,
    boughtTimestamp: NOW - 4 * DAY_MS,
    soldTimestamp: NOW - 4 * DAY_MS + 450000,
    duration: 450
  },
  {
    symbol: "ETH/USD",
    _priceFormat: "0.00",
    _priceFormatType: "price",
    _tickSize: 0.01,
    buyFillId: "bf_1007",
    sellFillId: "sf_1007",
    qty: 10.0,
    buyPrice: 3520.00,
    sellPrice: 3610.50,
    pnl: 905.00,
    boughtTimestamp: NOW - 3 * DAY_MS,
    soldTimestamp: NOW - 3 * DAY_MS + 12000000,
    duration: 12000
  },
  {
    symbol: "TSLA",
    _priceFormat: "0.00",
    _priceFormatType: "price",
    _tickSize: 0.01,
    buyFillId: "bf_1008",
    sellFillId: "sf_1008",
    qty: 30.0,
    buyPrice: 178.50,
    sellPrice: 184.20,
    pnl: 171.00,
    boughtTimestamp: NOW - 2 * DAY_MS,
    soldTimestamp: NOW - 2 * DAY_MS + 3600000,
    duration: 3600
  },
  {
    symbol: "NVDA",
    _priceFormat: "0.00",
    _priceFormatType: "price",
    _tickSize: 0.01,
    buyFillId: "bf_1009",
    sellFillId: "sf_1009",
    qty: 8.0,
    buyPrice: 890.00,
    sellPrice: 915.25,
    pnl: 202.00,
    boughtTimestamp: NOW - 1 * DAY_MS,
    soldTimestamp: NOW - 1 * DAY_MS + 5400000,
    duration: 5400
  },
  {
    symbol: "SOL/USD",
    _priceFormat: "0.00",
    _priceFormatType: "price",
    _tickSize: 0.01,
    buyFillId: "bf_1010",
    sellFillId: "sf_1010",
    qty: 100.0,
    buyPrice: 135.00,
    sellPrice: 142.50,
    pnl: 750.00,
    boughtTimestamp: NOW,
    soldTimestamp: NOW + 1800000,
    duration: 1800
  }
];

export const CSV_TEMPLATE = `symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration
BTC/USD,0.00,price,0.1,bf_2001,sf_2001,0.25,65000.00,66500.00,375.00,1773582600000,1773586200000,3600
ETH/USD,0.00,price,0.01,bf_2002,sf_2002,2.0,3450.00,3400.00,-100.00,1773669000000,1773672600000,3600
NVDA,0.00,price,0.01,bf_2003,sf_2003,5.0,850.00,880.00,150.00,1773755400000,1773759000000,3600`;

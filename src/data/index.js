// ── Live prices via CoinGecko (free, no API key) ──────────────────
const COINGECKO_IDS = {
  BTC:  "bitcoin",
  ETH:  "ethereum",
  SOL:  "solana",
  BNB:  "binancecoin",
  USDT: "tether",
  ADA:  "cardano",
};

export async function fetchLivePrices() {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const res  = await fetch(url);
  const json = await res.json();

  return CRYPTO_DATA.map(coin => {
    const id   = COINGECKO_IDS[coin.symbol];
    const live = json[id];
    if (!live) return coin;
    return {
      ...coin,
      price:  live.usd,
      change: parseFloat(live.usd_24h_change?.toFixed(2) ?? coin.change),
    };
  });
}

// ── Static fallback data (used until live prices load) ────────────
export const CRYPTO_DATA = [
  { symbol:"BTC",  name:"Bitcoin",  price:67842.30, change: 2.34,  balance:0.4821, icon:"₿", color:"#F7931A" },
  { symbol:"ETH",  name:"Ethereum", price:3512.80,  change:-1.12,  balance:2.841,  icon:"Ξ", color:"#627EEA" },
  { symbol:"SOL",  name:"Solana",   price:182.44,   change: 5.67,  balance:14.22,  icon:"◎", color:"#9945FF" },
  { symbol:"BNB",  name:"BNB",      price:412.30,   change: 0.88,  balance:3.5,    icon:"B", color:"#F3BA2F" },
  { symbol:"USDT", name:"Tether",   price:1.00,     change: 0.01,  balance:2400,   icon:"₮", color:"#26A17B" },
  { symbol:"ADA",  name:"Cardano",  price:0.612,    change:-2.45,  balance:1200,   icon:"₳", color:"#0D1E7E" },
];

export const TRANSACTIONS = [
  { id:1,  type:"receive", asset:"BTC",  amount:0.0412, usd:2795.10, from:"0x4a2b...8f1c", time:"2h ago",  date:"May 20, 2026", status:"confirmed", category:"crypto" },
  { id:2,  type:"send",    asset:"ETH",  amount:0.5,    usd:1756.40, to:"0x9c3d...2e7a",   time:"5h ago",  date:"May 20, 2026", status:"confirmed", category:"crypto" },
  { id:3,  type:"swap",    fromAsset:"SOL", toAsset:"USDT", amount:5, usd:912.20,           time:"1d ago",  date:"May 19, 2026", status:"confirmed", category:"swap"   },
  { id:4,  type:"receive", asset:"USDT", amount:500,    usd:500,     from:"Bank Transfer",  time:"2d ago",  date:"May 18, 2026", status:"confirmed", category:"bank"   },
  { id:5,  type:"send",    asset:"BTC",  amount:0.021,  usd:1424.69, to:"0x7f1e...4c9b",    time:"3d ago",  date:"May 17, 2026", status:"confirmed", category:"crypto" },
  { id:6,  type:"receive", asset:"SOL",  amount:10,     usd:1824.40, from:"0x2c9a...1f3d",  time:"4d ago",  date:"May 16, 2026", status:"confirmed", category:"crypto" },
  { id:7,  type:"send",    asset:"USDT", amount:300,    usd:300,     to:"Bank Withdrawal",  time:"5d ago",  date:"May 15, 2026", status:"confirmed", category:"bank"   },
  { id:8,  type:"swap",    fromAsset:"BTC", toAsset:"ETH", amount:0.05, usd:3392.12,        time:"6d ago",  date:"May 14, 2026", status:"confirmed", category:"swap"   },
  { id:9,  type:"receive", asset:"BNB",  amount:2,      usd:824.60,  from:"0x8b4c...7a2e",  time:"7d ago",  date:"May 13, 2026", status:"pending",   category:"crypto" },
  { id:10, type:"send",    asset:"ETH",  amount:0.2,    usd:702.56,  to:"0x3d7f...9c1b",    time:"8d ago",  date:"May 12, 2026", status:"confirmed", category:"crypto" },
];

export const CHART_DATA = [42, 38, 45, 41, 55, 52, 61, 58, 67, 64, 71, 68, 78, 74, 82];
import { useState, useEffect } from "react";

const RATE_CACHE_KEY = "nova_exchange_rates";
const RATE_CACHE_TIME = "nova_exchange_rates_time";
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const SYMBOLS = { USD: "$", EUR: "€", GBP: "£" };

export function useCurrency(currencyCode = "USD") {
  const [rates, setRates] = useState({ USD: 1, EUR: 0.92, GBP: 0.79 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRates = async () => {
      try {
        const cached = localStorage.getItem(RATE_CACHE_KEY);
        const cachedTime = localStorage.getItem(RATE_CACHE_TIME);
        if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < CACHE_DURATION) {
          setRates(JSON.parse(cached));
          setLoading(false);
          return;
        }
        const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
        const data = await res.json();
        const newRates = {
          USD: 1,
          EUR: data.rates.EUR || 0.92,
          GBP: data.rates.GBP || 0.79,
        };
        setRates(newRates);
        localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(newRates));
        localStorage.setItem(RATE_CACHE_TIME, Date.now().toString());
      } catch {
        // keep fallback rates
      }
      setLoading(false);
    };
    loadRates();
  }, []);

  const convert = (usdAmount) => {
    const rate = rates[currencyCode] || 1;
    return parseFloat(usdAmount || 0) * rate;
  };

  const format = (usdAmount, decimals = 2) => {
    const converted = convert(usdAmount);
    const symbol = SYMBOLS[currencyCode] || "$";
    return `${symbol}${converted.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  return { rates, loading, convert, format, symbol: SYMBOLS[currencyCode] || "$" };
}
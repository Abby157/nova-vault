# NOVA Vault — Premium Crypto Banking App

Dark luxury crypto-first banking app built with React + Vite.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run dev server
npm run dev

# 3. Open in browser
# http://localhost:5173
```

## Login Credentials (Demo)

| Method   | Credentials       |
|----------|-------------------|
| Face ID  | Click "Authenticate" (auto-succeeds after 2s) |
| PIN      | `123456`          |
| Email    | Any email + any password (4+ chars) |

## Project Structure

```
nova-vault/
├── src/
│   ├── components/
│   │   └── UI.jsx              # Shared: Card, GoldButton, Sparkline, etc.
│   ├── screens/
│   │   ├── LoginScreen.jsx     # Biometric / PIN / Email login
│   │   ├── Dashboard.jsx       # Home + portfolio summary
│   │   ├── SendReceive.jsx     # Send & receive crypto
│   │   ├── TradeScreen.jsx     # Swap / Buy / Sell + live market
│   │   ├── CardsScreen.jsx     # Card management + banking
│   │   ├── PortfolioScreen.jsx # Pie chart breakdown + stats
│   │   └── TransactionScreen.jsx # Full tx history + filters
│   ├── data/
│   │   └── index.js            # Mock crypto & transaction data
│   ├── theme.js                # Color tokens
│   ├── App.jsx                 # Root layout + navigation
│   └── main.jsx                # Entry point
├── index.html
├── vite.config.js
└── package.json
```

## Screens

- **Login** — Face ID animation, PIN keypad, Email/password
- **Dashboard** — Animated balance, sparkline chart, quick actions, asset list
- **Transfer** — Send (3-step confirm flow) + Receive (QR code)
- **Trade** — Swap/Buy/Sell with live rate calculation
- **Cards** — Stacked card UI, controls, banking services
- **Portfolio** — Interactive SVG pie chart, per-asset breakdown
- **History** — Searchable, filterable, sortable transaction log

## Build for Production

```bash
npm run build
# Output in /dist
```

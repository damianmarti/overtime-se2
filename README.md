# 🎲 Overtime - Decentralized Sports Betting dApp

A decentralized sports betting platform built on top of the [Overtime Protocol](https://overtime.io/), allowing users to place bets on sports markets across multiple blockchains.

<h4 align="center">
  <a href="https://docs.overtime.io/">Overtime Documentation</a> |
  <a href="https://www.overtime.io/">Overtime.io</a>
</h4>

## 📋 About

This dApp provides a user-friendly interface for interacting with Overtime's decentralized sports betting protocol. Place bets on various sports markets, view live odds, track your betting history, and claim winnings - all on-chain with USDC.

### ✨ Features

- 🏈 **Multi-Sport Markets**: Browse betting markets across football, basketball, soccer, and more
- 💰 **Live Quote Generation**: Automatic quote generation when entering bet amounts or selecting positions
- 🎯 **Place Bets On-Chain**: Place bets directly on-chain with USDC
- 🌐 **Multi-Network Support**: Works on Optimism, Base, and Arbitrum
- 📊 **Betting History**: View your open, claimable, and closed bets
- 🏆 **Claim Winnings**: Claim winnings for resolved bets directly from your profile
- 📈 **Dynamic Odds Display**: Support for 2-way and 3-way markets (with draw options)
- 💾 **Cached Market Data**: Markets are cached locally (IndexedDB) for instant loading
- 🔄 **Auto-Refresh**: Market data automatically refreshes every 5 minutes

### 🛠️ Tech Stack

Built using **Scaffold-ETH 2** with:
- ⚛️ **Next.js** - React framework with App Router
- 🌈 **RainbowKit** - Wallet connection UI
- 🔗 **Wagmi** - React hooks for Ethereum
- 📝 **TypeScript** - Type-safe development
- 🎨 **Tailwind CSS & DaisyUI** - Styling
- 💾 **IndexedDB** - Client-side storage for market data

## Requirements

Before you begin, you need to install the following tools:

- [Node (>= v20.18.3)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

## 🚀 Quickstart

### 1. Clone and Install

```bash
git clone git@github.com:damianmarti/overtime-se2.git
cd overtime
yarn install
```

### 2. Environment Setup

Copy the `.env.example` file to `.env.local` in `packages/nextjs/`:

```bash
cd packages/nextjs
cp .env.example .env.local
```

Then edit `.env.local` and add your Overtime API key:

```bash
# Overtime API Key (required for fetching markets and quotes)
OVERTIME_API_KEY=your_api_key_here
```

To get an Overtime API key, visit [Overtime Documentation](https://docs.overtime.io/).

### 3. Configuration

Edit `packages/nextjs/scaffold.config.ts` to customize:

- **`referralAddress`**: Set your referral address (default: zero address)
- **`marketsCacheDuration`**: How long to cache market data in milliseconds (default: 5 minutes)
- **`targetNetworks`**: Networks to support (Optimism, Base, Arbitrum)

Example:
```typescript
const scaffoldConfig = {
  referralAddress: "0xYourReferralAddress",
  marketsCacheDuration: 5 * 60 * 1000, // 5 minutes
  targetNetworks: [chains.optimism, chains.base, chains.arbitrum],
  // ... other config
}
```

### 4. Start the App

```bash
yarn start
```

Visit your app on: `http://localhost:3000`

- Browse markets on the home page
- Connect your wallet (top right)
- View your betting history on the `/profile` page
- The app will default to **Optimism (Chain ID: 10)** if no wallet is connected


## 📁 Project Structure

```
packages/nextjs/
├── app/
│   ├── page.tsx                    # Home page (About section)
│   ├── profile/
│   │   └── page.tsx                # User betting history & claim winnings
│   └── api/
│       ├── markets/[networkId]/    # Fetch markets from Overtime API
│       └── profile/[networkId]/[address]/  # Fetch user history
├── components/
│   ├── Overtime.tsx                # Main container component
│   ├── MarketsList.tsx             # Markets display with caching & state
│   ├── MarketCard.tsx              # Individual market card
│   └── QuoteModal.tsx              # Bet placement modal
├── contracts/
│   ├── deployedContracts.ts        # Deployed contract addresses (auto-generated)
│   └── externalContracts.ts        # External contracts (SportsAMMV2, USDC)
└── scaffold.config.ts              # App configuration
```

## 🔑 Key Components

### `Overtime` Component
Main container that orchestrates the markets display and quote modal. Minimal state - just manages which market is selected for betting.

### `MarketsList` Component
Self-contained component that:
- Fetches markets from the API
- Caches market data in IndexedDB
- Auto-refreshes stale data (>5 minutes)
- Handles sport/league collapse/expand
- Displays all markets in a hierarchical structure

### `QuoteModal` Component
Handles the entire betting flow:
- Position selection (Home/Away/Draw)
- Buy-in amount input
- Auto-fetches quotes from Overtime API
- USDC approval
- Bet placement via SportsAMMV2 contract

### `MarketCard` Component
Displays individual market information:
- Match details (teams, date, time)
- Market status (Open/Paused/Resolved/Cancelled)
- Odds display (2-way or 3-way markets)
- "Place Bet" button

## 🔗 API Routes

### `GET /api/markets/[networkId]`
Fetches all available markets for a specific network from Overtime API.

**Parameters:**
- `networkId`: Network ID (10 for Optimism, 8453 for Base, 42161 for Arbitrum)

### `GET /api/profile/[networkId]/[address]`
Fetches user's betting history for a specific network and address.

**Parameters:**
- `networkId`: Network ID
- `address`: User's wallet address

## 🚢 Deployment

### Vercel Deployment

```bash
yarn vercel
```

Or use the Vercel dashboard to connect your GitHub repository.

**Environment Variables:**
Make sure to set `OVERTIME_API_KEY` in your Vercel project settings.

### IPFS Deployment

```bash
yarn ipfs
```

## 🐛 Troubleshooting

### Markets not loading
- Verify your `OVERTIME_API_KEY` is set correctly in `.env.local`
- Check browser console for API errors
- Try clearing IndexedDB cache (Application tab in DevTools)

### Styles missing in production
- The project uses Tailwind CSS v4 with custom utility class safelisting
- All dynamic classes are defined in `packages/nextjs/styles/globals.css`
- If styles are missing, check that your production build includes these classes

### Network issues
- Ensure you're on a supported network (Optimism, Base, or Arbitrum)
- The app defaults to Optimism (10) if you're on an unsupported network
- Check that you have USDC on the selected network

### USDC approval failing
- Make sure you have enough USDC balance
- Check that the SportsAMMV2 contract address is correct in `externalContracts.ts`
- Try increasing gas limit in your wallet

## 📚 Documentation

- **Overtime Protocol**: [docs.overtime.io](https://docs.overtime.io/)
- **Scaffold-ETH 2**: [docs.scaffoldeth.io](https://docs.scaffoldeth.io)
- **Wagmi Hooks**: [wagmi.sh](https://wagmi.sh/)
- **RainbowKit**: [rainbowkit.com](https://www.rainbowkit.com/)

## 🎯 Key Features Explained

### Market Caching
Markets are stored in IndexedDB for instant loading. The cache is automatically refreshed:
- When it's older than 5 minutes (configurable via `marketsCacheDuration`)
- When you manually click the "Refresh" button
- On first load if no cache exists

### Auto-Quote Generation
Quotes are automatically fetched when you:
- Enter a buy-in amount (minimum 3 USDC)
- Change your position selection (Home/Away/Draw)
- This provides instant feedback on potential payouts

### Multi-Network Support
The app automatically detects your connected network and:
- Fetches markets for that network
- Uses the correct contract addresses
- Displays your betting history for that network
- Defaults to Optimism if you're on Ethereum mainnet or no wallet is connected

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License

This project is built on top of Scaffold-ETH 2 and uses the Overtime Protocol.
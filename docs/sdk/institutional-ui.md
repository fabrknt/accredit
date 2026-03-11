# Institutional Dashboard

## @accredit/institutional-ui

A React-based compliance dashboard for institutional investors and compliance officers. Provides oversight of KYC entries, pool registries, wrapper operations, and compliance analytics.

## Setup

### Prerequisites

- Node.js 20+
- pnpm 10+
- A Solana RPC endpoint

### Development

```bash
# From the accredit root
pnpm install

# Build dependencies first
pnpm --filter @accredit/core build

# Start the dashboard dev server
pnpm --filter @accredit/institutional-ui dev
```

The dashboard runs at `http://localhost:5173` by default.

### Environment Variables

Create a `.env` file in `packages/institutional-ui/`:

```env
VITE_RPC_URL=https://api.devnet.solana.com
VITE_QN_ADDON_URL=http://localhost:3000
```

### Production Build

```bash
pnpm --filter @accredit/institutional-ui build
# Output: packages/institutional-ui/dist/
```

## Dashboard Views

### Main Dashboard (`/`)

Overview with four key metrics:
- Total Wallets Verified
- Active Compliant Pools
- Wrapped Asset Configs
- Overall Compliance Rate

Plus recent activity feed and system status panel.

### KYC Management (`/kyc`)

- **Stats row** — Total entries, active, expired, by jurisdiction
- **Whitelist entry table** — Sortable by wallet, KYC level, jurisdiction, status, verification date, expiry
- **Batch operations panel** — Paste multiple wallet addresses for batch compliance checks
- All addresses are truncated (first 4...last 4) with full address on hover

### Pool Registry (`/registry`)

- **Stats** — Total pools, active, suspended, revoked
- **Pool table** — AMM key, DEX label, status badge, jurisdiction, KYC level, audit expiry
- Status badges: green (Active), yellow (Suspended), red (Revoked)

### Wrapper Operations (`/wrapper`)

- **Stats** — Total wrappers, active supply, min KYC levels
- **Wrapper cards** — Grid of cards showing underlying/wrapped mint, total supply, status, min KYC level, fee basis points

### Analytics (`/analytics`)

- Jurisdiction distribution (CSS bar charts)
- KYC level distribution
- Compliance check history
- No external charting library required

## Architecture

```
institutional-ui/
├── src/
│   ├── App.tsx              # Router + wallet adapter providers
│   ├── config.ts            # RPC URL, program IDs, QN addon URL
│   ├── hooks/               # React hooks for SDK integration
│   ├── components/
│   │   ├── layout/          # DashboardLayout, Sidebar, Header
│   │   ├── kyc/             # KYC management components
│   │   ├── registry/        # Pool registry components
│   │   ├── wrapper/         # Wrapper components
│   │   ├── analytics/       # Analytics components
│   │   └── common/          # DataTable, StatusBadge, LoadingSpinner
│   ├── pages/               # Page components (route targets)
│   └── services/api.ts      # QN addon REST client
```

### API Client

The dashboard communicates with the QN add-on REST API:

```typescript
import { AccreditAPI } from './services/api';

const api = new AccreditAPI('http://localhost:3000', 'optional-api-key');

// KYC
const entry = await api.getKycEntry(walletAddress);
const result = await api.checkCompliance(wallet, minKycLevel);
const batch = await api.batchCheckCompliance(wallets);

// Providers
const providers = await api.getProviders();

// Wrapper
const configs = await api.getWrapperConfigs();

// Pools
const status = await api.getPoolStatus(ammKey);
```

### Wallet Integration

Uses `@solana/wallet-adapter-react` for wallet connection. The `WalletConnect` button in the header supports Phantom, Solflare, and other Solana wallets.

## Design

- Dark navy theme (#0a0e27 background, #141834 cards)
- Accent blue (#3b82f6), green (#10b981) for active, red (#ef4444) for revoked
- Desktop-first responsive layout
- Monospace font for addresses, Inter/system sans-serif for text
- No emojis

## Dependencies

| Package | Purpose |
|---------|---------|
| `@accredit/core` | Shared compliance types |
| `@solana/web3.js` | Solana RPC connection |
| `@solana/wallet-adapter-*` | Wallet connection |
| `react-router-dom` | Client-side routing |
| `vite` | Build tooling |

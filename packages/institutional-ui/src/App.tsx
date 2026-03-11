import { useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { config } from './config';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardPage } from './pages/DashboardPage';
import { KycPage } from './pages/KycPage';
import { RegistryPage } from './pages/RegistryPage';
import { WrapperPage } from './pages/WrapperPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

import '@solana/wallet-adapter-react-ui/styles.css';

export default function App() {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={config.rpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/kyc" element={<KycPage />} />
              <Route path="/registry" element={<RegistryPage />} />
              <Route path="/wrapper" element={<WrapperPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Route>
          </Routes>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

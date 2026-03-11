import { useLocation } from 'react-router-dom';
import { WalletConnect } from '../common/WalletConnect';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/kyc': 'KYC Management',
  '/registry': 'Pool Registry',
  '/wrapper': 'Wrapper Operations',
  '/analytics': 'Analytics',
};

export function Header() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Dashboard';

  return (
    <header className="header">
      <div className="header-title">
        <h1>{title}</h1>
      </div>
      <div className="header-actions">
        <div className="header-network">
          <span className="network-dot" />
          <span>Devnet</span>
        </div>
        <WalletConnect />
      </div>
    </header>
  );
}

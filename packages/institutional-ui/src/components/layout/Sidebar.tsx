import { NavLink } from 'react-router-dom';
import type { NavItem } from '../../types';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: 'grid' },
  { label: 'KYC Management', path: '/kyc', icon: 'shield' },
  { label: 'Pool Registry', path: '/registry', icon: 'layers' },
  { label: 'Wrapper', path: '/wrapper', icon: 'package' },
  { label: 'Analytics', path: '/analytics', icon: 'bar-chart' },
];

const ICON_MAP: Record<string, string> = {
  grid: '\u2630',
  shield: '\u229A',
  layers: '\u25A6',
  package: '\u2750',
  'bar-chart': '\u2584',
};

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">A</div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">Accredit</span>
          <span className="sidebar-brand-tagline">Compliance Infrastructure</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <span className="sidebar-link-icon">{ICON_MAP[item.icon]}</span>
            <span className="sidebar-link-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-footer-text">v0.1.0 -- Devnet</div>
      </div>
    </aside>
  );
}

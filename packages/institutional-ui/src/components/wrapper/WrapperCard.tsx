import { KycLevel } from '@fabrknt/accredit-core';
import { truncateAddress } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import type { WrapperConfig } from '../../types';

function getKycLevelLabel(level: KycLevel): string {
  const labels: Record<KycLevel, string> = {
    [KycLevel.Basic]: 'Basic',
    [KycLevel.Standard]: 'Standard',
    [KycLevel.Enhanced]: 'Enhanced',
    [KycLevel.Institutional]: 'Institutional',
  };
  return labels[level] ?? 'Unknown';
}

interface WrapperCardProps {
  wrapper: WrapperConfig;
}

export function WrapperCard({ wrapper }: WrapperCardProps) {
  return (
    <div className="wrapper-card card">
      <div className="wrapper-card-header">
        <StatusBadge status={wrapper.isActive ? 'active' : 'revoked'} />
        <span className="wrapper-card-fee">{wrapper.feeBasisPoints} bps fee</span>
      </div>
      <div className="wrapper-card-body">
        <div className="wrapper-card-field">
          <span className="wrapper-card-label">Address</span>
          <span className="mono-font" title={wrapper.address}>
            {truncateAddress(wrapper.address)}
          </span>
        </div>
        <div className="wrapper-card-field">
          <span className="wrapper-card-label">Underlying Mint</span>
          <span className="mono-font" title={wrapper.underlyingMint}>
            {truncateAddress(wrapper.underlyingMint)}
          </span>
        </div>
        <div className="wrapper-card-field">
          <span className="wrapper-card-label">Wrapped Mint</span>
          <span className="mono-font" title={wrapper.wrappedMint}>
            {truncateAddress(wrapper.wrappedMint)}
          </span>
        </div>
        <div className="wrapper-card-field">
          <span className="wrapper-card-label">Total Supply</span>
          <span>{wrapper.totalSupply}</span>
        </div>
        <div className="wrapper-card-field">
          <span className="wrapper-card-label">Min KYC Level</span>
          <span>{getKycLevelLabel(wrapper.minKycLevel)}</span>
        </div>
      </div>
    </div>
  );
}

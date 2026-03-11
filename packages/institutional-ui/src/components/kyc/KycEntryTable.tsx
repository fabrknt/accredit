import { KycLevel, Jurisdiction } from '@accredit/core';
import type { WhitelistEntry } from '@accredit/core';
import { DataTable, truncateAddress } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import type { ColumnDef } from '../../types';

function getKycLevelLabel(level: KycLevel): string {
  const labels: Record<KycLevel, string> = {
    [KycLevel.Basic]: 'Basic',
    [KycLevel.Standard]: 'Standard',
    [KycLevel.Enhanced]: 'Enhanced',
    [KycLevel.Institutional]: 'Institutional',
  };
  return labels[level] ?? 'Unknown';
}

function getJurisdictionLabel(jurisdiction: Jurisdiction): string {
  const labels: Record<Jurisdiction, string> = {
    [Jurisdiction.Japan]: 'Japan',
    [Jurisdiction.Singapore]: 'Singapore',
    [Jurisdiction.HongKong]: 'Hong Kong',
    [Jurisdiction.Eu]: 'EU',
    [Jurisdiction.Usa]: 'USA',
    [Jurisdiction.Other]: 'Other',
  };
  return labels[jurisdiction] ?? 'Unknown';
}

function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return '--';
  return new Date(Number(ts) * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getEntryStatus(
  entry: WhitelistEntry,
): 'active' | 'expired' | 'revoked' {
  if (!entry.isActive) return 'revoked';
  if (entry.expiryTimestamp > 0n) {
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (entry.expiryTimestamp < now) return 'expired';
  }
  return 'active';
}

interface KycEntryTableProps {
  entries: WhitelistEntry[];
}

export function KycEntryTable({ entries }: KycEntryTableProps) {
  const columns: ColumnDef<WhitelistEntry>[] = [
    {
      label: 'Wallet',
      key: 'wallet',
      render: (row) => (
        <span className="mono-font" title={row.wallet}>
          {truncateAddress(row.wallet)}
        </span>
      ),
    },
    {
      label: 'KYC Level',
      key: 'kycLevel',
      render: (row) => (
        <span className={`kyc-level kyc-level-${row.kycLevel}`}>
          {getKycLevelLabel(row.kycLevel)}
        </span>
      ),
    },
    {
      label: 'Jurisdiction',
      key: 'jurisdiction',
      render: (row) => getJurisdictionLabel(row.jurisdiction),
    },
    {
      label: 'Status',
      key: 'isActive',
      render: (row) => {
        const status = getEntryStatus(row);
        return <StatusBadge status={status} />;
      },
    },
    {
      label: 'Verified At',
      key: 'verifiedAt',
      render: (row) => formatTimestamp(row.verifiedAt),
    },
    {
      label: 'Expires',
      key: 'expiryTimestamp',
      render: (row) => formatTimestamp(row.expiryTimestamp),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={entries}
      emptyMessage="No KYC entries found"
    />
  );
}

import { Jurisdiction, KycLevel } from '@accredit/core';
import { DataTable, truncateAddress } from '../common/DataTable';
import { StatusBadge } from '../common/StatusBadge';
import type { ColumnDef, PoolStatusResponse } from '../../types';

function getJurisdictionLabel(j: Jurisdiction): string {
  const labels: Record<Jurisdiction, string> = {
    [Jurisdiction.Japan]: 'Japan',
    [Jurisdiction.Singapore]: 'Singapore',
    [Jurisdiction.HongKong]: 'Hong Kong',
    [Jurisdiction.Eu]: 'EU',
    [Jurisdiction.Usa]: 'USA',
    [Jurisdiction.Other]: 'Other',
  };
  return labels[j] ?? 'Unknown';
}

function getKycLevelLabel(level: KycLevel): string {
  const labels: Record<KycLevel, string> = {
    [KycLevel.Basic]: 'Basic',
    [KycLevel.Standard]: 'Standard',
    [KycLevel.Enhanced]: 'Enhanced',
    [KycLevel.Institutional]: 'Institutional',
  };
  return labels[level] ?? 'Unknown';
}

function formatDate(ts: number): string {
  if (ts === 0) return '--';
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface PoolTableProps {
  pools: PoolStatusResponse[];
}

export function PoolTable({ pools }: PoolTableProps) {
  const columns: ColumnDef<PoolStatusResponse>[] = [
    {
      label: 'AMM Key',
      key: 'ammKey',
      render: (row) => (
        <span className="mono-font" title={row.ammKey}>
          {truncateAddress(row.ammKey)}
        </span>
      ),
    },
    {
      label: 'DEX Label',
      key: 'dexLabel',
    },
    {
      label: 'Status',
      key: 'status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      label: 'Jurisdiction',
      key: 'jurisdiction',
      render: (row) => getJurisdictionLabel(row.jurisdiction),
    },
    {
      label: 'KYC Level',
      key: 'kycLevel',
      render: (row) => getKycLevelLabel(row.kycLevel),
    },
    {
      label: 'Audit Expiry',
      key: 'auditExpiry',
      render: (row) => formatDate(row.auditExpiry),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={pools}
      emptyMessage="No pools registered"
    />
  );
}

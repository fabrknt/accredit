import { useState, useEffect, useCallback } from 'react';
import type { WhitelistEntry } from '@fabrknt/accredit-core';
import { useAccreditClient } from './useAccreditClient';

interface KycDataState {
  entries: WhitelistEntry[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch and manage KYC whitelist data.
 * Accepts an array of wallet addresses to query.
 */
export function useKycData(wallets: string[]) {
  const { api } = useAccreditClient();
  const [state, setState] = useState<KycDataState>({
    entries: [],
    loading: false,
    error: null,
  });

  const fetchEntries = useCallback(async () => {
    if (wallets.length === 0) {
      setState({ entries: [], loading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const results = await Promise.all(
        wallets.map((w) => api.getKycEntry(w)),
      );
      const entries = results.filter(
        (entry): entry is WhitelistEntry => entry !== null,
      );
      setState({ entries, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch KYC data';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [api, wallets]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return { ...state, refresh: fetchEntries };
}

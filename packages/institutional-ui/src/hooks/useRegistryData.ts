import { useState, useEffect, useCallback } from 'react';
import type { PoolStatusResponse } from '../types';
import { useAccreditClient } from './useAccreditClient';

interface RegistryDataState {
  pools: PoolStatusResponse[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch pool registry data.
 * Accepts an array of AMM keys to query.
 */
export function useRegistryData(ammKeys: string[]) {
  const { api } = useAccreditClient();
  const [state, setState] = useState<RegistryDataState>({
    pools: [],
    loading: false,
    error: null,
  });

  const fetchPools = useCallback(async () => {
    if (ammKeys.length === 0) {
      setState({ pools: [], loading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const results = await Promise.allSettled(
        ammKeys.map((key) => api.getPoolStatus(key)),
      );
      const pools = results
        .filter(
          (r): r is PromiseFulfilledResult<PoolStatusResponse> =>
            r.status === 'fulfilled',
        )
        .map((r) => r.value);
      setState({ pools, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch registry data';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [api, ammKeys]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  return { ...state, refresh: fetchPools };
}

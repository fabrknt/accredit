import { useState, useEffect, useCallback } from 'react';
import type { WrapperConfig } from '../types';
import { useAccreditClient } from './useAccreditClient';

interface WrapperDataState {
  wrappers: WrapperConfig[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch wrapper configuration data.
 */
export function useWrapperData() {
  const { api } = useAccreditClient();
  const [state, setState] = useState<WrapperDataState>({
    wrappers: [],
    loading: false,
    error: null,
  });

  const fetchWrappers = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const wrappers = await api.getWrapperConfigs();
      setState({ wrappers, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch wrapper data';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [api]);

  useEffect(() => {
    fetchWrappers();
  }, [fetchWrappers]);

  return { ...state, refresh: fetchWrappers };
}

import { useMemo } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { AccreditAPI } from '../services/api';
import { config } from '../config';

/** SDK client instances for interacting with Accredit on-chain programs */
export interface AccreditClients {
  api: AccreditAPI;
  rpcUrl: string;
  programIds: {
    transferHook: string;
    compliantRegistry: string;
    sovereign: string;
    wrapper: string;
  };
}

/**
 * Hook that creates and memoizes SDK client instances
 * using the connected wallet's connection.
 */
export function useAccreditClient(): AccreditClients {
  const { connection } = useConnection();

  const clients = useMemo<AccreditClients>(() => {
    const rpcUrl = connection.rpcEndpoint || config.rpcUrl;
    const api = new AccreditAPI(config.qnAddonUrl);

    return {
      api,
      rpcUrl,
      programIds: {
        transferHook: config.transferHookProgramId,
        compliantRegistry: config.compliantRegistryProgramId,
        sovereign: config.sovereignProgramId,
        wrapper: config.wrapperProgramId,
      },
    };
  }, [connection.rpcEndpoint]);

  return clients;
}

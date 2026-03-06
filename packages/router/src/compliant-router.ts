import { Connection, PublicKey } from '@solana/web3.js';
import { JupiterAggregator, RouteOptimizer } from './aggregator';
import type { QuoteResponse, QuoteRequest } from './types';
import { PoolWhitelistManager } from './pool-whitelist';
import { RouteComplianceFilter } from './route-filter';
import { KycComplianceChecker } from './kyc-checker';
import { ZkComplianceProver, type NoirProverLike } from './zk-compliance';
import {
  KycLevel,
  type ComplianceRouterConfig,
  type CompliantQuoteResult,
  type RouteComplianceResult,
} from './types';

const DEFAULT_REGISTRY_PROGRAM_ID = new PublicKey(
  '66tKcQqpv8GH2igWWBcLVrTjvo8cgpVJJAE8xadAgnYA'
);
const DEFAULT_TRANSFER_HOOK_PROGRAM_ID = new PublicKey(
  '5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL'
);

/**
 * Compliance-aware router that wraps Jupiter DEX aggregation (Solana).
 *
 * Flow:
 * 1. Check trader KYC status via transfer-hook WhitelistEntry
 * 2. Get Jupiter quote via JupiterAggregator
 * 3. Filter route hops — only whitelisted pools pass
 * 4. If multi-hop fails compliance, retry with onlyDirectRoutes
 * 5. Return compliant quote or throw
 */
export class ComplianceAwareRouter {
  private aggregator: JupiterAggregator;
  private optimizer: RouteOptimizer;
  private whitelist: PoolWhitelistManager;
  private filter: RouteComplianceFilter;
  private kycChecker: KycComplianceChecker;
  private zkProver: ZkComplianceProver;
  private routerConfig: ComplianceRouterConfig;

  constructor(
    connection: Connection,
    registryAuthority: PublicKey,
    config: ComplianceRouterConfig = {},
    noirProver?: NoirProverLike
  ) {
    const registryProgramId = config.registryAddress
      ? new PublicKey(config.registryAddress)
      : (config.registryProgramId as PublicKey | undefined) ?? DEFAULT_REGISTRY_PROGRAM_ID;
    const transferHookProgramId = config.complianceAddress
      ? new PublicKey(config.complianceAddress)
      : (config.transferHookProgramId as PublicKey | undefined) ?? DEFAULT_TRANSFER_HOOK_PROGRAM_ID;

    const apiBaseUrl = config.aggregatorApiBaseUrl || config.jupiterApiBaseUrl || 'https://quote-api.jup.ag/v6';

    this.routerConfig = {
      rpcUrl: config.rpcUrl ?? '',
      registryAddress: registryProgramId.toBase58(),
      complianceAddress: transferHookProgramId.toBase58(),
      aggregatorApiBaseUrl: apiBaseUrl,
      defaultSlippageBps: config.defaultSlippageBps ?? 50,
      fallbackToDirectRoutes: config.fallbackToDirectRoutes ?? true,
      maxRouteHops: config.maxRouteHops ?? 4,
    };

    this.aggregator = new JupiterAggregator({
      apiBaseUrl,
      defaultSlippageBps: this.routerConfig.defaultSlippageBps,
    });

    this.optimizer = new RouteOptimizer({
      apiBaseUrl,
      defaultSlippageBps: this.routerConfig.defaultSlippageBps,
    });

    this.whitelist = new PoolWhitelistManager(
      connection,
      registryProgramId,
      registryAuthority
    );

    this.filter = new RouteComplianceFilter(this.whitelist);
    this.kycChecker = new KycComplianceChecker(connection, transferHookProgramId);
    this.zkProver = new ZkComplianceProver(noirProver);
  }

  /**
   * Get a compliant quote for a trade.
   */
  async getCompliantQuote(
    trader: PublicKey,
    request: QuoteRequest,
    jurisdictionBitmask: number = 0b00111111
  ): Promise<CompliantQuoteResult> {
    // Step 1: Check trader KYC
    const kycResult = await this.kycChecker.checkTraderCompliance(
      trader,
      KycLevel.Basic,
      jurisdictionBitmask
    );

    if (!kycResult.isCompliant) {
      throw new Error(`KYC check failed: ${kycResult.reason}`);
    }

    const entry = kycResult.entry!;

    // Step 2: Get Jupiter quote
    const quote = await this.aggregator.getQuote(request);

    // Step 3: Check route compliance
    const compliance = this.filter.checkRouteCompliance(quote);

    if (compliance.isCompliant) {
      return {
        quote,
        wasFiltered: false,
        compliantHopCount: quote.routePlan.length,
        traderKycLevel: entry.kycLevel,
        traderJurisdiction: entry.jurisdiction,
      };
    }

    // Step 4: Retry with direct route
    if (this.routerConfig.fallbackToDirectRoutes) {
      const directRequest: QuoteRequest = {
        ...request,
        onlyDirectRoutes: true,
      };

      const directQuote = await this.aggregator.getQuote(directRequest);
      const directCompliance =
        this.filter.checkRouteCompliance(directQuote);

      if (directCompliance.isCompliant) {
        return {
          quote: directQuote,
          wasFiltered: true,
          compliantHopCount: directQuote.routePlan.length,
          traderKycLevel: entry.kycLevel,
          traderJurisdiction: entry.jurisdiction,
        };
      }
    }

    throw new Error(
      `No compliant route found. Non-compliant pools: ${compliance.nonCompliantPools.join(', ')}`
    );
  }

  /** Check if a quote's route is fully compliant */
  isRouteCompliant(quote: QuoteResponse): RouteComplianceResult {
    return this.filter.checkRouteCompliance(quote);
  }

  /** Sync the pool whitelist from on-chain state */
  async syncWhitelist(): Promise<number> {
    return this.whitelist.syncFromChain();
  }

  getAggregator(): JupiterAggregator {
    return this.aggregator;
  }

  getOptimizer(): RouteOptimizer {
    return this.optimizer;
  }

  getWhitelistManager(): PoolWhitelistManager {
    return this.whitelist;
  }

  getKycChecker(): KycComplianceChecker {
    return this.kycChecker;
  }

  getZkProver(): ZkComplianceProver {
    return this.zkProver;
  }
}

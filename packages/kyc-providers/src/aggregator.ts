import { KycLevel, Jurisdiction } from '@accredit/core';
import {
  ProviderAggregatorConfig,
  AggregateVerificationResult,
  ProviderVerificationResult,
} from './types';

export class ProviderAggregator {
  private readonly config: ProviderAggregatorConfig;

  constructor(config: ProviderAggregatorConfig) {
    if (config.providers.length === 0) {
      throw new Error('At least one provider is required');
    }
    this.config = config;
  }

  async verify(wallet: string): Promise<AggregateVerificationResult> {
    const settledResults = await Promise.allSettled(
      this.config.providers.map((p) => p.checkVerification(wallet)),
    );

    const results: ProviderVerificationResult[] = [];
    for (const settled of settledResults) {
      if (settled.status === 'fulfilled' && settled.value !== null) {
        results.push(settled.value);
      }
    }

    const verifiedResults = results.filter((r) => r.verified);

    switch (this.config.strategy) {
      case 'any':
        return this.applyAny(verifiedResults, results);
      case 'all':
        return this.applyAll(verifiedResults, results);
      case 'majority':
        return this.applyMajority(verifiedResults, results);
      case 'highest':
        return this.applyHighest(verifiedResults, results);
      default:
        return this.buildResult(false, results);
    }
  }

  private applyAny(
    verified: ProviderVerificationResult[],
    all: ProviderVerificationResult[],
  ): AggregateVerificationResult {
    if (verified.length > 0) {
      return this.buildResult(true, all, verified[0]);
    }
    return this.buildResult(false, all);
  }

  private applyAll(
    verified: ProviderVerificationResult[],
    all: ProviderVerificationResult[],
  ): AggregateVerificationResult {
    const allVerified =
      verified.length === this.config.providers.length &&
      verified.length > 0;
    if (allVerified) {
      // Use the lowest KYC level among all verified results
      const lowest = this.getLowestLevel(verified);
      return this.buildResult(true, all, lowest);
    }
    return this.buildResult(false, all);
  }

  private applyMajority(
    verified: ProviderVerificationResult[],
    all: ProviderVerificationResult[],
  ): AggregateVerificationResult {
    const threshold = this.config.minProviders
      ? this.config.minProviders
      : Math.ceil(this.config.providers.length / 2);

    if (verified.length >= threshold) {
      const lowest = this.getLowestLevel(verified);
      return this.buildResult(true, all, lowest);
    }
    return this.buildResult(false, all);
  }

  private applyHighest(
    verified: ProviderVerificationResult[],
    all: ProviderVerificationResult[],
  ): AggregateVerificationResult {
    if (verified.length === 0) {
      return this.buildResult(false, all);
    }
    const highest = this.getHighestLevel(verified);
    return this.buildResult(true, all, highest);
  }

  private getLowestLevel(
    results: ProviderVerificationResult[],
  ): ProviderVerificationResult {
    return results.reduce((min, r) =>
      r.kycLevel < min.kycLevel ? r : min,
    );
  }

  private getHighestLevel(
    results: ProviderVerificationResult[],
  ): ProviderVerificationResult {
    return results.reduce((max, r) =>
      r.kycLevel > max.kycLevel ? r : max,
    );
  }

  private buildResult(
    verified: boolean,
    results: ProviderVerificationResult[],
    representative?: ProviderVerificationResult,
  ): AggregateVerificationResult {
    return {
      verified,
      kycLevel: representative?.kycLevel ?? KycLevel.Basic,
      jurisdiction: representative?.jurisdiction ?? Jurisdiction.Other,
      results,
      strategy: this.config.strategy,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }
}

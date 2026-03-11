import type { WhitelistEntry } from '@accredit/core';
import type {
  ComplianceResult,
  BatchResult,
  ProviderInfo,
  WrapperConfig,
  PoolStatusResponse,
} from '../types';

export class AccreditAPI {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...options?.headers },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    return response.json();
  }

  async getKycEntry(wallet: string): Promise<WhitelistEntry | null> {
    try {
      return await this.request<WhitelistEntry>(`/kyc/entry/${wallet}`);
    } catch {
      return null;
    }
  }

  async checkCompliance(
    wallet: string,
    minKycLevel: number,
  ): Promise<ComplianceResult> {
    return this.request<ComplianceResult>('/kyc/check', {
      method: 'POST',
      body: JSON.stringify({ wallet, minKycLevel }),
    });
  }

  async batchCheckCompliance(wallets: string[]): Promise<BatchResult[]> {
    return this.request<BatchResult[]>('/kyc/batch-check', {
      method: 'POST',
      body: JSON.stringify({ wallets }),
    });
  }

  async getProviders(): Promise<ProviderInfo[]> {
    return this.request<ProviderInfo[]>('/providers');
  }

  async getWrapperConfigs(): Promise<WrapperConfig[]> {
    return this.request<WrapperConfig[]>('/wrappers');
  }

  async getPoolStatus(ammKey: string): Promise<PoolStatusResponse> {
    return this.request<PoolStatusResponse>(`/registry/pool/${ammKey}`);
  }
}

import { KycLevel, Jurisdiction } from '@accredit/core';
import {
  KycProvider,
  ProviderVerificationResult,
  VerificationSession,
  VerificationOptions,
} from '../types';

const DEFAULT_API_URL = 'https://developer.worldcoin.org';

interface WorldcoinVerifyResponse {
  success: boolean;
  nullifier_hash?: string;
  merkle_root?: string;
  proof?: string;
  credential_type?: string;
  action?: string;
  created_at?: string;
}

export class WorldcoinProvider implements KycProvider {
  readonly name = 'worldcoin';
  private readonly appId: string;
  private readonly actionId: string;
  private readonly apiUrl: string;

  constructor(appId: string, actionId: string, apiUrl?: string) {
    this.appId = appId;
    this.actionId = actionId;
    this.apiUrl = apiUrl ?? DEFAULT_API_URL;
  }

  async checkVerification(
    wallet: string,
  ): Promise<ProviderVerificationResult | null> {
    try {
      const url = `${this.apiUrl}/api/v1/verify/${this.appId}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: this.actionId,
          signal: wallet,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as WorldcoinVerifyResponse;

      if (!data.success) {
        return null;
      }

      const proofString = JSON.stringify({
        nullifier_hash: data.nullifier_hash,
        merkle_root: data.merkle_root,
        proof: data.proof,
        credential_type: data.credential_type,
      });
      const proofData = new TextEncoder().encode(proofString);

      return {
        verified: true,
        provider: this.name,
        kycLevel: KycLevel.Basic,
        jurisdiction: Jurisdiction.Other,
        providerUserId: data.nullifier_hash ?? wallet,
        proofData,
        expiresAt: 0, // World ID proofs do not expire
        metadata: {
          nullifierHash: data.nullifier_hash,
          merkleRoot: data.merkle_root,
          credentialType: data.credential_type,
          action: data.action,
        },
      };
    } catch {
      return null;
    }
  }

  async initiateVerification(
    wallet: string,
    _opts?: VerificationOptions,
  ): Promise<VerificationSession> {
    // World ID verification happens client-side via IDKit widget.
    // Return a session directing the user to the verification flow.
    const sessionId = `worldcoin-${Date.now()}-${wallet.slice(0, 8)}`;
    return {
      sessionId,
      provider: this.name,
      wallet,
      verificationUrl: `https://id.worldcoin.org/verify?app_id=${this.appId}&action=${this.actionId}&signal=${wallet}`,
      status: 'pending',
      expiresAt: Math.floor(Date.now() / 1000) + 600, // 10 minutes
    };
  }

  async validateProof(proofData: Uint8Array): Promise<boolean> {
    try {
      const proofString = new TextDecoder().decode(proofData);
      const proofObj = JSON.parse(proofString);

      if (
        !proofObj.nullifier_hash ||
        !proofObj.merkle_root ||
        !proofObj.proof
      ) {
        return false;
      }

      // Verify the proof against the Worldcoin API
      const url = `${this.apiUrl}/api/v1/verify/${this.appId}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nullifier_hash: proofObj.nullifier_hash,
          merkle_root: proofObj.merkle_root,
          proof: proofObj.proof,
          credential_type: proofObj.credential_type,
          action: this.actionId,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as WorldcoinVerifyResponse;
      return data.success === true;
    } catch {
      return false;
    }
  }

  mapToKycLevel(_providerTier: unknown): KycLevel {
    // World ID only proves personhood, not identity documents
    return KycLevel.Basic;
  }
}

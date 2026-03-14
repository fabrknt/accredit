/**
 * @fabrknt/accredit-sdk + @complr/sdk — Combined Compliance Flow Example
 *
 * Demonstrates the full compliance pipeline:
 * 1. Off-chain sanctions screening via @complr/sdk
 * 2. On-chain KYC whitelist verification via @fabrknt/accredit-sdk
 *
 * This two-layer pattern is used across RWA tokenization, stablecoin,
 * and securities platforms to satisfy both AML and KYC requirements.
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { KycClient, findWhitelistEntryPda, KycLevel } from '@fabrknt/accredit-sdk';
import { ComplrClient } from '@complr/sdk';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const connection = new Connection('https://api.devnet.solana.com');
const programId = new PublicKey('AccrFMBAPz2yCmL4mw6JfMtJRm2P43kJhXAJDBhnZoR');

const complr = new ComplrClient({
  apiKey: process.env.COMPLR_API_KEY || '',
});

// ---------------------------------------------------------------------------
// Combined compliance check
// ---------------------------------------------------------------------------

async function fullComplianceCheck(walletAddress: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const wallet = new PublicKey(walletAddress);

  // Step 1: Off-chain sanctions screening
  const screening = await complr.screenWallet(walletAddress, 'solana');
  if (screening.sanctions) {
    return { allowed: false, reason: 'Sanctions match detected' };
  }
  if (screening.riskLevel === 'critical' || screening.riskLevel === 'high') {
    return { allowed: false, reason: `High risk: ${screening.flags.join(', ')}` };
  }

  // Step 2: On-chain KYC verification
  const kycClient = new KycClient(connection, programId);
  const entry = await kycClient.getWhitelistEntry(wallet);

  if (!entry) {
    return { allowed: false, reason: 'No on-chain KYC credential found' };
  }

  if (entry.kycLevel < KycLevel.Enhanced) {
    return { allowed: false, reason: 'Minimum KYC level not met (need Enhanced)' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (entry.expiresAt <= now) {
    return { allowed: false, reason: 'KYC credential expired' };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

async function main() {
  const wallet = 'InvestorWa11et111111111111111111111111111111';
  const result = await fullComplianceCheck(wallet);

  if (result.allowed) {
    console.log('Wallet cleared — proceeding with transaction');
  } else {
    console.log('Wallet blocked:', result.reason);
  }
}

main().catch(console.error);

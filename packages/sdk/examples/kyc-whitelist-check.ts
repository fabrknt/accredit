/**
 * @fabrknt/accredit-sdk — KYC Whitelist Check Example
 *
 * Demonstrates looking up on-chain KYC whitelist entries and checking
 * whether a wallet meets the minimum requirements for a given
 * security or pool.
 */
import { Connection, PublicKey } from '@solana/web3.js';
import {
  KycClient,
  findWhitelistEntryPda,
  findKycRegistryPda,
  KycLevel,
  Jurisdiction,
} from '@fabrknt/accredit-sdk';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const connection = new Connection('https://api.devnet.solana.com');
const programId = new PublicKey('AccrFMBAPz2yCmL4mw6JfMtJRm2P43kJhXAJDBhnZoR');

// ---------------------------------------------------------------------------
// 1. Derive PDAs for a wallet
// ---------------------------------------------------------------------------

const walletAddress = new PublicKey('InvestorWa11et111111111111111111111111111111');

const [registryPda] = findKycRegistryPda(programId);
const [whitelistPda] = findWhitelistEntryPda(walletAddress, programId);

console.log('Registry PDA:  ', registryPda.toBase58());
console.log('Whitelist PDA: ', whitelistPda.toBase58());

// ---------------------------------------------------------------------------
// 2. Check KYC status
// ---------------------------------------------------------------------------

async function checkKycStatus(wallet: PublicKey) {
  const client = new KycClient(connection, programId);

  // Fetch the on-chain whitelist entry (returns null if not found)
  const entry = await client.getWhitelistEntry(wallet);

  if (!entry) {
    console.log('Wallet not KYC-verified');
    return false;
  }

  console.log('KYC Level:', KycLevel[entry.kycLevel]);
  console.log('Jurisdiction:', Jurisdiction[entry.jurisdiction]);
  console.log('Expires at:', new Date(entry.expiresAt * 1000).toISOString());

  // Check minimum requirements for a specific pool
  const meetsLevel = entry.kycLevel >= KycLevel.Enhanced;
  const isAllowedJurisdiction = [Jurisdiction.JP, Jurisdiction.SG].includes(
    entry.jurisdiction,
  );
  const isNotExpired = entry.expiresAt > Math.floor(Date.now() / 1000);

  const eligible = meetsLevel && isAllowedJurisdiction && isNotExpired;
  console.log('Eligible for pool:', eligible);

  return eligible;
}

checkKycStatus(walletAddress).catch(console.error);

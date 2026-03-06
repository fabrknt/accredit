import { Connection, PublicKey, AccountInfo } from '@solana/web3.js';

// Placeholder — will be replaced with the actual deployed program ID
const SOVEREIGN_PROGRAM_ID = new PublicKey(
  process.env.SOVEREIGN_PROGRAM_ID || '11111111111111111111111111111111'
);

/**
 * SOVEREIGN identity account binary layout (236 bytes):
 *
 * Offset  Size  Field
 * ------  ----  -----
 *   0       8   discriminator (Anchor-style, 8 bytes)
 *   8      32   owner (Pubkey)
 *  40       8   created_at (i64 LE, unix timestamp)
 *  48      32   authority_trading (Pubkey)
 *  80      32   authority_civic (Pubkey)
 * 112      32   authority_developer (Pubkey)
 * 144      32   authority_infra (Pubkey)
 * 176      32   authority_creator (Pubkey)
 * 208       2   score_trading (u16 LE, 0-10000 basis points)
 * 210       2   score_civic (u16 LE)
 * 212       2   score_developer (u16 LE)
 * 214       2   score_infra (u16 LE)
 * 216       2   score_creator (u16 LE)
 * 218       2   composite (u16 LE)
 * 220       1   tier (u8: 1=Bronze, 2=Silver, 3=Gold, 4=Platinum, 5=Diamond)
 * 221       8   last_updated (i64 LE, unix timestamp)
 * 229       1   bump (u8)
 * 230       6   _padding (reserved)
 * ------  ----
 * Total: 236 bytes
 */

const IDENTITY_ACCOUNT_SIZE = 236;

export interface SovereignScores {
  trading: number;
  civic: number;
  developer: number;
  infra: number;
  creator: number;
}

export interface SovereignIdentity {
  owner: string;
  createdAt: number;
  scores: SovereignScores;
  composite: number;
  tier: number;
  tierName: string;
  lastUpdated: number;
  bump: number;
  confidence: string;
}

/**
 * Derive the PDA for a SOVEREIGN identity account.
 * Seeds: ["identity", owner_pubkey]
 */
export function getIdentityPda(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('identity'), owner.toBuffer()],
    SOVEREIGN_PROGRAM_ID,
  );
}

/**
 * Map tier number to human-readable name.
 */
export function getTierName(tier: number): string {
  switch (tier) {
    case 1: return 'Bronze';
    case 2: return 'Silver';
    case 3: return 'Gold';
    case 4: return 'Platinum';
    case 5: return 'Diamond';
    default: return 'Unknown';
  }
}

/**
 * Derive confidence level from tier.
 */
export function getConfidence(tier: number): string {
  switch (tier) {
    case 5: return 'high';    // Diamond
    case 4: return 'high';    // Platinum
    case 3: return 'medium';  // Gold
    case 2: return 'low';     // Silver
    case 1: return 'none';    // Bronze
    default: return 'none';
  }
}

/**
 * Parse a raw SOVEREIGN identity account buffer into a structured object.
 */
function parseIdentityAccount(data: Buffer): SovereignIdentity | null {
  if (data.length < IDENTITY_ACCOUNT_SIZE) {
    return null;
  }

  const owner = new PublicKey(data.subarray(8, 40)).toBase58();
  const createdAt = Number(data.readBigInt64LE(40));

  // Skip authorities (48..208), read dimension scores
  const trading = data.readUInt16LE(208);
  const civic = data.readUInt16LE(210);
  const developer = data.readUInt16LE(212);
  const infra = data.readUInt16LE(214);
  const creator = data.readUInt16LE(216);
  const composite = data.readUInt16LE(218);
  const tier = data.readUInt8(220);
  const lastUpdated = Number(data.readBigInt64LE(221));
  const bump = data.readUInt8(229);

  const tierName = getTierName(tier);
  const confidence = getConfidence(tier);

  return {
    owner,
    createdAt,
    scores: { trading, civic, developer, infra, creator },
    composite,
    tier,
    tierName,
    lastUpdated,
    bump,
    confidence,
  };
}

/**
 * Read a single SOVEREIGN identity account from on-chain data.
 */
export async function readIdentity(
  connection: Connection,
  ownerBase58: string,
): Promise<SovereignIdentity | null> {
  let ownerPubkey: PublicKey;
  try {
    ownerPubkey = new PublicKey(ownerBase58);
  } catch {
    return null;
  }

  const [pda] = getIdentityPda(ownerPubkey);
  const accountInfo: AccountInfo<Buffer> | null = await connection.getAccountInfo(pda);

  if (!accountInfo || !accountInfo.data) {
    return null;
  }

  return parseIdentityAccount(accountInfo.data);
}

/**
 * Batch-read SOVEREIGN identity accounts using getMultipleAccountsInfo.
 * Processes in chunks of 100 (Solana RPC limit).
 */
export async function batchReadIdentities(
  connection: Connection,
  owners: string[],
): Promise<Map<string, SovereignIdentity | null>> {
  const results = new Map<string, SovereignIdentity | null>();

  // Resolve all PDAs
  const entries: Array<{ owner: string; pda: PublicKey }> = [];
  for (const ownerBase58 of owners) {
    try {
      const ownerPubkey = new PublicKey(ownerBase58);
      const [pda] = getIdentityPda(ownerPubkey);
      entries.push({ owner: ownerBase58, pda });
    } catch {
      results.set(ownerBase58, null);
    }
  }

  // Process in chunks of 100
  const CHUNK_SIZE = 100;
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    const pdas = chunk.map((e) => e.pda);
    const accounts = await connection.getMultipleAccountsInfo(pdas);

    for (let j = 0; j < chunk.length; j++) {
      const accountInfo = accounts[j];
      if (accountInfo && accountInfo.data) {
        results.set(chunk[j].owner, parseIdentityAccount(accountInfo.data as Buffer));
      } else {
        results.set(chunk[j].owner, null);
      }
    }
  }

  return results;
}

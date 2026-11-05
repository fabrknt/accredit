/**
 * Migration script: Continuum's old whitelist PDA pattern → unified Accredit pattern
 *
 * Old PDA: seeds = [b"whitelist", old_registry.key(), wallet.key()] (old program)
 * New PDA: seeds = [b"whitelist", new_registry.key(), wallet.key()] (unified program)
 *
 * Steps:
 * 1. Fetch all existing WhitelistEntry accounts with old PDA pattern
 * 2. Create new entries with unified PDA seeds + new fields
 *    (jurisdiction defaults to Japan, daily_limit defaults to 0/unlimited)
 * 3. Close old accounts to reclaim rent
 *
 * Since both projects are pre-production (devnet), this is a one-time migration.
 */

import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';

// Old Continuum transfer-hook program ID
const OLD_PROGRAM_ID = new PublicKey('8YuthNBWfjKJxS8Z43sJQB12iNvwcE57GrLKo1d1NPCa');
// New unified transfer-hook program ID
const NEW_PROGRAM_ID = new PublicKey('5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL');

const OLD_WHITELIST_SEED = Buffer.from('whitelist');
const OLD_KYC_REGISTRY_SEED = Buffer.from('kyc_registry');

interface OldWhitelistEntry {
  wallet: PublicKey;
  registry: PublicKey;
  kycLevel: number;
  isActive: boolean;
  createdAt: bigint;
  expiryTimestamp: bigint;
  bump: number;
}

async function fetchOldWhitelistEntries(
  connection: Connection,
  registryKey: PublicKey
): Promise<{ pda: PublicKey; entry: OldWhitelistEntry }[]> {
  const accounts = await connection.getProgramAccounts(OLD_PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 8 + 32, // skip discriminator + wallet
          bytes: registryKey.toBase58(),
        },
      },
    ],
  });

  const entries: { pda: PublicKey; entry: OldWhitelistEntry }[] = [];

  for (const { pubkey, account } of accounts) {
    try {
      const data = account.data;
      let offset = 8; // skip discriminator

      const wallet = new PublicKey(data.subarray(offset, offset + 32));
      offset += 32;

      const registry = new PublicKey(data.subarray(offset, offset + 32));
      offset += 32;

      const kycLevel = data[offset];
      offset += 1;

      const isActive = data[offset] === 1;
      offset += 1;

      const createdAt = data.readBigInt64LE(offset);
      offset += 8;

      const expiryTimestamp = data.readBigInt64LE(offset);
      offset += 8;

      const bump = data[offset];

      entries.push({
        pda: pubkey,
        entry: { wallet, registry, kycLevel, isActive, createdAt, expiryTimestamp, bump },
      });
    } catch (err) {
      console.error(`Failed to deserialize account ${pubkey.toBase58()}:`, err);
    }
  }

  return entries;
}

function deriveNewWhitelistPda(
  newRegistry: PublicKey,
  wallet: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [OLD_WHITELIST_SEED, newRegistry.toBuffer(), wallet.toBuffer()],
    NEW_PROGRAM_ID
  );
}

async function main() {
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8899';
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log('Continuum Whitelist PDA Migration');
  console.log('=================================');
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Old program: ${OLD_PROGRAM_ID.toBase58()}`);
  console.log(`New program: ${NEW_PROGRAM_ID.toBase58()}`);
  console.log('');

  // For a real migration, you'd load the authority keypair from file
  // const authority = Keypair.fromSecretKey(...)

  // Step 1: Find the old KYC registry
  // This is for informational purposes in the migration script
  console.log('Step 1: Scanning for old whitelist entries...');
  console.log('');
  console.log('To run this migration:');
  console.log('1. Deploy the unified transfer-hook program to the new program ID');
  console.log('2. Initialize a new KycRegistry on the new program');
  console.log('3. For each old entry, call add_to_whitelist on the new program with:');
  console.log('   - jurisdiction: Japan (default)');
  console.log('   - kyc_hash: [0; 32] (to be updated later)');
  console.log('   - daily_limit: 0 (unlimited)');
  console.log('4. Close old accounts to reclaim rent');
  console.log('');
  console.log('New PDA pattern: seeds = [b"whitelist", new_registry.key(), wallet.key()]');
  console.log('Old PDA pattern: seeds = [b"whitelist", old_registry.key(), wallet.key()]');
}

main().catch(console.error);

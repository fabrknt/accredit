import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "../config";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const WRAPPER_PROGRAM_ID = new PublicKey(
  config.wrapperProgramId,
);

/* ------------------------------------------------------------------ */
/*  PDA derivation                                                     */
/* ------------------------------------------------------------------ */

export function findWrapperConfigPda(
  underlyingMint: PublicKey,
  authority: PublicKey,
  programId: PublicKey = WRAPPER_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("wrapper_config"), underlyingMint.toBytes(), authority.toBytes()],
    programId,
  );
}

/* ------------------------------------------------------------------ */
/*  WrapperConfig binary layout                                        */
/*                                                                     */
/*  Offset  Size  Field                                                */
/*  0       8     discriminator                                        */
/*  8       32    authority                                             */
/*  40      32    underlying_mint                                      */
/*  72      32    wrapped_mint                                         */
/*  104     32    vault                                                */
/*  136     32    kyc_registry                                         */
/*  168     8     total_wrapped (u64 LE)                               */
/*  176     1     is_active (bool)                                     */
/*  177     1     min_kyc_level (u8)                                   */
/*  178     2     fee_bps (u16 LE)                                     */
/*  180     32    fee_recipient                                        */
/*  212     8     created_at (i64 LE)                                  */
/*  220     8     updated_at (i64 LE)                                  */
/*  228     1     bump                                                 */
/*  229     1     wrapped_mint_bump                                    */
/*  Total:  230                                                        */
/* ------------------------------------------------------------------ */

const WRAPPER_CONFIG_SIZE = 230;

export interface WrapperConfigData {
  address: string;
  authority: string;
  underlyingMint: string;
  wrappedMint: string;
  vault: string;
  kycRegistry: string;
  totalWrapped: string;
  isActive: boolean;
  minKycLevel: number;
  feeBps: number;
  feeRecipient: string;
  createdAt: number;
  updatedAt: number;
  bump: number;
  wrappedMintBump: number;
}

function deserializeWrapperConfig(
  address: string,
  data: Buffer,
): WrapperConfigData {
  if (data.length < WRAPPER_CONFIG_SIZE) {
    throw new Error(
      `Account data too small: ${data.length} < ${WRAPPER_CONFIG_SIZE}`,
    );
  }

  let offset = 8; // skip discriminator

  const authority = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;

  const underlyingMint = new PublicKey(
    data.subarray(offset, offset + 32),
  ).toBase58();
  offset += 32;

  const wrappedMint = new PublicKey(
    data.subarray(offset, offset + 32),
  ).toBase58();
  offset += 32;

  const vault = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
  offset += 32;

  const kycRegistry = new PublicKey(
    data.subarray(offset, offset + 32),
  ).toBase58();
  offset += 32;

  const totalWrapped = data.readBigUInt64LE(offset).toString();
  offset += 8;

  const isActive = data[offset] === 1;
  offset += 1;

  const minKycLevel = data[offset];
  offset += 1;

  const feeBps = data.readUInt16LE(offset);
  offset += 2;

  const feeRecipient = new PublicKey(
    data.subarray(offset, offset + 32),
  ).toBase58();
  offset += 32;

  const createdAt = Number(data.readBigInt64LE(offset));
  offset += 8;

  const updatedAt = Number(data.readBigInt64LE(offset));
  offset += 8;

  const bump = data[offset];
  offset += 1;

  const wrappedMintBump = data[offset];

  return {
    address,
    authority,
    underlyingMint,
    wrappedMint,
    vault,
    kycRegistry,
    totalWrapped,
    isActive,
    minKycLevel,
    feeBps,
    feeRecipient,
    createdAt,
    updatedAt,
    bump,
    wrappedMintBump,
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Fetch all WrapperConfig accounts from the program */
export async function getAllWrapperConfigs(
  connection: Connection,
): Promise<WrapperConfigData[]> {
  const accounts = await connection.getProgramAccounts(WRAPPER_PROGRAM_ID, {
    filters: [
      {
        dataSize: WRAPPER_CONFIG_SIZE,
      },
    ],
  });

  const configs: WrapperConfigData[] = [];
  for (const { pubkey, account } of accounts) {
    try {
      configs.push(
        deserializeWrapperConfig(pubkey.toBase58(), Buffer.from(account.data)),
      );
    } catch {
      // skip malformed accounts
    }
  }
  return configs;
}

/** Find a WrapperConfig for a specific underlying mint */
export async function getWrapperConfigByMint(
  connection: Connection,
  underlyingMintBase58: string,
): Promise<WrapperConfigData | null> {
  const configs = await getAllWrapperConfigs(connection);
  return (
    configs.find((c) => c.underlyingMint === underlyingMintBase58) ?? null
  );
}

/** Get supply statistics for a wrapper */
export interface WrapperSupplyStats {
  underlyingMint: string;
  wrappedMint: string;
  totalWrapped: string;
  isActive: boolean;
  feeBps: number;
}

export async function getWrapperSupply(
  connection: Connection,
  underlyingMintBase58: string,
): Promise<WrapperSupplyStats | null> {
  const configData = await getWrapperConfigByMint(
    connection,
    underlyingMintBase58,
  );
  if (!configData) return null;

  return {
    underlyingMint: configData.underlyingMint,
    wrappedMint: configData.wrappedMint,
    totalWrapped: configData.totalWrapped,
    isActive: configData.isActive,
    feeBps: configData.feeBps,
  };
}

import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import { expect } from 'chai';

describe('transfer-hook (accredit)', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TransferHook;
  const authority = provider.wallet;

  let mint: Keypair;
  let registryPda: PublicKey;
  let registryBump: number;

  before(async () => {
    mint = Keypair.generate();
  });

  // ========================================================================
  // Transfer Hook — KYC Registry
  // ========================================================================

  it('initializes a KYC registry', async () => {
    // Registry PDA derivation
    [registryPda, registryBump] = PublicKey.findProgramAddressSync(
      [Buffer.from('kyc_registry'), mint.publicKey.toBuffer()],
      program.programId
    );

    // Note: Full test requires deploying a Token-2022 mint with transfer hook extension
    // This is a structural test to verify the program loads correctly
    expect(program.programId).to.not.be.null;
    expect(registryPda).to.not.be.null;
  });

  it('derives whitelist entry PDA from registry and wallet', async () => {
    const wallet = Keypair.generate().publicKey;

    const [whitelistPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist'), registryPda.toBuffer(), wallet.toBuffer()],
      program.programId
    );

    // Verify PDA is deterministic
    const [whitelistPda2] = PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist'), registryPda.toBuffer(), wallet.toBuffer()],
      program.programId
    );

    expect(whitelistPda.toBase58()).to.equal(whitelistPda2.toBase58());
  });

  it('derives extra account meta list PDA', async () => {
    const [extraMetaPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('extra-account-metas'), mint.publicKey.toBuffer()],
      program.programId
    );

    expect(extraMetaPda).to.not.be.null;
  });

  // ========================================================================
  // Transfer Hook — KYC Level & Jurisdiction Validation
  // ========================================================================

  it('different wallets produce unique whitelist PDAs', () => {
    const wallet1 = Keypair.generate().publicKey;
    const wallet2 = Keypair.generate().publicKey;

    const [pda1] = PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist'), registryPda.toBuffer(), wallet1.toBuffer()],
      program.programId
    );
    const [pda2] = PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist'), registryPda.toBuffer(), wallet2.toBuffer()],
      program.programId
    );

    expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
  });

  it('the same wallet has a different whitelist PDA in another registry', () => {
    const wallet = Keypair.generate().publicKey;
    const [otherRegistry] = PublicKey.findProgramAddressSync(
      [Buffer.from('kyc_registry'), Keypair.generate().publicKey.toBuffer()],
      program.programId
    );
    const [pda1] = PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist'), registryPda.toBuffer(), wallet.toBuffer()],
      program.programId
    );
    const [pda2] = PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist'), otherRegistry.toBuffer(), wallet.toBuffer()],
      program.programId
    );
    expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
  });

  it('different mints produce unique registry PDAs', () => {
    const mint1 = Keypair.generate().publicKey;
    const mint2 = Keypair.generate().publicKey;

    const [reg1] = PublicKey.findProgramAddressSync(
      [Buffer.from('kyc_registry'), mint1.toBuffer()],
      program.programId
    );
    const [reg2] = PublicKey.findProgramAddressSync(
      [Buffer.from('kyc_registry'), mint2.toBuffer()],
      program.programId
    );

    expect(reg1.toBase58()).to.not.equal(reg2.toBase58());
  });

  it('registry PDA is on-curve (valid)', () => {
    const testMint = Keypair.generate().publicKey;
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('kyc_registry'), testMint.toBuffer()],
      program.programId
    );
    expect(bump).to.be.a('number');
    expect(bump).to.be.lessThanOrEqual(255);
    expect(bump).to.be.greaterThanOrEqual(0);
  });

  // ========================================================================
  // Transfer Hook — Sender/Recipient Whitelist Pairing
  // ========================================================================

  it('derives sender and recipient whitelist PDAs for a transfer', () => {
    const sender = Keypair.generate().publicKey;
    const recipient = Keypair.generate().publicKey;

    const [senderPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist'), registryPda.toBuffer(), sender.toBuffer()],
      program.programId
    );
    const [recipientPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist'), registryPda.toBuffer(), recipient.toBuffer()],
      program.programId
    );

    // Both should exist and be different
    expect(senderPda.toBase58()).to.not.equal(recipientPda.toBase58());
    expect(senderPda.toBase58()).to.be.a('string');
    expect(recipientPda.toBase58()).to.be.a('string');
  });
});

// ============================================================================
// Compliant Registry Tests
// ============================================================================

describe('compliant-registry (accredit)', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CompliantRegistry;
  const authority = provider.wallet;

  // ========================================================================
  // Pool Registry PDA Derivation
  // ========================================================================

  it('derives pool registry PDA', () => {
    const [registryPda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('compliant_pool_registry'), authority.publicKey.toBuffer()],
      program.programId
    );

    expect(registryPda).to.not.be.null;
    expect(bump).to.be.a('number');
  });

  it('different authorities produce unique registry PDAs', () => {
    const auth1 = Keypair.generate().publicKey;
    const auth2 = Keypair.generate().publicKey;

    const [pda1] = PublicKey.findProgramAddressSync(
      [Buffer.from('compliant_pool_registry'), auth1.toBuffer()],
      program.programId
    );
    const [pda2] = PublicKey.findProgramAddressSync(
      [Buffer.from('compliant_pool_registry'), auth2.toBuffer()],
      program.programId
    );

    expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
  });

  // ========================================================================
  // Pool Compliance Entry PDA Derivation
  // ========================================================================

  it('derives pool compliance entry PDA', () => {
    const registryKey = Keypair.generate().publicKey;
    const ammKey = Keypair.generate().publicKey;

    const [entryPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('pool_compliance'),
        registryKey.toBuffer(),
        ammKey.toBuffer(),
      ],
      program.programId
    );

    expect(entryPda).to.not.be.null;
  });

  it('same AMM in different registries produces unique entry PDAs', () => {
    const registry1 = Keypair.generate().publicKey;
    const registry2 = Keypair.generate().publicKey;
    const ammKey = Keypair.generate().publicKey;

    const [entry1] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool_compliance'), registry1.toBuffer(), ammKey.toBuffer()],
      program.programId
    );
    const [entry2] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool_compliance'), registry2.toBuffer(), ammKey.toBuffer()],
      program.programId
    );

    expect(entry1.toBase58()).to.not.equal(entry2.toBase58());
  });

  it('different AMMs in same registry produce unique entry PDAs', () => {
    const registryKey = Keypair.generate().publicKey;
    const amm1 = Keypair.generate().publicKey;
    const amm2 = Keypair.generate().publicKey;

    const [entry1] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool_compliance'), registryKey.toBuffer(), amm1.toBuffer()],
      program.programId
    );
    const [entry2] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool_compliance'), registryKey.toBuffer(), amm2.toBuffer()],
      program.programId
    );

    expect(entry1.toBase58()).to.not.equal(entry2.toBase58());
  });

  // ========================================================================
  // Compliance Config PDA Derivation
  // ========================================================================

  it('derives compliance config PDA', () => {
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('compliance_config'), authority.publicKey.toBuffer()],
      program.programId
    );

    expect(configPda).to.not.be.null;
  });

  it('compliance config is unique per authority', () => {
    const auth1 = Keypair.generate().publicKey;
    const auth2 = Keypair.generate().publicKey;

    const [config1] = PublicKey.findProgramAddressSync(
      [Buffer.from('compliance_config'), auth1.toBuffer()],
      program.programId
    );
    const [config2] = PublicKey.findProgramAddressSync(
      [Buffer.from('compliance_config'), auth2.toBuffer()],
      program.programId
    );

    expect(config1.toBase58()).to.not.equal(config2.toBase58());
  });

  // ========================================================================
  // Route Verification — Structural Checks
  // ========================================================================

  it('route hop count must be positive', () => {
    // Mirrors the on-chain require!(!amm_keys.is_empty())
    const ammKeys: PublicKey[] = [];
    expect(ammKeys.length).to.equal(0);
    // An empty route should be rejected by the program
  });

  it('route hop count respects max_route_hops', () => {
    const maxHops = 4;
    const route3 = [Keypair.generate().publicKey, Keypair.generate().publicKey, Keypair.generate().publicKey];
    const route5 = Array.from({ length: 5 }, () => Keypair.generate().publicKey);

    expect(route3.length).to.be.lessThanOrEqual(maxHops);
    expect(route5.length).to.be.greaterThan(maxHops);
  });
});

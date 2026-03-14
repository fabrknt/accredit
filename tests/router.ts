import { PublicKey, Keypair } from '@solana/web3.js';
import { expect } from 'chai';
import {
  findKycRegistryPda,
  findWhitelistEntryPda,
  findPoolRegistryPda,
  findPoolEntryPda,
  findComplianceConfigPda,
} from '../packages/sdk/src/pda';

const TRANSFER_HOOK_PROGRAM_ID = new PublicKey('5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL');
const REGISTRY_PROGRAM_ID = new PublicKey('66tKcQqpv8GH2igWWBcLVrTjvo8cgpVJJAE8xadAgnYA');

describe('@fabrknt/accredit-sdk PDA helpers', () => {
  it('derives KYC registry PDA', () => {
    const mint = Keypair.generate().publicKey;
    const [pda, bump] = findKycRegistryPda(mint, TRANSFER_HOOK_PROGRAM_ID);
    expect(pda.toBase58()).to.be.a('string');
    expect(bump).to.be.a('number');
  });

  it('derives whitelist entry PDA (unified: wallet only)', () => {
    const wallet = Keypair.generate().publicKey;
    const [pda, bump] = findWhitelistEntryPda(wallet, TRANSFER_HOOK_PROGRAM_ID);
    expect(pda.toBase58()).to.be.a('string');
    expect(bump).to.be.a('number');

    // Same wallet always produces same PDA
    const [pda2] = findWhitelistEntryPda(wallet, TRANSFER_HOOK_PROGRAM_ID);
    expect(pda.toBase58()).to.equal(pda2.toBase58());
  });

  it('derives pool registry PDA', () => {
    const authority = Keypair.generate().publicKey;
    const [pda, bump] = findPoolRegistryPda(authority, REGISTRY_PROGRAM_ID);
    expect(pda.toBase58()).to.be.a('string');
    expect(bump).to.be.a('number');
  });

  it('derives pool entry PDA', () => {
    const registry = Keypair.generate().publicKey;
    const ammKey = Keypair.generate().publicKey;
    const [pda, bump] = findPoolEntryPda(registry, ammKey, REGISTRY_PROGRAM_ID);
    expect(pda.toBase58()).to.be.a('string');
    expect(bump).to.be.a('number');
  });

  it('derives compliance config PDA', () => {
    const authority = Keypair.generate().publicKey;
    const [pda, bump] = findComplianceConfigPda(authority, REGISTRY_PROGRAM_ID);
    expect(pda.toBase58()).to.be.a('string');
    expect(bump).to.be.a('number');
  });
});

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

  it('derives whitelist entry PDA (per registry and wallet)', () => {
    const wallet = Keypair.generate().publicKey;
    const [registry] = findKycRegistryPda(Keypair.generate().publicKey, TRANSFER_HOOK_PROGRAM_ID);
    const [pda, bump] = findWhitelistEntryPda(registry, wallet, TRANSFER_HOOK_PROGRAM_ID);
    expect(pda.toBase58()).to.be.a('string');
    expect(bump).to.be.a('number');

    // Same registry and wallet always produce the same PDA
    const [pda2] = findWhitelistEntryPda(registry, wallet, TRANSFER_HOOK_PROGRAM_ID);
    expect(pda.toBase58()).to.equal(pda2.toBase58());

    // The same wallet in another registry has a different PDA
    const [otherRegistry] = findKycRegistryPda(Keypair.generate().publicKey, TRANSFER_HOOK_PROGRAM_ID);
    const [pda3] = findWhitelistEntryPda(otherRegistry, wallet, TRANSFER_HOOK_PROGRAM_ID);
    expect(pda3.toBase58()).to.not.equal(pda.toBase58());
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

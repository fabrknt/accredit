//! Real Token-2022 `transfer_checked` calls through the transfer-hook program.
//!
//! Instructions for the hook are assembled from raw bytes (Anchor
//! discriminator + Borsh), so this crate shares no code with the program.
//! Build the program first: `cargo build-sbf --manifest-path
//! programs/transfer-hook/Cargo.toml`.

use litesvm::LiteSVM;
use sha2::{Digest, Sha256};
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_message::Message;
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use solana_transaction::Transaction;
use spl_associated_token_account_interface::{
    address::get_associated_token_address_with_program_id,
    instruction::create_associated_token_account,
};
use spl_token_2022_interface::{
    extension::{transfer_hook, ExtensionType},
    instruction as token_ix,
    state::Mint,
    ID as TOKEN_2022,
};

const HOOK: Pubkey = Pubkey::from_str_const("5DLH2UrDD5bJFadn1gV1rof6sJ7MzJbVNnUfVMtGJgSL");
const SYSTEM: Pubkey = Pubkey::from_str_const("11111111111111111111111111111111");
const DECIMALS: u8 = 6;

// TransferHookError codes (6000 + variant index).
const ERR_UNAUTHORIZED: u32 = 6000;
const ERR_SENDER_BLACKLISTED: u32 = 6010;
const ERR_RECIPIENT_BLACKLISTED: u32 = 6011;
const ERR_NOT_TRANSFERRING: u32 = 6018;
const ERR_ENTRY_NOT_ACTIVE: u32 = 6020;
// Anchor: AccountNotInitialized, InstructionFallbackNotFound.
const ERR_ACCOUNT_NOT_INITIALIZED: u32 = 3012;
const ERR_FALLBACK_NOT_FOUND: u32 = 101;

fn anchor_disc(name: &str) -> [u8; 8] {
    let h = Sha256::digest(format!("global:{name}").as_bytes());
    h[..8].try_into().unwrap()
}

fn execute_disc() -> [u8; 8] {
    let h = Sha256::digest(b"spl-transfer-hook-interface:execute");
    h[..8].try_into().unwrap()
}

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &HOOK).0
}

struct Env {
    svm: LiteSVM,
    payer: Keypair,
    mint: Pubkey,
    registry: Pubkey,
    meta_list: Pubkey,
}

impl Env {
    fn send(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> Result<(), String> {
        self.svm.expire_blockhash();
        let mut all: Vec<&Keypair> = vec![&self.payer];
        all.extend_from_slice(signers);
        let msg = Message::new(ixs, Some(&self.payer.pubkey()));
        let tx = Transaction::new(&all, msg, self.svm.latest_blockhash());
        self.svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|e| format!("{:?} {:#?}", e.err, e.meta.logs))
    }

    fn whitelist(&self, wallet: &Pubkey) -> Pubkey {
        pda(&[b"whitelist", self.registry.as_ref(), wallet.as_ref()])
    }

    fn blacklist(&self, wallet: &Pubkey) -> Pubkey {
        pda(&[b"blacklist", self.registry.as_ref(), wallet.as_ref()])
    }

    fn ata(&self, wallet: &Pubkey) -> Pubkey {
        get_associated_token_address_with_program_id(wallet, &self.mint, &TOKEN_2022)
    }

    fn new_wallet(&mut self, mint_amount: u64) -> Keypair {
        let kp = Keypair::new();
        self.svm.airdrop(&kp.pubkey(), 1_000_000_000).unwrap();
        let create = create_associated_token_account(
            &self.payer.pubkey(),
            &kp.pubkey(),
            &self.mint,
            &TOKEN_2022,
        );
        let mut ixs = vec![create];
        if mint_amount > 0 {
            ixs.push(
                token_ix::mint_to(
                    &TOKEN_2022,
                    &self.mint,
                    &self.ata(&kp.pubkey()),
                    &self.payer.pubkey(),
                    &[],
                    mint_amount,
                )
                .unwrap(),
            );
        }
        self.send(&ixs, &[]).unwrap();
        kp
    }

    fn add_to_whitelist_ix(&self, wallet: &Pubkey) -> Instruction {
        let mut data = anchor_disc("add_to_whitelist").to_vec();
        data.extend_from_slice(wallet.as_ref());
        data.push(0); // KycLevel::Basic
        data.push(0); // Jurisdiction::Japan
        data.extend_from_slice(&[7u8; 32]); // kyc_hash
        data.extend_from_slice(&0u64.to_le_bytes()); // daily_limit (0 = level default)
        data.extend_from_slice(&0i64.to_le_bytes()); // expiry (0 = none)
        Instruction {
            program_id: HOOK,
            accounts: vec![
                AccountMeta::new(self.payer.pubkey(), true),
                AccountMeta::new(self.registry, false),
                AccountMeta::new(self.whitelist(wallet), false),
                AccountMeta::new_readonly(SYSTEM, false),
            ],
            data,
        }
    }

    fn remove_from_whitelist_ix(&self, wallet: &Pubkey) -> Instruction {
        Instruction {
            program_id: HOOK,
            accounts: vec![
                AccountMeta::new_readonly(self.payer.pubkey(), true),
                AccountMeta::new(self.registry, false),
                AccountMeta::new(self.whitelist(wallet), false),
            ],
            data: anchor_disc("remove_from_whitelist").to_vec(),
        }
    }

    fn add_to_blacklist_ix(&self, wallet: &Pubkey) -> Instruction {
        let reason = b"test";
        let mut data = anchor_disc("add_to_blacklist").to_vec();
        data.extend_from_slice(wallet.as_ref());
        data.extend_from_slice(&(reason.len() as u32).to_le_bytes());
        data.extend_from_slice(reason);
        Instruction {
            program_id: HOOK,
            accounts: vec![
                AccountMeta::new(self.payer.pubkey(), true),
                AccountMeta::new(self.registry, false),
                AccountMeta::new(self.blacklist(wallet), false),
                AccountMeta::new_readonly(SYSTEM, false),
            ],
            data,
        }
    }

    /// The accounts the hook's ExtraAccountMeta list should resolve to, in
    /// list order, with the expected writability.
    fn extra_metas(&self, from: &Pubkey, to: &Pubkey) -> Vec<AccountMeta> {
        vec![
            AccountMeta::new_readonly(self.registry, false),
            AccountMeta::new(self.whitelist(from), false),
            AccountMeta::new_readonly(self.whitelist(to), false),
            AccountMeta::new_readonly(self.blacklist(from), false),
            AccountMeta::new_readonly(self.blacklist(to), false),
        ]
    }

    /// Token-2022 transfer_checked with the hook's extra accounts appended.
    /// Token-2022 resolves the ExtraAccountMeta list on chain and looks the
    /// resolved addresses up among these, so a wrong list fails here.
    fn transfer_ix(&self, from: &Keypair, to: &Pubkey, amount: u64) -> Instruction {
        let mut ix = token_ix::transfer_checked(
            &TOKEN_2022,
            &self.ata(&from.pubkey()),
            &self.mint,
            &self.ata(to),
            &from.pubkey(),
            &[],
            amount,
            DECIMALS,
        )
        .unwrap();
        ix.accounts.extend(self.extra_metas(&from.pubkey(), to));
        ix.accounts.push(AccountMeta::new_readonly(HOOK, false));
        ix.accounts.push(AccountMeta::new_readonly(self.meta_list, false));
        ix
    }

    /// The hook's Execute instruction sent directly, outside a transfer.
    fn direct_execute_ix(&self, from: &Pubkey, to: &Pubkey, amount: u64) -> Instruction {
        let mut data = execute_disc().to_vec();
        data.extend_from_slice(&amount.to_le_bytes());
        let mut accounts = vec![
            AccountMeta::new_readonly(self.ata(from), false),
            AccountMeta::new_readonly(self.mint, false),
            AccountMeta::new_readonly(self.ata(to), false),
            AccountMeta::new_readonly(*from, false),
            AccountMeta::new_readonly(self.meta_list, false),
        ];
        accounts.extend(self.extra_metas(from, to));
        Instruction { program_id: HOOK, accounts, data }
    }

    fn daily_volume(&self, wallet: &Pubkey) -> u64 {
        let acc = self.svm.get_account(&self.whitelist(wallet)).unwrap();
        // disc 8 + wallet 32 + registry 32 + level 1 + jurisdiction 1
        // + kyc_hash 32 + is_active 1 + daily_limit 8
        let off = 8 + 32 + 32 + 1 + 1 + 32 + 1 + 8;
        u64::from_le_bytes(acc.data[off..off + 8].try_into().unwrap())
    }

    fn balance(&self, wallet: &Pubkey) -> u64 {
        let acc = self.svm.get_account(&self.ata(wallet)).unwrap();
        u64::from_le_bytes(acc.data[64..72].try_into().unwrap())
    }
}

fn initialize_registry_ix(authority: &Pubkey, mint: &Pubkey) -> Instruction {
    Instruction {
        program_id: HOOK,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(pda(&[b"kyc_registry", mint.as_ref()]), false),
            // program_data: None (Anchor optional accounts use the program id)
            AccountMeta::new_readonly(HOOK, false),
            AccountMeta::new_readonly(SYSTEM, false),
        ],
        data: anchor_disc("initialize_registry").to_vec(),
    }
}

/// Mint with this program as transfer hook, registry and meta list set up.
fn setup() -> Env {
    let mut svm = LiteSVM::new();
    let so = concat!(env!("CARGO_MANIFEST_DIR"), "/../target/deploy/transfer_hook.so");
    svm.add_program_from_file(HOOK, so)
        .expect("build transfer_hook.so with cargo build-sbf first");
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 100_000_000_000).unwrap();

    let mint_kp = Keypair::new();
    let mint = mint_kp.pubkey();
    let space = ExtensionType::try_calculate_account_len::<Mint>(&[ExtensionType::TransferHook])
        .unwrap();
    let rent = svm.minimum_balance_for_rent_exemption(space);
    let mut env = Env {
        svm,
        payer,
        mint,
        registry: pda(&[b"kyc_registry", mint.as_ref()]),
        meta_list: pda(&[b"extra-account-metas", mint.as_ref()]),
    };
    let payer_pk = env.payer.pubkey();
    env.send(
        &[
            solana_system_interface::instruction::create_account(
                &payer_pk,
                &mint,
                rent,
                space as u64,
                &TOKEN_2022,
            ),
            transfer_hook::instruction::initialize(
                &TOKEN_2022,
                &mint,
                Some(payer_pk),
                Some(HOOK),
            )
            .unwrap(),
            token_ix::initialize_mint2(&TOKEN_2022, &mint, &payer_pk, None, DECIMALS).unwrap(),
        ],
        &[&mint_kp],
    )
    .unwrap();

    let init_meta = Instruction {
        program_id: HOOK,
        accounts: vec![
            AccountMeta::new(payer_pk, true),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new(env.meta_list, false),
            AccountMeta::new_readonly(SYSTEM, false),
        ],
        data: anchor_disc("initialize_extra_account_meta_list").to_vec(),
    };
    env.send(&[initialize_registry_ix(&payer_pk, &mint), init_meta], &[])
        .unwrap();
    env
}

fn assert_code(res: Result<(), String>, code: u32) {
    let err = res.expect_err("expected the transaction to fail");
    assert!(
        err.contains(&format!("Custom({code})")),
        "expected custom error {code}, got {err}"
    );
}

#[test]
fn whitelisted_transfer_passes_and_records_volume() {
    let mut env = setup();
    let alice = env.new_wallet(1_000_000);
    let bob = env.new_wallet(0);
    let (a, b) = (alice.pubkey(), bob.pubkey());
    let ixs = [env.add_to_whitelist_ix(&a), env.add_to_whitelist_ix(&b)];
    env.send(&ixs, &[]).unwrap();

    let ix = env.transfer_ix(&alice, &b, 250_000);
    env.send(&[ix], &[&alice]).unwrap();
    assert_eq!(env.balance(&b), 250_000);
    // execute ran (not a no-op): the sender's daily volume was recorded.
    assert_eq!(env.daily_volume(&a), 250_000);
}

#[test]
fn transfer_to_non_whitelisted_fails() {
    let mut env = setup();
    let alice = env.new_wallet(1_000_000);
    let carol = env.new_wallet(0);
    let ix = env.add_to_whitelist_ix(&alice.pubkey());
    env.send(&[ix], &[]).unwrap();

    let ix = env.transfer_ix(&alice, &carol.pubkey(), 1);
    assert_code(env.send(&[ix], &[&alice]), ERR_ACCOUNT_NOT_INITIALIZED);
    assert_eq!(env.balance(&carol.pubkey()), 0);
}

#[test]
fn transfer_from_non_whitelisted_fails() {
    let mut env = setup();
    let alice = env.new_wallet(1_000_000);
    let bob = env.new_wallet(0);
    let ix = env.add_to_whitelist_ix(&bob.pubkey());
    env.send(&[ix], &[]).unwrap();

    let ix = env.transfer_ix(&alice, &bob.pubkey(), 1);
    assert_code(env.send(&[ix], &[&alice]), ERR_ACCOUNT_NOT_INITIALIZED);
}

#[test]
fn removed_entry_blocks_transfer_and_cannot_be_removed_twice() {
    let mut env = setup();
    let alice = env.new_wallet(1_000_000);
    let bob = env.new_wallet(0);
    let (a, b) = (alice.pubkey(), bob.pubkey());
    let ixs = [env.add_to_whitelist_ix(&a), env.add_to_whitelist_ix(&b)];
    env.send(&ixs, &[]).unwrap();

    let ix = env.remove_from_whitelist_ix(&b);
    env.send(&[ix], &[]).unwrap();
    let ix = env.transfer_ix(&alice, &b, 1);
    assert!(env.send(&[ix], &[&alice]).is_err());

    let ix = env.remove_from_whitelist_ix(&b);
    assert_code(env.send(&[ix], &[]), ERR_ENTRY_NOT_ACTIVE);
}

#[test]
fn blacklisted_parties_are_rejected() {
    let mut env = setup();
    let alice = env.new_wallet(1_000_000);
    let bob = env.new_wallet(1_000_000);
    let (a, b) = (alice.pubkey(), bob.pubkey());
    let ixs = [env.add_to_whitelist_ix(&a), env.add_to_whitelist_ix(&b)];
    env.send(&ixs, &[]).unwrap();
    let ix = env.add_to_blacklist_ix(&b);
    env.send(&[ix], &[]).unwrap();

    let ix = env.transfer_ix(&alice, &b, 1);
    assert_code(env.send(&[ix], &[&alice]), ERR_RECIPIENT_BLACKLISTED);
    let ix = env.transfer_ix(&bob, &a, 1);
    assert_code(env.send(&[ix], &[&bob]), ERR_SENDER_BLACKLISTED);
}

#[test]
fn direct_execute_outside_a_transfer_fails() {
    let mut env = setup();
    let alice = env.new_wallet(1_000_000);
    let bob = env.new_wallet(0);
    let (a, b) = (alice.pubkey(), bob.pubkey());
    let ixs = [env.add_to_whitelist_ix(&a), env.add_to_whitelist_ix(&b)];
    env.send(&ixs, &[]).unwrap();

    let ix = env.direct_execute_ix(&a, &b, 500_000);
    assert_code(env.send(&[ix], &[]), ERR_NOT_TRANSFERRING);
    assert_eq!(env.daily_volume(&a), 0);
}

#[test]
fn unknown_instruction_is_rejected() {
    let mut env = setup();
    let ix = Instruction {
        program_id: HOOK,
        accounts: vec![],
        data: vec![0xff; 16],
    };
    assert_code(env.send(&[ix], &[]), ERR_FALLBACK_NOT_FOUND);
}

#[test]
fn registry_init_requires_the_mint_authority() {
    let mut svm_env = setup();
    // A second mint whose mint authority is the payer; someone else tries
    // to create its registry first.
    let mint_kp = Keypair::new();
    let mint = mint_kp.pubkey();
    let payer_pk = svm_env.payer.pubkey();
    let space = ExtensionType::try_calculate_account_len::<Mint>(&[ExtensionType::TransferHook])
        .unwrap();
    let rent = svm_env.svm.minimum_balance_for_rent_exemption(space);
    svm_env
        .send(
            &[
                solana_system_interface::instruction::create_account(
                    &payer_pk,
                    &mint,
                    rent,
                    space as u64,
                    &TOKEN_2022,
                ),
                transfer_hook::instruction::initialize(
                    &TOKEN_2022,
                    &mint,
                    Some(payer_pk),
                    Some(HOOK),
                )
                .unwrap(),
                token_ix::initialize_mint2(&TOKEN_2022, &mint, &payer_pk, None, DECIMALS)
                    .unwrap(),
            ],
            &[&mint_kp],
        )
        .unwrap();

    let mallory = Keypair::new();
    svm_env.svm.airdrop(&mallory.pubkey(), 1_000_000_000).unwrap();
    let ix = initialize_registry_ix(&mallory.pubkey(), &mint);
    assert_code(svm_env.send(&[ix], &[&mallory]), ERR_UNAUTHORIZED);

    let ix = initialize_registry_ix(&payer_pk, &mint);
    svm_env.send(&[ix], &[]).unwrap();
}

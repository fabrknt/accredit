//! Real Token-2022 `transfer_checked` calls through the transfer-hook program.
//!
//! Instructions for the hook are assembled from raw bytes (Anchor
//! discriminator + Borsh), so this crate shares no code with the program.
//! Build the program first: `cargo build-sbf --manifest-path
//! programs/transfer-hook/Cargo.toml`.

use litesvm::LiteSVM;
use sha2::{Digest, Sha256};
use solana_account::Account;
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
const UPGRADEABLE_LOADER: Pubkey =
    Pubkey::from_str_const("BPFLoaderUpgradeab1e11111111111111111111111");
const DECIMALS: u8 = 6;

// TransferHookError codes (6000 + variant index).
const ERR_UNAUTHORIZED: u32 = 6000;
const ERR_SENDER_NOT_WHITELISTED: u32 = 6002;
const ERR_DAILY_LIMIT_EXCEEDED: u32 = 6005;
const ERR_SENDER_BLACKLISTED: u32 = 6010;
const ERR_RECIPIENT_BLACKLISTED: u32 = 6011;
const ERR_NOT_TRANSFERRING: u32 = 6018;
const ERR_HOOK_PROGRAM_MISMATCH: u32 = 6019;
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

fn program_data_address() -> Pubkey {
    Pubkey::find_program_address(&[HOOK.as_ref()], &UPGRADEABLE_LOADER).0
}

/// How the test mint is created.
struct MintOpts {
    /// Program the mint's TransferHook extension points at.
    hook_program: Pubkey,
    /// Mint authority; `None` means the payer.
    mint_authority: Option<Pubkey>,
    permanent_delegate: Option<Pubkey>,
    /// Create the registry (signed by the payer as mint authority) and the
    /// extra account meta list.
    init_registry: bool,
}

impl Default for MintOpts {
    fn default() -> Self {
        Self {
            hook_program: HOOK,
            mint_authority: None,
            permanent_delegate: None,
            init_registry: true,
        }
    }
}

struct Env {
    svm: LiteSVM,
    payer: Keypair,
    /// Registry authority used for whitelist/blacklist instructions.
    admin: Keypair,
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

    /// Send signed by the payer and the registry admin.
    fn send_admin(&mut self, ixs: &[Instruction]) -> Result<(), String> {
        let admin = self.admin.insecure_clone();
        self.send(ixs, &[&admin])
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
        self.add_to_whitelist_with_limit_ix(wallet, 0)
    }

    /// `daily_limit` 0 means unlimited (only the per-level trade limit applies).
    fn add_to_whitelist_with_limit_ix(&self, wallet: &Pubkey, daily_limit: u64) -> Instruction {
        let mut data = anchor_disc("add_to_whitelist").to_vec();
        data.extend_from_slice(wallet.as_ref());
        data.push(0); // KycLevel::Basic
        data.push(0); // Jurisdiction::Japan
        data.extend_from_slice(&[7u8; 32]); // kyc_hash
        data.extend_from_slice(&daily_limit.to_le_bytes());
        data.extend_from_slice(&0i64.to_le_bytes()); // expiry (0 = none)
        Instruction {
            program_id: HOOK,
            accounts: vec![
                AccountMeta::new(self.admin.pubkey(), true),
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
                AccountMeta::new_readonly(self.admin.pubkey(), true),
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
                AccountMeta::new(self.admin.pubkey(), true),
                AccountMeta::new(self.registry, false),
                AccountMeta::new(self.blacklist(wallet), false),
                AccountMeta::new_readonly(SYSTEM, false),
            ],
            data,
        }
    }

    fn init_meta_list_ix(&self) -> Instruction {
        Instruction {
            program_id: HOOK,
            accounts: vec![
                AccountMeta::new(self.payer.pubkey(), true),
                AccountMeta::new_readonly(self.mint, false),
                AccountMeta::new(self.meta_list, false),
                AccountMeta::new_readonly(SYSTEM, false),
            ],
            data: anchor_disc("initialize_extra_account_meta_list").to_vec(),
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
        self.transfer_by_ix(&from.pubkey(), &from.pubkey(), to, amount)
    }

    /// transfer_checked from `from`'s token account, signed by `authority`
    /// (the owner, or a delegate).
    fn transfer_by_ix(
        &self,
        authority: &Pubkey,
        from: &Pubkey,
        to: &Pubkey,
        amount: u64,
    ) -> Instruction {
        let mut ix = token_ix::transfer_checked(
            &TOKEN_2022,
            &self.ata(from),
            &self.mint,
            &self.ata(to),
            authority,
            &[],
            amount,
            DECIMALS,
        )
        .unwrap();
        ix.accounts.extend(self.extra_metas(from, to));
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

    fn registry_authority(&self) -> Pubkey {
        let acc = self.svm.get_account(&self.registry).unwrap();
        Pubkey::try_from(&acc.data[8..40]).unwrap()
    }

    fn balance(&self, wallet: &Pubkey) -> u64 {
        let acc = self.svm.get_account(&self.ata(wallet)).unwrap();
        u64::from_le_bytes(acc.data[64..72].try_into().unwrap())
    }

    /// Put a ProgramData account for the hook with `upgrade_authority`.
    /// LiteSVM's add_program_from_file does not create one.
    fn set_program_data(&mut self, upgrade_authority: Option<Pubkey>) {
        // bincode UpgradeableLoaderState::ProgramData { slot, upgrade_authority_address }
        let mut data = 3u32.to_le_bytes().to_vec();
        data.extend_from_slice(&0u64.to_le_bytes());
        match upgrade_authority {
            Some(a) => {
                data.push(1);
                data.extend_from_slice(a.as_ref());
            }
            None => {
                data.push(0);
                data.extend_from_slice(&[0u8; 32]);
            }
        }
        let lamports = self.svm.minimum_balance_for_rent_exemption(data.len());
        self.svm
            .set_account(
                program_data_address(),
                Account {
                    lamports,
                    data,
                    owner: UPGRADEABLE_LOADER,
                    executable: false,
                    rent_epoch: 0,
                },
            )
            .unwrap();
    }
}

/// initialize_registry signed by `authority`, naming `admin`. With
/// `with_program_data`, passes the hook's ProgramData account.
fn initialize_registry_ix(
    authority: &Pubkey,
    mint: &Pubkey,
    admin: &Pubkey,
    with_program_data: bool,
) -> Instruction {
    let mut data = anchor_disc("initialize_registry").to_vec();
    data.extend_from_slice(admin.as_ref());
    let program_data = if with_program_data {
        program_data_address()
    } else {
        HOOK // Anchor optional accounts use the program id for None
    };
    Instruction {
        program_id: HOOK,
        accounts: vec![
            AccountMeta::new(*authority, true),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(pda(&[b"kyc_registry", mint.as_ref()]), false),
            AccountMeta::new_readonly(program_data, false),
            AccountMeta::new_readonly(SYSTEM, false),
        ],
        data,
    }
}

/// Mint with the TransferHook extension (and optionally PermanentDelegate),
/// with the registry and meta list set up unless `opts` says otherwise.
fn setup_with(opts: MintOpts) -> Env {
    let mut svm = LiteSVM::new();
    let so = concat!(env!("CARGO_MANIFEST_DIR"), "/../target/deploy/transfer_hook.so");
    svm.add_program_from_file(HOOK, so)
        .expect("build transfer_hook.so with cargo build-sbf first");
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 100_000_000_000).unwrap();

    let mint_kp = Keypair::new();
    let mint = mint_kp.pubkey();
    let mut exts = vec![ExtensionType::TransferHook];
    if opts.permanent_delegate.is_some() {
        exts.push(ExtensionType::PermanentDelegate);
    }
    let space = ExtensionType::try_calculate_account_len::<Mint>(&exts).unwrap();
    let rent = svm.minimum_balance_for_rent_exemption(space);
    let admin = payer.insecure_clone();
    let mut env = Env {
        svm,
        payer,
        admin,
        mint,
        registry: pda(&[b"kyc_registry", mint.as_ref()]),
        meta_list: pda(&[b"extra-account-metas", mint.as_ref()]),
    };
    let payer_pk = env.payer.pubkey();
    let mint_authority = opts.mint_authority.unwrap_or(payer_pk);
    let mut ixs = vec![
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
            Some(opts.hook_program),
        )
        .unwrap(),
    ];
    if let Some(delegate) = opts.permanent_delegate {
        ixs.push(token_ix::initialize_permanent_delegate(&TOKEN_2022, &mint, &delegate).unwrap());
    }
    ixs.push(
        token_ix::initialize_mint2(&TOKEN_2022, &mint, &mint_authority, None, DECIMALS).unwrap(),
    );
    env.send(&ixs, &[&mint_kp]).unwrap();

    if opts.init_registry {
        let ixs = [
            initialize_registry_ix(&payer_pk, &mint, &payer_pk, false),
            env.init_meta_list_ix(),
        ];
        env.send(&ixs, &[]).unwrap();
    }
    env
}

fn setup() -> Env {
    setup_with(MintOpts::default())
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
    env.send_admin(&ixs).unwrap();

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
    env.send_admin(&[ix]).unwrap();

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
    env.send_admin(&[ix]).unwrap();

    let ix = env.transfer_ix(&alice, &bob.pubkey(), 1);
    assert_code(env.send(&[ix], &[&alice]), ERR_SENDER_NOT_WHITELISTED);
}

#[test]
fn removed_entry_blocks_transfer_and_cannot_be_removed_twice() {
    let mut env = setup();
    let alice = env.new_wallet(1_000_000);
    let bob = env.new_wallet(0);
    let (a, b) = (alice.pubkey(), bob.pubkey());
    let ixs = [env.add_to_whitelist_ix(&a), env.add_to_whitelist_ix(&b)];
    env.send_admin(&ixs).unwrap();

    let ix = env.remove_from_whitelist_ix(&b);
    env.send_admin(&[ix]).unwrap();
    let ix = env.transfer_ix(&alice, &b, 1);
    assert!(env.send(&[ix], &[&alice]).is_err());

    let ix = env.remove_from_whitelist_ix(&b);
    assert_code(env.send_admin(&[ix]), ERR_ENTRY_NOT_ACTIVE);
}

#[test]
fn blacklisted_parties_are_rejected() {
    let mut env = setup();
    let alice = env.new_wallet(1_000_000);
    let bob = env.new_wallet(1_000_000);
    let (a, b) = (alice.pubkey(), bob.pubkey());
    let ixs = [env.add_to_whitelist_ix(&a), env.add_to_whitelist_ix(&b)];
    env.send_admin(&ixs).unwrap();
    let ix = env.add_to_blacklist_ix(&b);
    env.send_admin(&[ix]).unwrap();

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
    env.send_admin(&ixs).unwrap();

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
    let mut env = setup_with(MintOpts {
        init_registry: false,
        ..MintOpts::default()
    });
    let payer_pk = env.payer.pubkey();
    let mint = env.mint;

    let mallory = Keypair::new();
    env.svm.airdrop(&mallory.pubkey(), 1_000_000_000).unwrap();
    let ix = initialize_registry_ix(&mallory.pubkey(), &mint, &mallory.pubkey(), false);
    assert_code(env.send(&[ix], &[&mallory]), ERR_UNAUTHORIZED);

    let ix = initialize_registry_ix(&payer_pk, &mint, &payer_pk, false);
    env.send(&[ix], &[]).unwrap();
}

// ---------------------------------------------------------------------------
// Permanent delegate (SSS-2 seize)
// ---------------------------------------------------------------------------

#[test]
fn permanent_delegate_can_seize_from_blacklisted_or_unlisted_holder() {
    let delegate = Keypair::new();
    let mut env = setup_with(MintOpts {
        permanent_delegate: Some(delegate.pubkey()),
        ..MintOpts::default()
    });
    env.svm.airdrop(&delegate.pubkey(), 1_000_000_000).unwrap();
    let holder = env.new_wallet(1_000_000);
    let unlisted = env.new_wallet(1_000_000);
    let treasury = env.new_wallet(0);
    let (h, u, t) = (holder.pubkey(), unlisted.pubkey(), treasury.pubkey());
    let ixs = [
        env.add_to_whitelist_ix(&h),
        env.add_to_whitelist_ix(&t),
        env.add_to_blacklist_ix(&h),
    ];
    env.send_admin(&ixs).unwrap();

    // The blacklisted holder cannot move funds itself.
    let ix = env.transfer_ix(&holder, &t, 1);
    assert_code(env.send(&[ix], &[&holder]), ERR_SENDER_BLACKLISTED);

    // The permanent delegate can seize from the blacklisted holder ...
    let ix = env.transfer_by_ix(&delegate.pubkey(), &h, &t, 400_000);
    env.send(&[ix], &[&delegate]).unwrap();
    assert_eq!(env.balance(&t), 400_000);
    // ... and from a holder with no whitelist entry at all.
    let ix = env.transfer_by_ix(&delegate.pubkey(), &u, &t, 300_000);
    env.send(&[ix], &[&delegate]).unwrap();
    assert_eq!(env.balance(&t), 700_000);
}

#[test]
fn permanent_delegate_still_needs_an_allowed_recipient() {
    let delegate = Keypair::new();
    let mut env = setup_with(MintOpts {
        permanent_delegate: Some(delegate.pubkey()),
        ..MintOpts::default()
    });
    env.svm.airdrop(&delegate.pubkey(), 1_000_000_000).unwrap();
    let holder = env.new_wallet(1_000_000);
    let unlisted = env.new_wallet(0);
    let blocked = env.new_wallet(0);
    let (h, u, b) = (holder.pubkey(), unlisted.pubkey(), blocked.pubkey());
    let ixs = [
        env.add_to_whitelist_ix(&b),
        env.add_to_blacklist_ix(&b),
    ];
    env.send_admin(&ixs).unwrap();

    let ix = env.transfer_by_ix(&delegate.pubkey(), &h, &u, 1);
    assert_code(env.send(&[ix], &[&delegate]), ERR_ACCOUNT_NOT_INITIALIZED);
    let ix = env.transfer_by_ix(&delegate.pubkey(), &h, &b, 1);
    assert_code(env.send(&[ix], &[&delegate]), ERR_RECIPIENT_BLACKLISTED);
}

#[test]
fn ordinary_delegate_gets_no_exemption() {
    let delegate = Keypair::new();
    let mut env = setup_with(MintOpts {
        permanent_delegate: Some(delegate.pubkey()),
        ..MintOpts::default()
    });
    let holder = env.new_wallet(1_000_000);
    let treasury = env.new_wallet(0);
    let (h, t) = (holder.pubkey(), treasury.pubkey());
    let ixs = [
        env.add_to_whitelist_ix(&h),
        env.add_to_whitelist_ix(&t),
        env.add_to_blacklist_ix(&h),
    ];
    env.send_admin(&ixs).unwrap();

    // The holder approves some other wallet as a regular delegate; that
    // wallet signing the transfer is still subject to the sender checks.
    let other = Keypair::new();
    env.svm.airdrop(&other.pubkey(), 1_000_000_000).unwrap();
    let approve = token_ix::approve(
        &TOKEN_2022,
        &env.ata(&h),
        &other.pubkey(),
        &h,
        &[],
        1_000_000,
    )
    .unwrap();
    env.send(&[approve], &[&holder]).unwrap();
    let ix = env.transfer_by_ix(&other.pubkey(), &h, &t, 1);
    assert_code(env.send(&[ix], &[&other]), ERR_SENDER_BLACKLISTED);
    assert_eq!(env.balance(&t), 0);
}

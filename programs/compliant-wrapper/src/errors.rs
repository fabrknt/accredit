use anchor_lang::prelude::*;

#[error_code]
pub enum WrapperError {
    #[msg("Wrapper is paused")]
    WrapperPaused,

    #[msg("Insufficient balance")]
    InsufficientBalance,

    #[msg("Unauthorized access")]
    UnauthorizedAccess,

    #[msg("KYC level does not meet minimum requirement")]
    InvalidKycLevel,

    #[msg("KYC verification has expired")]
    KycExpired,

    #[msg("KYC entry is not active")]
    KycNotActive,

    #[msg("Amount is too small")]
    AmountTooSmall,

    #[msg("Arithmetic overflow")]
    Overflow,
}

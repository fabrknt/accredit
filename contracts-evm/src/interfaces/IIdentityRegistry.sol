// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IIdentityRegistry
/// @notice On-chain KYC/identity registry. EVM analogue of accredit's Solana
///         `compliant-registry` program. Maps an address to a verified identity
///         claim (KYC level, jurisdiction, expiry). Populated by an off-chain KYC
///         provider bridge (accredit-kyc-providers).
interface IIdentityRegistry {
    struct Identity {
        uint8 kycLevel; // 0 = none, higher = stronger verification
        uint16 jurisdiction; // ISO-3166 numeric country code
        uint64 expiry; // unix seconds; 0 = never expires
        bool whitelisted;
    }

    event IdentityRegistered(address indexed account, uint8 kycLevel, uint16 jurisdiction, uint64 expiry);
    event IdentityRevoked(address indexed account);
    event AddressFrozen(address indexed account, bool frozen);

    function registerIdentity(address account, uint8 kycLevel, uint16 jurisdiction, uint64 expiry) external;

    function revokeIdentity(address account) external;

    /// @notice Freeze/unfreeze an address (blocks both sending and receiving) without
    ///         discarding its KYC claim. Canonical ERC-3643 agent power.
    function setAddressFrozen(address account, bool frozen) external;

    function isFrozen(address account) external view returns (bool);

    function identityOf(address account) external view returns (Identity memory);

    /// @notice True if `account` holds a non-expired, whitelisted, non-frozen identity at >= `minKycLevel`.
    function isVerified(address account, uint8 minKycLevel) external view returns (bool);
}

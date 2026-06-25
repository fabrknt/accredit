// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title ICompliance
/// @notice Modular compliance engine (ERC-3643-style). The compliant token calls
///         `canTransfer` on every move; mint/burn bypass is decided by the token.
interface ICompliance {
    /// @notice Returns (allowed, reason). reason is empty when allowed.
    function canTransfer(address from, address to, uint256 amount)
        external
        view
        returns (bool allowed, string memory reason);

    /// @notice Receiver-only gate, used on mint/issuance so supply cannot be
    ///         provisioned to an unverified or sanctioned address.
    function canReceive(address to, uint256 amount) external view returns (bool allowed, string memory reason);

    /// @notice Sender-side gate for redemption/burn, so a frozen holder cannot
    ///         destroy their balance to escape an agent recovery.
    function canRedeem(address from, uint256 amount) external view returns (bool allowed, string memory reason);
}

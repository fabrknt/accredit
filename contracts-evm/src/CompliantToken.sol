// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ICompliance} from "./interfaces/ICompliance.sol";

/// @title CompliantToken
/// @notice ERC-20 whose transfers are gated by a ModularCompliance engine.
///         EVM analogue of accredit's Solana Token-2022 transfer-hook program.
///         Mint (from == 0) and burn (to == 0) bypass the transfer gate so the
///         issuer can provision supply; peer-to-peer transfers are enforced.
///         Intended use on HashKey: cHSP — a compliance-gated wrapper over HSP.
contract CompliantToken is ERC20, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    ICompliance public compliance;

    event ComplianceUpdated(address indexed compliance);
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount, address indexed agent);

    constructor(string memory name_, string memory symbol_, address admin, ICompliance _compliance)
        ERC20(name_, symbol_)
    {
        require(admin != address(0), "CT: zero admin");
        require(address(_compliance) != address(0), "CT: zero compliance");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(AGENT_ROLE, admin);
        compliance = _compliance;
        emit ComplianceUpdated(address(_compliance));
    }

    function setCompliance(ICompliance _compliance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(address(_compliance) != address(0), "CT: zero compliance");
        compliance = _compliance;
        emit ComplianceUpdated(address(_compliance));
    }

    /// @notice Issue supply. Recipient must pass the compliance receiver gate — supply
    ///         can never be provisioned to an unverified or sanctioned address.
    function mint(address to, uint256 amount) external onlyRole(ISSUER_ROLE) {
        (bool allowed, string memory reason) = compliance.canReceive(to, amount);
        require(allowed, reason);
        _mint(to, amount);
    }

    /// @notice Redeem (burn) the caller's own balance — normal stablecoin redemption.
    ///         Blocked for frozen holders so they cannot destroy funds ahead of recovery.
    function burn(uint256 amount) external {
        (bool allowed, string memory reason) = compliance.canRedeem(_msgSender(), amount);
        require(allowed, reason);
        _burn(_msgSender(), amount);
    }

    /// @notice Court-ordered / recovery move of frozen or compromised funds. Bypasses the
    ///         transfer gate by design, but is restricted to AGENT_ROLE and fully evented
    ///         so the action is auditable. Recipient must still be compliance-eligible.
    function forcedTransfer(address from, address to, uint256 amount) external onlyRole(AGENT_ROLE) {
        (bool allowed, string memory reason) = compliance.canReceive(to, amount);
        require(allowed, reason);
        _forced = true;
        _transfer(from, to, amount);
        _forced = false;
        emit ForcedTransfer(from, to, amount, _msgSender());
    }

    bool private _forced;

    /// @dev OZ v5 transfer hook. Enforce compliance on peer-to-peer moves; mint/burn and
    ///      agent forcedTransfer bypass the gate (each guarded by its own caller checks).
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && !_forced) {
            (bool allowed, string memory reason) = compliance.canTransfer(from, to, value);
            require(allowed, reason);
        }
        super._update(from, to, value);
    }
}

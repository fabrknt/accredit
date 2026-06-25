// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/// @title IdentityRegistry
/// @notice KYC/identity claims, written by AGENT_ROLE (the off-chain KYC bridge).
contract IdentityRegistry is IIdentityRegistry, AccessControl {
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    mapping(address => Identity) private _identities;
    mapping(address => bool) private _frozen;

    constructor(address admin) {
        require(admin != address(0), "IR: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(AGENT_ROLE, admin);
    }

    function registerIdentity(address account, uint8 kycLevel, uint16 jurisdiction, uint64 expiry)
        external
        onlyRole(AGENT_ROLE)
    {
        require(account != address(0), "IR: zero account");
        require(kycLevel > 0, "IR: kycLevel must be > 0");
        _identities[account] = Identity({
            kycLevel: kycLevel,
            jurisdiction: jurisdiction,
            expiry: expiry,
            whitelisted: true
        });
        emit IdentityRegistered(account, kycLevel, jurisdiction, expiry);
    }

    function revokeIdentity(address account) external onlyRole(AGENT_ROLE) {
        delete _identities[account];
        emit IdentityRevoked(account);
    }

    function setAddressFrozen(address account, bool frozen) external onlyRole(AGENT_ROLE) {
        _frozen[account] = frozen;
        emit AddressFrozen(account, frozen);
    }

    function isFrozen(address account) external view returns (bool) {
        return _frozen[account];
    }

    function identityOf(address account) external view returns (Identity memory) {
        return _identities[account];
    }

    function isVerified(address account, uint8 minKycLevel) external view returns (bool) {
        if (_frozen[account]) return false;
        Identity memory id = _identities[account];
        if (!id.whitelisted) return false;
        if (id.kycLevel < minKycLevel) return false;
        if (id.expiry != 0 && id.expiry < block.timestamp) return false;
        return true;
    }
}

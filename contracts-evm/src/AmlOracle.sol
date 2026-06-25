// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IAmlOracle} from "./interfaces/IAmlOracle.sol";

/// @title AmlOracle
/// @notice On-chain risk attestations written by SCORER_ROLE — the off-chain
///         AI-AML model. Keeps the scoring model off-chain (where ML belongs)
///         while anchoring its verdict on-chain for trustless enforcement + audit.
contract AmlOracle is IAmlOracle, AccessControl {
    bytes32 public constant SCORER_ROLE = keccak256("SCORER_ROLE");

    mapping(address => RiskAttestation) private _risk;

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SCORER_ROLE, admin);
    }

    function attestRisk(address account, uint8 score, bytes32 modelRef) external onlyRole(SCORER_ROLE) {
        require(account != address(0), "AML: zero account");
        require(score <= 100, "AML: score out of range");
        _risk[account] = RiskAttestation({score: score, updatedAt: uint64(block.timestamp), modelRef: modelRef});
        emit RiskScored(account, score, modelRef);
    }

    function riskOf(address account) external view returns (RiskAttestation memory) {
        return _risk[account];
    }

    function isClean(address account, uint8 maxScore, uint64 maxAge) external view returns (bool) {
        RiskAttestation memory r = _risk[account];
        if (r.updatedAt == 0) return false; // never scored = not clean
        if (r.score > maxScore) return false;
        if (maxAge != 0 && block.timestamp > r.updatedAt + maxAge) return false; // stale
        return true;
    }
}

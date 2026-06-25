// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IAmlOracle
/// @notice On-chain AML risk attestation surface. An off-chain AI-AML scorer
///         (the AI x DeFi bridge) writes a per-address risk score; the compliance
///         layer reads it at transfer time. This is the on-chain anchor for
///         model-driven screening — scores are explainable and auditable.
interface IAmlOracle {
    struct RiskAttestation {
        uint8 score; // 0 (clean) .. 100 (highest risk)
        uint64 updatedAt; // unix seconds of last scoring
        bytes32 modelRef; // hash/id of the scoring model + feature set used
    }

    event RiskScored(address indexed account, uint8 score, bytes32 modelRef);

    function attestRisk(address account, uint8 score, bytes32 modelRef) external;

    function riskOf(address account) external view returns (RiskAttestation memory);

    /// @notice True if `account`'s latest score is <= `maxScore` and not staler than `maxAge` seconds.
    function isClean(address account, uint8 maxScore, uint64 maxAge) external view returns (bool);
}

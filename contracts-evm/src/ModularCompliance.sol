// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICompliance} from "./interfaces/ICompliance.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {IAmlOracle} from "./interfaces/IAmlOracle.sol";

/// @title ModularCompliance
/// @notice Combines identity (KYC) + AML risk into a single transfer gate.
///         Both sender and receiver must be KYC-verified AND AML-clean.
contract ModularCompliance is ICompliance, Ownable {
    IIdentityRegistry public identityRegistry;
    IAmlOracle public amlOracle;

    uint8 public minKycLevel = 1;
    uint8 public maxRiskScore = 50;
    uint64 public maxRiskAge = 30 days;
    uint256 public maxTransferAmount; // 0 = no cap

    event ParamsUpdated(uint8 minKycLevel, uint8 maxRiskScore, uint64 maxRiskAge, uint256 maxTransferAmount);
    event IdentityRegistryUpdated(address indexed registry);
    event AmlOracleUpdated(address indexed oracle);

    constructor(address admin, IIdentityRegistry _identityRegistry, IAmlOracle _amlOracle) Ownable(admin) {
        require(address(_identityRegistry) != address(0), "MC: zero registry");
        require(address(_amlOracle) != address(0), "MC: zero oracle");
        identityRegistry = _identityRegistry;
        amlOracle = _amlOracle;
    }

    function setIdentityRegistry(IIdentityRegistry _identityRegistry) external onlyOwner {
        require(address(_identityRegistry) != address(0), "MC: zero registry");
        identityRegistry = _identityRegistry;
        emit IdentityRegistryUpdated(address(_identityRegistry));
    }

    function setAmlOracle(IAmlOracle _amlOracle) external onlyOwner {
        require(address(_amlOracle) != address(0), "MC: zero oracle");
        amlOracle = _amlOracle;
        emit AmlOracleUpdated(address(_amlOracle));
    }

    function setParams(uint8 _minKycLevel, uint8 _maxRiskScore, uint64 _maxRiskAge, uint256 _maxTransferAmount)
        external
        onlyOwner
    {
        minKycLevel = _minKycLevel;
        maxRiskScore = _maxRiskScore;
        maxRiskAge = _maxRiskAge;
        maxTransferAmount = _maxTransferAmount;
        emit ParamsUpdated(_minKycLevel, _maxRiskScore, _maxRiskAge, _maxTransferAmount);
    }

    /// @dev Receiver-side eligibility — shared by canReceive (mint) and canTransfer.
    function _checkReceiver(address to) internal view returns (bool, string memory) {
        if (!identityRegistry.isVerified(to, minKycLevel)) return (false, "recipient not KYC-verified");
        if (!amlOracle.isClean(to, maxRiskScore, maxRiskAge)) return (false, "recipient failed AML screen");
        return (true, "");
    }

    function canReceive(address to, uint256 amount) external view returns (bool allowed, string memory reason) {
        if (maxTransferAmount != 0 && amount > maxTransferAmount) return (false, "amount exceeds limit");
        return _checkReceiver(to);
    }

    /// @dev Redemption is gated on freeze + AML, but intentionally NOT on KYC level/expiry:
    ///      a sanctioned/frozen holder must not exit value, but an honest holder with merely
    ///      lapsed KYC should still be able to redeem their own funds (no fund-trapping).
    function canRedeem(address from, uint256) external view returns (bool allowed, string memory reason) {
        if (identityRegistry.isFrozen(from)) return (false, "account frozen");
        if (!amlOracle.isClean(from, maxRiskScore, maxRiskAge)) return (false, "account failed AML screen");
        return (true, "");
    }

    function canTransfer(address from, address to, uint256 amount)
        external
        view
        returns (bool allowed, string memory reason)
    {
        if (maxTransferAmount != 0 && amount > maxTransferAmount) {
            return (false, "amount exceeds limit");
        }
        if (!identityRegistry.isVerified(from, minKycLevel)) return (false, "sender not KYC-verified");
        if (!amlOracle.isClean(from, maxRiskScore, maxRiskAge)) return (false, "sender failed AML screen");
        return _checkReceiver(to);
    }
}

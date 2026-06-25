// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {AmlOracle} from "../src/AmlOracle.sol";
import {CompliantToken} from "../src/CompliantToken.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {IAmlOracle} from "../src/interfaces/IAmlOracle.sol";

/// @notice Seeds a deployed stack into a demo-ready state on HashKey testnet.
///   forge script script/Bootstrap.s.sol --rpc-url hashkey_testnet --broadcast
contract Bootstrap is Script {
    uint8 internal constant DEMO_KYC_LEVEL = 2;
    uint16 internal constant DEMO_JURISDICTION = 392; // Japan
    uint64 internal constant DEMO_EXPIRY = 0; // no expiry
    uint8 internal constant DEMO_ALICE_RISK = 5;
    uint8 internal constant DEMO_BOB_RISK = 10;
    uint256 internal constant DEMO_MINT_AMOUNT = 1_000e18;
    bytes32 internal constant DEMO_MODEL_REF = keccak256("hashkey-testnet-demo-aml-v0.1");

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(pk);

        IdentityRegistry registry = IdentityRegistry(vm.envAddress("REGISTRY"));
        AmlOracle aml = AmlOracle(vm.envAddress("AML"));
        CompliantToken token = CompliantToken(vm.envAddress("TOKEN"));
        address demoAlice = vm.envAddress("DEMO_ALICE");
        address demoBob = vm.envAddress("DEMO_BOB");

        console.log("Bootstrap admin:", admin);
        console.log("Demo Alice     :", demoAlice);
        console.log("Demo Bob       :", demoBob);

        vm.startBroadcast(pk);

        _registerIdentityIfNeeded(registry, demoAlice);
        _registerIdentityIfNeeded(registry, demoBob);
        _attestRiskIfNeeded(aml, demoAlice, DEMO_ALICE_RISK);
        _attestRiskIfNeeded(aml, demoBob, DEMO_BOB_RISK);
        _mintIfNeeded(token, demoAlice, DEMO_MINT_AMOUNT);

        vm.stopBroadcast();
    }

    function _registerIdentityIfNeeded(IdentityRegistry registry, address account) internal {
        IIdentityRegistry.Identity memory identity = registry.identityOf(account);

        if (
            identity.kycLevel == DEMO_KYC_LEVEL && identity.jurisdiction == DEMO_JURISDICTION
                && identity.expiry == DEMO_EXPIRY && identity.whitelisted && !registry.isFrozen(account)
        ) {
            console.log("Identity ok    :", account);
            return;
        }

        registry.registerIdentity(account, DEMO_KYC_LEVEL, DEMO_JURISDICTION, DEMO_EXPIRY);
        console.log("Identity seeded:", account);
    }

    function _attestRiskIfNeeded(AmlOracle aml, address account, uint8 score) internal {
        IAmlOracle.RiskAttestation memory risk = aml.riskOf(account);
        if (risk.score == score && risk.modelRef == DEMO_MODEL_REF) {
            console.log("AML ok         :", account);
            return;
        }

        aml.attestRisk(account, score, DEMO_MODEL_REF);
        console.log("AML seeded     :", account);
    }

    function _mintIfNeeded(CompliantToken token, address to, uint256 targetAmount) internal {
        uint256 balance = token.balanceOf(to);
        if (balance >= targetAmount) {
            console.log("Balance ok     :", to);
            return;
        }

        token.mint(to, targetAmount - balance);
        console.log("Minted to      :", to);
    }
}

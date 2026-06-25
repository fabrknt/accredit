// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {AmlOracle} from "../src/AmlOracle.sol";
import {ModularCompliance} from "../src/ModularCompliance.sol";
import {CompliantToken} from "../src/CompliantToken.sol";

/// @notice E2E proof of the compliance gate: KYC + AML must both pass for a transfer.
contract ComplianceTest is Test {
    IdentityRegistry registry;
    AmlOracle aml;
    ModularCompliance compliance;
    CompliantToken token;

    address admin = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address mallory = address(0x4A11);

    bytes32 constant MODEL = keccak256("aml-v0.1");

    function setUp() public {
        registry = new IdentityRegistry(admin);
        aml = new AmlOracle(admin);
        compliance = new ModularCompliance(admin, registry, aml);
        token = new CompliantToken("Compliant HSP", "cHSP", admin, compliance);

        // Alice + Bob are fully onboarded: KYC level 2, AML clean.
        registry.registerIdentity(alice, 2, 392, 0); // 392 = Japan
        registry.registerIdentity(bob, 2, 392, 0);
        aml.attestRisk(alice, 5, MODEL);
        aml.attestRisk(bob, 10, MODEL);

        // Mint bypasses the gate (issuer provisioning).
        token.mint(alice, 1_000e18);
    }

    function test_transfer_succeeds_when_both_parties_compliant() public {
        vm.prank(alice);
        token.transfer(bob, 100e18);
        assertEq(token.balanceOf(bob), 100e18);
    }

    function test_transfer_reverts_when_recipient_not_kyc() public {
        vm.prank(alice);
        vm.expectRevert(bytes("recipient not KYC-verified"));
        token.transfer(mallory, 100e18);
    }

    function test_transfer_reverts_when_recipient_fails_aml() public {
        registry.registerIdentity(mallory, 2, 392, 0); // KYC ok...
        aml.attestRisk(mallory, 90, MODEL); // ...but flagged high-risk by AI-AML
        vm.prank(alice);
        vm.expectRevert(bytes("recipient failed AML screen"));
        token.transfer(mallory, 100e18);
    }

    function test_transfer_reverts_over_limit() public {
        compliance.setParams(1, 50, 30 days, 50e18);
        vm.prank(alice);
        vm.expectRevert(bytes("amount exceeds limit"));
        token.transfer(bob, 100e18);
    }

    function test_revoked_identity_blocks_transfer() public {
        registry.revokeIdentity(bob);
        vm.prank(alice);
        vm.expectRevert(bytes("recipient not KYC-verified"));
        token.transfer(bob, 100e18);
    }

    function test_mint_reverts_to_unverified_recipient() public {
        vm.expectRevert(bytes("recipient not KYC-verified"));
        token.mint(mallory, 100e18);
    }

    function test_frozen_address_cannot_send_or_receive() public {
        registry.setAddressFrozen(bob, true);
        vm.prank(alice);
        vm.expectRevert(bytes("recipient not KYC-verified"));
        token.transfer(bob, 100e18);

        registry.setAddressFrozen(bob, false);
        registry.setAddressFrozen(alice, true);
        vm.prank(alice);
        vm.expectRevert(bytes("sender not KYC-verified"));
        token.transfer(bob, 100e18);
    }

    function test_forcedTransfer_recovers_funds_bypassing_gate() public {
        // Alice's wallet is compromised and frozen; agent recovers to bob.
        registry.setAddressFrozen(alice, true);
        token.forcedTransfer(alice, bob, 100e18); // admin holds AGENT_ROLE
        assertEq(token.balanceOf(bob), 100e18);
        assertEq(token.balanceOf(alice), 900e18);
    }

    function test_forcedTransfer_only_agent() public {
        vm.prank(alice);
        vm.expectRevert();
        token.forcedTransfer(alice, bob, 100e18);
    }

    function test_self_burn_redemption() public {
        vm.prank(alice);
        token.burn(100e18);
        assertEq(token.balanceOf(alice), 900e18);
    }

    function test_frozen_holder_cannot_burn_to_escape_recovery() public {
        registry.setAddressFrozen(alice, true);
        vm.prank(alice);
        vm.expectRevert(bytes("account frozen"));
        token.burn(100e18);
    }

    function test_sanctioned_holder_cannot_burn() public {
        aml.attestRisk(alice, 90, MODEL); // AML-flagged but not frozen
        vm.prank(alice);
        vm.expectRevert(bytes("account failed AML screen"));
        token.burn(100e18);
    }

    function test_lapsed_kyc_holder_can_still_redeem() public {
        // expiry in the past => isVerified false, but redemption must not trap funds.
        registry.registerIdentity(alice, 2, 392, uint64(block.timestamp - 1));
        vm.prank(alice);
        token.burn(100e18);
        assertEq(token.balanceOf(alice), 900e18);
    }
}

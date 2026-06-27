// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {AmlOracle} from "../src/AmlOracle.sol";
import {ModularCompliance} from "../src/ModularCompliance.sol";
import {CompliantToken} from "../src/CompliantToken.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {CompliantWrapper} from "../src/CompliantWrapper.sol";

contract CompliantWrapperTest is Test {
    IdentityRegistry registry;
    AmlOracle aml;
    ModularCompliance compliance;
    CompliantToken token;
    MockUSDC underlying;
    CompliantWrapper wrapper;

    address admin = address(this);
    address alice = address(0xA11CE);
    address mallory = address(0x4A11);
    address spender = address(0xBEEF);

    bytes32 constant MODEL = keccak256("aml-v0.1");

    function setUp() public {
        registry = new IdentityRegistry(admin);
        aml = new AmlOracle(admin);
        compliance = new ModularCompliance(admin, registry, aml);
        token = new CompliantToken("Compliant USDC", "cUSDC", admin, compliance);
        underlying = new MockUSDC(admin);
        wrapper = new CompliantWrapper(underlying, token);

        token.grantRole(token.ISSUER_ROLE(), address(wrapper));

        registry.registerIdentity(alice, 2, 392, 0);
        aml.attestRisk(alice, 5, MODEL);

        underlying.mint(alice, 1_000e18);
    }

    function test_wrap_mints_cToken_and_locks_underlying_1_to_1() public {
        vm.startPrank(alice);
        underlying.approve(address(wrapper), 250e18);
        wrapper.wrap(250e18);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 250e18);
        assertEq(underlying.balanceOf(alice), 750e18);
        assertEq(underlying.balanceOf(address(wrapper)), 250e18);
        assertEq(token.totalSupply(), 250e18);
    }

    function test_wrap_reverts_for_recipient_not_kyc_verified() public {
        underlying.mint(mallory, 100e18);

        vm.startPrank(mallory);
        underlying.approve(address(wrapper), 100e18);
        vm.expectRevert(bytes("recipient not KYC-verified"));
        wrapper.wrap(100e18);
        vm.stopPrank();

        assertEq(token.balanceOf(mallory), 0);
        assertEq(underlying.balanceOf(address(wrapper)), 0);
        assertEq(underlying.balanceOf(mallory), 100e18);
    }

    function test_wrap_reverts_for_recipient_failing_aml() public {
        registry.registerIdentity(mallory, 2, 392, 0);
        aml.attestRisk(mallory, 90, MODEL);
        underlying.mint(mallory, 100e18);

        vm.startPrank(mallory);
        underlying.approve(address(wrapper), 100e18);
        vm.expectRevert(bytes("recipient failed AML screen"));
        wrapper.wrap(100e18);
        vm.stopPrank();

        assertEq(token.balanceOf(mallory), 0);
        assertEq(underlying.balanceOf(address(wrapper)), 0);
        assertEq(underlying.balanceOf(mallory), 100e18);
    }

    function test_unwrap_burns_cToken_and_returns_underlying_1_to_1() public {
        vm.startPrank(alice);
        underlying.approve(address(wrapper), 250e18);
        wrapper.wrap(250e18);
        token.approve(address(wrapper), 100e18);
        wrapper.unwrap(100e18);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 150e18);
        assertEq(underlying.balanceOf(alice), 850e18);
        assertEq(underlying.balanceOf(address(wrapper)), 150e18);
        assertEq(token.totalSupply(), 150e18);
    }

    function test_unwrap_reverts_without_allowance() public {
        vm.startPrank(alice);
        underlying.approve(address(wrapper), 250e18);
        wrapper.wrap(250e18);
        vm.expectRevert();
        wrapper.unwrap(100e18);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 250e18);
        assertEq(underlying.balanceOf(alice), 750e18);
        assertEq(underlying.balanceOf(address(wrapper)), 250e18);
    }

    function test_frozen_holder_cannot_unwrap() public {
        vm.startPrank(alice);
        underlying.approve(address(wrapper), 250e18);
        wrapper.wrap(250e18);
        token.approve(address(wrapper), 250e18);
        vm.stopPrank();

        registry.setAddressFrozen(alice, true);

        vm.prank(alice);
        vm.expectRevert(bytes("account frozen"));
        wrapper.unwrap(100e18);
    }

    function test_backing_invariant_holds_after_wrap_and_unwrap() public {
        vm.startPrank(alice);
        underlying.approve(address(wrapper), 400e18);
        wrapper.wrap(400e18);
        token.approve(address(wrapper), 125e18);
        wrapper.unwrap(125e18);
        vm.stopPrank();

        assertEq(underlying.balanceOf(address(wrapper)), token.totalSupply());
        assertEq(underlying.balanceOf(address(wrapper)), 275e18);
        assertEq(token.balanceOf(alice), 275e18);
    }

    function test_burnFrom_spends_allowance_correctly() public {
        token.mint(alice, 300e18);

        vm.prank(alice);
        token.approve(spender, 120e18);

        vm.prank(spender);
        token.burnFrom(alice, 100e18);

        assertEq(token.balanceOf(alice), 200e18);
        assertEq(token.allowance(alice, spender), 20e18);
        assertEq(token.totalSupply(), 200e18);
    }

    function test_burnFrom_is_canRedeem_gated() public {
        token.mint(alice, 300e18);
        aml.attestRisk(alice, 90, MODEL);

        vm.prank(alice);
        token.approve(spender, 100e18);

        vm.prank(spender);
        vm.expectRevert(bytes("account failed AML screen"));
        token.burnFrom(alice, 100e18);

        assertEq(token.balanceOf(alice), 300e18);
        assertEq(token.allowance(alice, spender), 100e18);
    }
}

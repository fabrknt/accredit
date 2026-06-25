// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {AmlOracle} from "../src/AmlOracle.sol";
import {ModularCompliance} from "../src/ModularCompliance.sol";
import {CompliantToken} from "../src/CompliantToken.sol";

/// @notice Deploys the accredit compliance stack to HashKey Chain.
///   forge script script/Deploy.s.sol --rpc-url hashkey_testnet --broadcast
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(pk);

        vm.startBroadcast(pk);

        IdentityRegistry registry = new IdentityRegistry(admin);
        AmlOracle aml = new AmlOracle(admin);
        ModularCompliance compliance = new ModularCompliance(admin, registry, aml);
        CompliantToken token = new CompliantToken("Compliant HSP", "cHSP", admin, compliance);

        vm.stopBroadcast();

        console.log("IdentityRegistry :", address(registry));
        console.log("AmlOracle        :", address(aml));
        console.log("ModularCompliance:", address(compliance));
        console.log("CompliantToken   :", address(token));
    }
}

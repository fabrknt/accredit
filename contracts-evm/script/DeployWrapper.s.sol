// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CompliantToken} from "../src/CompliantToken.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {CompliantWrapper} from "../src/CompliantWrapper.sol";

/// @notice Deploys MockUSDC + CompliantWrapper and authorizes the wrapper to mint cUSDC.
///   forge script script/DeployWrapper.s.sol --rpc-url hashkey_testnet --broadcast
contract DeployWrapper is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        CompliantToken token = CompliantToken(vm.envAddress("TOKEN"));
        address admin = vm.addr(pk);

        vm.startBroadcast(pk);

        MockUSDC underlying = new MockUSDC(admin);
        CompliantWrapper wrapper = new CompliantWrapper(underlying, token);
        token.grantRole(token.ISSUER_ROLE(), address(wrapper));

        vm.stopBroadcast();

        console.log("CompliantToken   :", address(token));
        console.log("MockUSDC          :", address(underlying));
        console.log("CompliantWrapper :", address(wrapper));
    }
}

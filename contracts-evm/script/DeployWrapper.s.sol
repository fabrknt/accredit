// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CompliantToken} from "../src/CompliantToken.sol";
import {MockHSP} from "../src/MockHSP.sol";
import {CompliantWrapper} from "../src/CompliantWrapper.sol";

/// @notice Deploys MockHSP + CompliantWrapper and authorizes the wrapper to mint cHSP.
///   forge script script/DeployWrapper.s.sol --rpc-url hashkey_testnet --broadcast
contract DeployWrapper is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        CompliantToken token = CompliantToken(vm.envAddress("TOKEN"));
        address admin = vm.addr(pk);

        vm.startBroadcast(pk);

        MockHSP underlying = new MockHSP(admin);
        CompliantWrapper wrapper = new CompliantWrapper(underlying, token);
        token.grantRole(token.ISSUER_ROLE(), address(wrapper));

        vm.stopBroadcast();

        console.log("CompliantToken   :", address(token));
        console.log("MockHSP          :", address(underlying));
        console.log("CompliantWrapper :", address(wrapper));
    }
}

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice Test-only stand-in for the real USDC token used in local tests and demo deploys.
contract MockUSDC is ERC20, Ownable {
    constructor(address admin) ERC20("Test USDC", "USDC") Ownable(admin) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

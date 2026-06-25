// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {CompliantToken} from "./CompliantToken.sol";

/// @title CompliantWrapper
/// @notice Wraps HSP 1:1 into compliance-gated cHSP and unwraps back to underlying.
contract CompliantWrapper {
    IERC20 public immutable underlying;
    CompliantToken public immutable cToken;

    event Wrapped(address indexed account, uint256 amount);
    event Unwrapped(address indexed account, uint256 amount);

    constructor(IERC20 underlying_, CompliantToken cToken_) {
        require(address(underlying_) != address(0), "CW: zero underlying");
        require(address(cToken_) != address(0), "CW: zero cToken");
        underlying = underlying_;
        cToken = cToken_;
    }

    function wrap(uint256 amount) external {
        require(underlying.transferFrom(msg.sender, address(this), amount), "CW: transferFrom failed");
        cToken.mint(msg.sender, amount);
        emit Wrapped(msg.sender, amount);
    }

    function unwrap(uint256 amount) external {
        cToken.burnFrom(msg.sender, amount);
        require(underlying.transfer(msg.sender, amount), "CW: transfer failed");
        emit Unwrapped(msg.sender, amount);
    }
}

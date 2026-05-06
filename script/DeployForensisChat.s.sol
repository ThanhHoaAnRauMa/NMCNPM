// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ForensisChat} from "../src/ForensisChat.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployForensisChat is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Implementation
        ForensisChat implementation = new ForensisChat();
        console2.log("Implementation deployed at:", address(implementation));

        // 2. Encode Initialization Data
        bytes memory initData = abi.encodeCall(ForensisChat.initialize, (deployerAddress));

        // 3. Deploy Proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        console2.log("Proxy deployed at:", address(proxy));

        vm.stopBroadcast();
    }
}

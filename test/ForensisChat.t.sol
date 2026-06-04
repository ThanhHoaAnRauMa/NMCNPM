// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {ForensisChat} from "../src/ForensisChat.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ForensisChatTest is Test {
    ForensisChat public implementation;
    ForensisChat public chat;

    address owner = address(this);
    address alice = address(0x1);
    address bob = address(0x2);
    address charlie = address(0x3);
    address nonParticipant = address(0x4);

    bytes32 roomId = bytes32(uint256(1));
    uint256 initialDisputeWindow = 1 hours;

    function setUp() public {
        implementation = new ForensisChat();
        
        // Encode initialization data
        bytes memory data = abi.encodeCall(ForensisChat.initialize, (owner));
        
        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), data);
        
        // Wrap proxy with interface
        chat = ForensisChat(address(proxy));
    }

    // ==========================================
    // INITIALIZATION & UPGRADES & PAUSABLE
    // ==========================================

    function test_Initialize_RevertAlreadyInitialized() public {
        vm.expectRevert();
        chat.initialize(owner);
    }

    function test_PauseUnpause() public {
        // Owner can pause
        chat.pause();
        assertTrue(chat.paused());

        // Functions revert when paused
        vm.startPrank(alice);
        address[] memory participants = new address[](1);
        participants[0] = bob;
        vm.expectRevert();
        chat.createRoom(roomId, participants, initialDisputeWindow);
        vm.stopPrank();

        // Owner unpauses
        chat.unpause();
        assertFalse(chat.paused());

        // Function succeeds
        vm.startPrank(alice);
        chat.createRoom(roomId, participants, initialDisputeWindow);
        vm.stopPrank();
    }

    function testRevert_PauseUnpause_NotOwner() public {
        vm.startPrank(alice);
        
        vm.expectRevert();
        chat.pause();
        
        vm.expectRevert();
        chat.unpause();
        
        vm.stopPrank();
    }

    function test_Upgrade_RevertNonOwner() public {
        ForensisChat newImpl = new ForensisChat();
        
        vm.startPrank(alice);
        vm.expectRevert();
        chat.upgradeToAndCall(address(newImpl), "");
        vm.stopPrank();
    }
    
    function test_Upgrade_OwnerSuccess() public {
        ForensisChat newImpl = new ForensisChat();
        chat.upgradeToAndCall(address(newImpl), "");
        // Should succeed without reverting
    }

    // ==========================================
    // ROOM CREATION
    // ==========================================

    function test_CreateRoom() public {
        vm.startPrank(alice);
        address[] memory participants = new address[](1);
        participants[0] = bob;

        chat.createRoom(roomId, participants, initialDisputeWindow);

        (bytes32 storedRoomId, address roomMaster, uint256 disputeWindow,,,,,,,, bool exists) = chat.rooms(roomId);

        assertEq(storedRoomId, roomId);
        assertEq(roomMaster, alice);
        assertEq(disputeWindow, initialDisputeWindow);
        assertTrue(exists);
        assertTrue(chat.isParticipant(roomId, alice));
        assertTrue(chat.isParticipant(roomId, bob));
        vm.stopPrank();
    }

    function testRevert_CreateRoom_AlreadyExists() public {
        test_CreateRoom();
        
        vm.startPrank(alice);
        address[] memory participants = new address[](1);
        participants[0] = bob;
        
        vm.expectRevert("Room already exists");
        chat.createRoom(roomId, participants, initialDisputeWindow);
        vm.stopPrank();
    }

    function testRevert_CreateRoom_NoParticipants() public {
        vm.startPrank(alice);
        address[] memory participants = new address[](0);
        
        vm.expectRevert("No participants provided");
        chat.createRoom(roomId, participants, initialDisputeWindow);
        vm.stopPrank();
    }

    // ==========================================
    // MODIFIERS
    // ==========================================

    function testRevert_RoomDoesNotExist() public {
        vm.expectRevert("Room does not exist");
        chat.executeConfig(roomId);
    }

    function testRevert_NotParticipant() public {
        test_CreateRoom();

        vm.startPrank(nonParticipant);
        vm.expectRevert("Not a room participant");
        chat.vetoConfig(roomId);
        vm.stopPrank();
    }

    function testRevert_NotRoomMaster() public {
        test_CreateRoom();

        vm.startPrank(bob);
        vm.expectRevert("Not the room master");
        chat.proposeConfig(roomId, 2 hours);
        vm.stopPrank();
    }

    // ==========================================
    // ROOM MASTER ACTIONS
    // ==========================================

    function test_AddParticipant_Success() public {
        test_CreateRoom();

        vm.startPrank(alice);
        chat.addParticipant(roomId, charlie);
        vm.stopPrank();

        assertTrue(chat.isParticipant(roomId, charlie));
    }

    function testRevert_AddParticipant_AlreadyParticipant() public {
        test_CreateRoom();

        vm.startPrank(alice);
        vm.expectRevert("Already a participant");
        chat.addParticipant(roomId, bob);
        vm.stopPrank();
    }

    function test_RemoveParticipant_Success() public {
        test_CreateRoom();

        vm.startPrank(alice);
        chat.removeParticipant(roomId, bob);
        vm.stopPrank();

        assertFalse(chat.isParticipant(roomId, bob));
    }

    function testRevert_RemoveParticipant_NotParticipant() public {
        test_CreateRoom();

        vm.startPrank(alice);
        vm.expectRevert("Not a participant");
        chat.removeParticipant(roomId, charlie);
        vm.stopPrank();
    }

    function testRevert_RemoveParticipant_MasterRemoveSelf() public {
        test_CreateRoom();

        vm.startPrank(alice);
        vm.expectRevert("Room master cannot remove themselves");
        chat.removeParticipant(roomId, alice);
        vm.stopPrank();
    }

    function test_TransferOwnership_Success() public {
        test_CreateRoom();

        vm.startPrank(alice);
        chat.transferRoomOwnership(roomId, bob);
        vm.stopPrank();

        (,address roomMaster,,,,,,,,,) = chat.rooms(roomId);
        assertEq(roomMaster, bob);
    }

    function testRevert_TransferOwnership_ZeroAddress() public {
        test_CreateRoom();

        vm.startPrank(alice);
        vm.expectRevert("Invalid address");
        chat.transferRoomOwnership(roomId, address(0));
        vm.stopPrank();
    }

    function testRevert_TransferOwnership_NotParticipant() public {
        test_CreateRoom();

        vm.startPrank(alice);
        vm.expectRevert("New master must be a participant");
        chat.transferRoomOwnership(roomId, charlie);
        vm.stopPrank();
    }

    // ==========================================
    // CONFIG PROPOSALS
    // ==========================================

    function test_ProposeConfigAndExecute() public {
        test_CreateRoom();

        vm.startPrank(alice);
        uint256 newWindow = 2 hours;
        chat.proposeConfig(roomId, newWindow);
        vm.stopPrank();
        
        skip(1 days); // Fast forward timelock
        
        chat.executeConfig(roomId);
        
        (,, uint256 currentWindow,,,,,,,,) = chat.rooms(roomId);
        assertEq(currentWindow, newWindow);
    }

    function testRevert_VetoConfig_NoProposal() public {
        test_CreateRoom();

        vm.startPrank(bob);
        vm.expectRevert("No config proposal pending");
        chat.vetoConfig(roomId);
        vm.stopPrank();
    }

    function test_VetoConfig_Success() public {
        test_CreateRoom();

        vm.startPrank(alice);
        chat.proposeConfig(roomId, 2 hours);
        vm.stopPrank();

        vm.startPrank(bob);
        chat.vetoConfig(roomId);
        vm.stopPrank();

        (,,,,, bool isConfigPending,,,,,) = chat.rooms(roomId);
        assertFalse(isConfigPending);
    }

    function testRevert_ExecuteConfig_NoProposal() public {
        test_CreateRoom();

        vm.expectRevert("No config proposal pending");
        chat.executeConfig(roomId);
    }

    function testRevert_ExecuteConfig_BeforeTimelock() public {
        test_CreateRoom();

        vm.startPrank(alice);
        chat.proposeConfig(roomId, 2 hours);
        vm.stopPrank();

        skip(23 hours); // Not 24 hours yet

        vm.expectRevert("Timelock not met");
        chat.executeConfig(roomId);
    }

    // ==========================================
    // MERKLE ROOT ACTIONS
    // ==========================================

    function test_ProposeRoot_Success() public {
        test_CreateRoom();

        bytes32 newRoot = bytes32(uint256(123));

        vm.startPrank(bob);
        chat.proposeRoot(roomId, newRoot);
        vm.stopPrank();

        (,,,,,,, bytes32 pendingRoot, address pendingRootProposer, uint256 pendingRootTimestamp, ) = chat.rooms(roomId);
        
        assertEq(pendingRoot, newRoot);
        assertEq(pendingRootProposer, bob);
        assertEq(pendingRootTimestamp, block.timestamp);
    }

    function test_ProposeRoot_AutoConfirmsPrevious() public {
        test_CreateRoom();

        bytes32 firstRoot = bytes32(uint256(111));
        bytes32 secondRoot = bytes32(uint256(222));

        vm.startPrank(bob);
        chat.proposeRoot(roomId, firstRoot);
        vm.stopPrank();

        // Fast forward past dispute window
        skip(initialDisputeWindow + 1);

        // Alice proposes a new root, which should auto-confirm the first one
        vm.startPrank(alice);
        chat.proposeRoot(roomId, secondRoot);
        vm.stopPrank();

        (,,,,,, bytes32 confirmedRoot, bytes32 pendingRoot, , , ) = chat.rooms(roomId);
        
        assertEq(confirmedRoot, firstRoot);
        assertEq(pendingRoot, secondRoot);
    }

    function test_ConfirmRoot_Success() public {
        test_CreateRoom();

        bytes32 newRoot = bytes32(uint256(123));

        vm.startPrank(bob);
        chat.proposeRoot(roomId, newRoot);
        vm.stopPrank();

        skip(initialDisputeWindow + 1);

        vm.startPrank(alice); 
        chat.confirmRoot(roomId);
        vm.stopPrank();

        (,,,,,, bytes32 confirmedRoot, bytes32 pendingRoot, , , ) = chat.rooms(roomId);
        assertEq(confirmedRoot, newRoot);
        assertEq(pendingRoot, bytes32(0)); 
    }

    function testRevert_ConfirmRoot_NoPendingRoot() public {
        test_CreateRoom();

        vm.startPrank(alice);
        vm.expectRevert("No pending root");
        chat.confirmRoot(roomId);
        vm.stopPrank();
    }

    function testRevert_ConfirmRoot_WindowActive() public {
        test_CreateRoom();

        bytes32 newRoot = bytes32(uint256(123));

        vm.startPrank(bob);
        chat.proposeRoot(roomId, newRoot);
        vm.stopPrank();

        // Do not skip time

        vm.startPrank(alice);
        vm.expectRevert("Dispute window still active");
        chat.confirmRoot(roomId);
        vm.stopPrank();
    }

    function test_DisputeRoot_Success() public {
        test_CreateRoom();

        bytes32 newRoot = bytes32(uint256(123));

        vm.startPrank(alice);
        chat.proposeRoot(roomId, newRoot);
        vm.stopPrank();

        vm.startPrank(bob);
        chat.disputeRoot(roomId);
        vm.stopPrank();

        (,,,,,, bytes32 confirmedRoot, bytes32 pendingRoot, , , ) = chat.rooms(roomId);
        
        assertEq(confirmedRoot, bytes32(0));
        assertEq(pendingRoot, bytes32(0)); 
    }

    function testRevert_DisputeRoot_NoPendingRoot() public {
        test_CreateRoom();

        vm.startPrank(bob);
        vm.expectRevert("No pending root to dispute");
        chat.disputeRoot(roomId);
        vm.stopPrank();
    }

    function testRevert_DisputeRoot_WindowClosed() public {
        test_CreateRoom();

        bytes32 newRoot = bytes32(uint256(123));

        vm.startPrank(alice);
        chat.proposeRoot(roomId, newRoot);
        vm.stopPrank();

        skip(initialDisputeWindow + 1);

        vm.startPrank(bob);
        vm.expectRevert("Dispute window has already closed");
        chat.disputeRoot(roomId);
        vm.stopPrank();
    }
    
    function testRevert_DisputeRoot_OwnRoot() public {
        test_CreateRoom();
        bytes32 newRoot = bytes32(uint256(123));

        vm.startPrank(alice);
        chat.proposeRoot(roomId, newRoot);
        
        vm.expectRevert("Proposer cannot dispute their own root");
        chat.disputeRoot(roomId); 
        vm.stopPrank();
    }

    // ==========================================
    // VERIFY PROOF
    // ==========================================

    function test_VerifyProof_Success() public {
        test_CreateRoom();

        bytes32 leaf = bytes32(uint256(999));
        
        // For a single node tree, leaf == root, and proof is empty
        bytes32 newRoot = leaf;

        vm.startPrank(bob);
        chat.proposeRoot(roomId, newRoot);
        vm.stopPrank();

        skip(initialDisputeWindow + 1);
        
        vm.startPrank(alice);
        chat.confirmRoot(roomId);
        vm.stopPrank();

        bytes32[] memory emptyProof = new bytes32[](0);
        bool isValid = chat.verifyProof(roomId, leaf, emptyProof);
        assertTrue(isValid);
    }

    function test_VerifyProof_False() public {
        test_CreateRoom();

        bytes32 leaf = bytes32(uint256(999));
        bytes32 newRoot = bytes32(uint256(888)); // Different root

        vm.startPrank(bob);
        chat.proposeRoot(roomId, newRoot);
        vm.stopPrank();

        skip(initialDisputeWindow + 1);
        
        vm.startPrank(alice);
        chat.confirmRoot(roomId);
        vm.stopPrank();

        bytes32[] memory emptyProof = new bytes32[](0);
        bool isValid = chat.verifyProof(roomId, leaf, emptyProof);
        assertFalse(isValid);
    }

    function testRevert_VerifyProof_NoConfirmedRoot() public {
        test_CreateRoom();

        bytes32 leaf = bytes32(uint256(999));
        bytes32[] memory emptyProof = new bytes32[](0);

        vm.expectRevert("No confirmed root for this room");
        chat.verifyProof(roomId, leaf, emptyProof);
    }
}

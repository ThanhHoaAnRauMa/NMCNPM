// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title ForensisChat
 * @dev Manages chat rooms, their configurations, and Merkle root commits for forensics.
 *      Upgradeable using UUPS and Pausable in case of emergencies.
 */
contract ForensisChat is Initializable, OwnableUpgradeable, PausableUpgradeable, UUPSUpgradeable {

    uint256 public constant CONFIG_TIMELOCK = 1 days;

    struct Room {
        bytes32 roomId;
        address roomMaster;
        uint256 disputeWindow; // Time in seconds allowed to dispute a proposed root
        
        // Config Proposal
        uint256 pendingDisputeWindow;
        uint256 configProposalTimestamp;
        bool isConfigPending;

        // Merkle Root
        bytes32 confirmedRoot;
        bytes32 pendingRoot;
        address pendingRootProposer;
        uint256 pendingRootTimestamp;
        
        bool exists;
    }

    // Mapping from roomId to Room details
    mapping(bytes32 => Room) public rooms;
    
    // Mapping to check if an address is a participant of a room
    // roomId => participantAddress => bool
    mapping(bytes32 => mapping(address => bool)) public isParticipant;

    // Events
    event RoomCreated(bytes32 indexed roomId, address indexed roomMaster, uint256 disputeWindow);
    event ParticipantAdded(bytes32 indexed roomId, address indexed participant);
    event ParticipantRemoved(bytes32 indexed roomId, address indexed participant);
    event RoomMasterTransferred(bytes32 indexed roomId, address indexed oldMaster, address indexed newMaster);
    
    event ConfigProposed(bytes32 indexed roomId, uint256 newDisputeWindow, uint256 timelockEnd);
    event ConfigVetoed(bytes32 indexed roomId, address indexed participant);
    event ConfigExecuted(bytes32 indexed roomId, uint256 newDisputeWindow);

    event RootProposed(bytes32 indexed roomId, bytes32 indexed root, address indexed proposer, uint256 timestamp);
    event RootConfirmed(bytes32 indexed roomId, bytes32 indexed root);
    event RootDisputed(bytes32 indexed roomId, bytes32 indexed root, address indexed disputer);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract.
     * @param initialOwner The address of the initial owner.
     */
    function initialize(address initialOwner) initializer public {
        __Ownable_init(initialOwner);
        __Pausable_init();
    }

    // Modifiers
    modifier onlyParticipant(bytes32 roomId) {
        require(isParticipant[roomId][msg.sender], "Not a room participant");
        _;
    }

    modifier onlyRoomMaster(bytes32 roomId) {
        require(rooms[roomId].roomMaster == msg.sender, "Not the room master");
        _;
    }

    modifier roomExists(bytes32 roomId) {
        require(rooms[roomId].exists, "Room does not exist");
        _;
    }

    // Owner Functions
    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // Core Functions

    /**
     * @dev Creates a new room. The creator automatically becomes the room master.
     */
    function createRoom(bytes32 roomId, address[] calldata participants, uint256 disputeWindow) external whenNotPaused {
        require(!rooms[roomId].exists, "Room already exists");
        require(participants.length > 0, "No participants provided");

        rooms[roomId] = Room({
            roomId: roomId,
            roomMaster: msg.sender,
            disputeWindow: disputeWindow,
            pendingDisputeWindow: 0,
            configProposalTimestamp: 0,
            isConfigPending: false,
            confirmedRoot: bytes32(0),
            pendingRoot: bytes32(0),
            pendingRootProposer: address(0),
            pendingRootTimestamp: 0,
            exists: true
        });

        // Add the creator as a participant automatically
        isParticipant[roomId][msg.sender] = true;
        emit ParticipantAdded(roomId, msg.sender);

        for (uint i = 0; i < participants.length; i++) {
            if (!isParticipant[roomId][participants[i]]) {
                isParticipant[roomId][participants[i]] = true;
                emit ParticipantAdded(roomId, participants[i]);
            }
        }

        emit RoomCreated(roomId, msg.sender, disputeWindow);
    }

    // ==========================================
    // ROOM MASTER ACTIONS
    // ==========================================

    function addParticipant(bytes32 roomId, address participant) external whenNotPaused roomExists(roomId) onlyRoomMaster(roomId) {
        require(!isParticipant[roomId][participant], "Already a participant");
        isParticipant[roomId][participant] = true;
        emit ParticipantAdded(roomId, participant);
    }

    function removeParticipant(bytes32 roomId, address participant) external whenNotPaused roomExists(roomId) onlyRoomMaster(roomId) {
        require(isParticipant[roomId][participant], "Not a participant");
        require(participant != msg.sender, "Room master cannot remove themselves");
        isParticipant[roomId][participant] = false;
        emit ParticipantRemoved(roomId, participant);
    }

    function transferRoomOwnership(bytes32 roomId, address newMaster) external whenNotPaused roomExists(roomId) onlyRoomMaster(roomId) {
        require(newMaster != address(0), "Invalid address");
        require(isParticipant[roomId][newMaster], "New master must be a participant");
        
        address oldMaster = rooms[roomId].roomMaster;
        rooms[roomId].roomMaster = newMaster;
        emit RoomMasterTransferred(roomId, oldMaster, newMaster);
    }

    // ==========================================
    // CONFIG PROPOSALS (TIMELOCK)
    // ==========================================

    /**
     * @dev Proposes a new dispute window configuration. Starts the 1-day timelock.
     */
    function proposeConfig(bytes32 roomId, uint256 newDisputeWindow) external whenNotPaused roomExists(roomId) onlyRoomMaster(roomId) {
        Room storage room = rooms[roomId];
        room.pendingDisputeWindow = newDisputeWindow;
        room.configProposalTimestamp = block.timestamp;
        room.isConfigPending = true;

        emit ConfigProposed(roomId, newDisputeWindow, block.timestamp + CONFIG_TIMELOCK);
    }

    /**
     * @dev Any participant can veto the room master's config proposal.
     */
    function vetoConfig(bytes32 roomId) external whenNotPaused roomExists(roomId) onlyParticipant(roomId) {
        Room storage room = rooms[roomId];
        require(room.isConfigPending, "No config proposal pending");
        
        room.isConfigPending = false;
        room.pendingDisputeWindow = 0;
        room.configProposalTimestamp = 0;

        emit ConfigVetoed(roomId, msg.sender);
    }

    /**
     * @dev Executes the config proposal if the 1-day timelock has passed and it wasn't vetoed.
     */
    function executeConfig(bytes32 roomId) external whenNotPaused roomExists(roomId) {
        Room storage room = rooms[roomId];
        require(room.isConfigPending, "No config proposal pending");
        require(block.timestamp >= room.configProposalTimestamp + CONFIG_TIMELOCK, "Timelock not met");

        room.disputeWindow = room.pendingDisputeWindow;
        
        room.isConfigPending = false;
        room.pendingDisputeWindow = 0;
        room.configProposalTimestamp = 0;

        emit ConfigExecuted(roomId, room.disputeWindow);
    }

    // ==========================================
    // MERKLE ROOT ACTIONS
    // ==========================================

    /**
     * @dev Any participant can propose a new Merkle root for the conversation log.
     */
    function proposeRoot(bytes32 roomId, bytes32 newRoot) external whenNotPaused roomExists(roomId) onlyParticipant(roomId) {
        Room storage room = rooms[roomId];
        
        // Auto-confirm previous pending root if the window has passed and no one disputed
        if (room.pendingRootTimestamp != 0 && block.timestamp > room.pendingRootTimestamp + room.disputeWindow) {
            room.confirmedRoot = room.pendingRoot;
            emit RootConfirmed(roomId, room.pendingRoot);
        }

        room.pendingRoot = newRoot;
        room.pendingRootProposer = msg.sender;
        room.pendingRootTimestamp = block.timestamp;

        emit RootProposed(roomId, newRoot, msg.sender, block.timestamp);
    }

    /**
     * @dev Any participant (except the proposer) can dispute a pending root.
     */
    function disputeRoot(bytes32 roomId) external whenNotPaused roomExists(roomId) onlyParticipant(roomId) {
        Room storage room = rooms[roomId];
        require(room.pendingRootTimestamp != 0, "No pending root to dispute");
        require(block.timestamp <= room.pendingRootTimestamp + room.disputeWindow, "Dispute window has already closed");
        require(msg.sender != room.pendingRootProposer, "Proposer cannot dispute their own root");

        bytes32 disputedRoot = room.pendingRoot;
        
        // Reset pending root state
        room.pendingRoot = bytes32(0);
        room.pendingRootProposer = address(0);
        room.pendingRootTimestamp = 0;

        emit RootDisputed(roomId, disputedRoot, msg.sender);
    }
    
    /**
     * @dev Explicitly confirms a pending root if the dispute window has passed.
     */
    function confirmRoot(bytes32 roomId) external whenNotPaused roomExists(roomId) onlyParticipant(roomId) {
        Room storage room = rooms[roomId];
        require(room.pendingRootTimestamp != 0, "No pending root");
        require(block.timestamp > room.pendingRootTimestamp + room.disputeWindow, "Dispute window still active");

        room.confirmedRoot = room.pendingRoot;
        bytes32 confirmed = room.pendingRoot;
        
        // Reset pending root state
        room.pendingRoot = bytes32(0);
        room.pendingRootProposer = address(0);
        room.pendingRootTimestamp = 0;

        emit RootConfirmed(roomId, confirmed);
    }

    /**
     * @dev Verifies that a given leaf belongs to the room's current confirmed root.
     */
    function verifyProof(bytes32 roomId, bytes32 leaf, bytes32[] calldata proof) external view roomExists(roomId) returns (bool) {
        bytes32 root = rooms[roomId].confirmedRoot;
        require(root != bytes32(0), "No confirmed root for this room");
        
        return MerkleProof.verify(proof, root, leaf);
    }
}

import { ethers } from "ethers";
import { MerkleTree } from "merkletreejs";
import fs from "fs";
import path from "path";
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ABI dynamically from the Foundry output
const abiPath = path.resolve(__dirname, '../out/ForensisChat.sol/ForensisChat.json');
let ABI;
try {
    const contractJson = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    ABI = contractJson.abi;
} catch (e) {
    console.error("Warning: Could not load ABI from " + abiPath + ". Please ensure you have compiled the contracts with Foundry ('forge build').");
}

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY ? process.env.RELAYER_PRIVATE_KEY.trim() : null;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS ? process.env.CONTRACT_ADDRESS.trim() : null;

let provider, wallet, contract;

if (RPC_URL && PRIVATE_KEY && CONTRACT_ADDRESS && ABI) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
} else {
    console.warn("SDK initialized without full configuration. Some features may not work until .env is set and ABI is available.");
}

export { provider, wallet, contract, ABI };

// ==========================================
// A. Room & Participant Management
// ==========================================

export async function createRoomOnChain(roomId, participants, disputeWindow) {
    const tx = await contract.createRoom(roomId, participants, disputeWindow);
    return await tx.wait(1);
}

export async function addParticipantOnChain(roomId, participant) {
    const tx = await contract.addParticipant(roomId, participant);
    return await tx.wait(1);
}

export async function removeParticipantOnChain(roomId, participant) {
    const tx = await contract.removeParticipant(roomId, participant);
    return await tx.wait(1);
}

export async function transferRoomOwnershipOnChain(roomId, newMaster) {
    const tx = await contract.transferRoomOwnership(roomId, newMaster);
    return await tx.wait(1);
}

// ==========================================
// B. Configuration (Timelocks)
// ==========================================

export async function proposeRoomConfig(roomId, newDisputeWindow) {
    const tx = await contract.proposeConfig(roomId, newDisputeWindow);
    return await tx.wait(1);
}

export async function vetoRoomConfig(roomId) {
    const tx = await contract.vetoConfig(roomId);
    return await tx.wait(1);
}

export async function executeRoomConfig(roomId) {
    const tx = await contract.executeConfig(roomId);
    return await tx.wait(1);
}

// ==========================================
// C. Merkle Root Lifecycle (Forensics Core)
// ==========================================

export function buildMerkleTree(messagesArray) {
    // Assumes messagesArray contains objects. We hash their stringified JSON.
    const leaves = messagesArray.map(msg => ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(msg))));
    const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
    return { tree, leaves };
}

export async function proposeMerkleRoot(roomId, messagesArray) {
    const { tree } = buildMerkleTree(messagesArray);
    const rootHash = tree.getHexRoot();
    const tx = await contract.proposeRoot(roomId, rootHash);
    return await tx.wait(1);
}

export async function disputeMerkleRoot(roomId) {
    const tx = await contract.disputeRoot(roomId);
    return await tx.wait(1);
}

export async function confirmMerkleRoot(roomId) {
    const tx = await contract.confirmRoot(roomId);
    return await tx.wait(1);
}

export async function verifyMessageProof(roomId, leafHash, proof) {
    return await contract.verifyProof(roomId, leafHash, proof);
}

// ==========================================
// D. Admin & Emergency Functions
// ==========================================

export async function pauseContract() {
    const tx = await contract.pause();
    return await tx.wait(1);
}

export async function unpauseContract() {
    const tx = await contract.unpause();
    return await tx.wait(1);
}

// ==========================================
// E. Read-Only Helpers (View Functions)
// ==========================================

export async function getRoomDetails(roomId) {
    return await contract.rooms(roomId);
}

export async function isUserParticipant(roomId, userAddress) {
    return await contract.isParticipant(roomId, userAddress);
}

// ==========================================
// F. Event Listener Hooks
// ==========================================

export function setupBlockchainListeners(callbacks = {}) {
    if (callbacks.onRoomCreated) contract.on("RoomCreated", callbacks.onRoomCreated);
    if (callbacks.onParticipantAdded) contract.on("ParticipantAdded", callbacks.onParticipantAdded);
    if (callbacks.onParticipantRemoved) contract.on("ParticipantRemoved", callbacks.onParticipantRemoved);
    if (callbacks.onRoomMasterTransferred) contract.on("RoomMasterTransferred", callbacks.onRoomMasterTransferred);
    
    if (callbacks.onConfigProposed) contract.on("ConfigProposed", callbacks.onConfigProposed);
    if (callbacks.onConfigVetoed) contract.on("ConfigVetoed", callbacks.onConfigVetoed);
    if (callbacks.onConfigExecuted) contract.on("ConfigExecuted", callbacks.onConfigExecuted);
    
    if (callbacks.onRootProposed) contract.on("RootProposed", callbacks.onRootProposed);
    if (callbacks.onRootConfirmed) contract.on("RootConfirmed", callbacks.onRootConfirmed);
    if (callbacks.onRootDisputed) contract.on("RootDisputed", callbacks.onRootDisputed);
}

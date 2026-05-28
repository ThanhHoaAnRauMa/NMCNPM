import { 
    createRoomOnChain, 
    getRoomDetails, 
    setupBlockchainListeners, 
    proposeMerkleRoot 
} from './index.js';
import { ethers } from 'ethers';

async function runTest() {
    console.log("Starting SDK Test...");

    // 1. Setup Event Listeners
    setupBlockchainListeners({
        onRoomCreated: (roomId, master, window) => {
            console.log(`\n[EVENT] Room Created! ID: ${roomId}, Master: ${master}, Window: ${window} seconds`);
        },
        onRootProposed: (roomId, root, proposer, timestamp) => {
            console.log(`\n[EVENT] Merkle Root Proposed! Room: ${roomId}, Root: ${root}`);
        }
    });

    // 2. Generate a random Room ID (bytes32)
    const roomId = ethers.keccak256(ethers.toUtf8Bytes("TestRoom123"));
    const dummyParticipant = ethers.Wallet.createRandom().address;
    
    console.log(`\n--- Creating Room ${roomId} ---`);
    try {
        const createTx = await createRoomOnChain(roomId, [dummyParticipant], 86400);
        console.log("Room Created Successfully. Tx Hash:", createTx.hash);
        
        // Wait a second to allow event listener to fire
        await new Promise(r => setTimeout(r, 1000));

        // 3. Check Room Details
        console.log(`\n--- Fetching Room Details ---`);
        const details = await getRoomDetails(roomId);
        console.log("Is Room Active?", details.exists);

        // 4. Propose a Merkle Root
        console.log(`\n--- Proposing Merkle Root ---`);
        const mockMessages = [
            { id: 1, text: "Hello" },
            { id: 2, text: "World" }
        ];
        const proposeTx = await proposeMerkleRoot(roomId, mockMessages);
        console.log("Merkle Root Proposed Successfully. Tx Hash:", proposeTx.hash);

        // Wait a second to allow event listener to fire
        await new Promise(r => setTimeout(r, 1000));
        
        console.log("\nTest Completed Successfully!");
        process.exit(0);

    } catch (error) {
        console.error("\nTest Failed:", error.message);
        process.exit(1);
    }
}

runTest();

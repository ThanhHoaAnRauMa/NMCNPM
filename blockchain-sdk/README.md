# ForensisChat Blockchain SDK

This is the pure JavaScript library that bridges the Node.js backend (or client) with the `ForensisChat.sol` smart contract on the Sepolia network. It abstracts away all Web3 and ethers.js logic.

## 1. Setup & Installation

1. Navigate to this directory and install dependencies:

   ```bash
   cd blockchain-sdk
   npm install
   ```

2. Create a `.env` file in the `blockchain-sdk` directory (use `.env.example` as a template):
   ```env
   RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
   RELAYER_PRIVATE_KEY=0x_your_private_key_here
   CONTRACT_ADDRESS=0x6B8F21f887c6d141C101B2aD03B654d43Fc60eb0
   ```

_Note: The SDK dynamically loads the smart contract ABI directly from the Foundry `out/` directory. Ensure you have run `forge build` in the main project folder._

---

## 2. Usage / Importing

Because this SDK uses ES Modules (`"type": "module"`), you can import the exact functions you need anywhere in your backend:

```javascript
import {
  createRoomOnChain,
  proposeMerkleRoot,
  setupBlockchainListeners,
} from "./blockchain-sdk/index.js";
```

---

## 3. Available Functions

All state-changing functions automatically sign the transaction using the `RELAYER_PRIVATE_KEY` and return the transaction receipt after it has been mined.

### A. Room & Participant Management

- **`createRoomOnChain(roomId, participants, disputeWindow)`**: Initializes a new room. `roomId` is a bytes32 string, `participants` is an array of addresses, and `disputeWindow` is the timelock in seconds.
- **`addParticipantOnChain(roomId, participantAddress)`**
- **`removeParticipantOnChain(roomId, participantAddress)`**
- **`transferRoomOwnershipOnChain(roomId, newMasterAddress)`**

### B. Merkle Root Forensics

- **`proposeMerkleRoot(roomId, messagesArray)`**: Takes a raw array of message objects, builds a Merkle Tree automatically, hashes the root, and proposes it on-chain.
- **`disputeMerkleRoot(roomId)`**: Disputes a pending root before the dispute window closes.
- **`confirmMerkleRoot(roomId)`**: Confirms a root after the dispute window safely closes.
- **`verifyMessageProof(roomId, leafHash, proof)`**: Returns `true` if a specific message hash was included in the confirmed root.

### C. Configuration & Timelocks

- **`proposeRoomConfig(roomId, newDisputeWindow)`**
- **`vetoRoomConfig(roomId)`**
- **`executeRoomConfig(roomId)`**

### D. Admin / Read-Only

- **`pauseContract()` / `unpauseContract()`**: Triggers emergency circuit breaker.
- **`getRoomDetails(roomId)`**: Returns the smart contract struct for a room.
- **`isUserParticipant(roomId, userAddress)`**: Returns a boolean.

---

## 4. Event Listeners (For Database Syncing)

The SDK provides a powerful `setupBlockchainListeners` function. The backend should call this once on server startup. You pass in a dictionary of callbacks, and the SDK will automatically trigger your backend functions whenever a blockchain event occurs.

**Example Implementation in Backend:**

```javascript
import { setupBlockchainListeners } from "./blockchain-sdk/index.js";

setupBlockchainListeners({
  onRoomCreated: (roomId, master, window) => {
    console.log(`Room ${roomId} created on-chain by ${master}`);
    // update MongoDB...
  },
  onRootDisputed: (roomId, root, disputer) => {
    console.warn(`WARNING: Root ${root} disputed by ${disputer}!`);
    // update MongoDB to mark chat as compromised...
  },
});
```

### Supported Event Hooks

`onRoomCreated`, `onParticipantAdded`, `onParticipantRemoved`, `onRoomMasterTransferred`, `onConfigProposed`, `onConfigVetoed`, `onConfigExecuted`, `onRootProposed`, `onRootConfirmed`, `onRootDisputed`.

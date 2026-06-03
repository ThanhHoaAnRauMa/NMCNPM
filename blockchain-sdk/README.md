# ForensisChat Blockchain SDK

This is the pure JavaScript library that bridges the Node.js backend (or client) with the `ForensisChat.sol` smart contract. It abstracts away all Web3 and ethers.js logic.

## 1. Setup & Installation

1. Navigate to this directory and install dependencies:

   ```bash
   cd blockchain-sdk
   npm install
   ```

2. Create a `.env` file in the `blockchain-sdk` directory (use `.env.example` as a template):

   ```env
   RPC_URL=http://127.0.0.1:9999
   RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   CONTRACT_ADDRESS=<Deployed_Proxy_Address>
   ```

_Note: The SDK dynamically loads the smart contract ABI directly from the Foundry `out/` directory. Ensure you have run `forge build` in the main project folder._

---

## 2. Running Tests

To verify the SDK functionality against the smart contract, we use a local Anvil instance to manage blockchain state (including timelock manipulation).

### Prerequisites

1. **Start Anvil:** You must start Anvil with a 1-second block time to ensure robust transaction processing in tests:

   ```bash
   anvil --port 9999 --gas-limit 30000000 --base-fee 0 --block-time 1
   ```

2. **Deploy Contract:** In a separate terminal, deploy the contract to the local Anvil instance:

   ```bash
   forge script script/DeployForensisChat.s.sol --rpc-url http://127.0.0.1:9999 --broadcast --unlocked --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --legacy
   ```

   Copy the `Proxy deployed at: ...` address and update your `.env` file with it.

### Running the Test Suite

From the `blockchain-sdk` directory:

```bash
npm test
```

## 3. Usage / Importing

Because this SDK uses ES Modules (`"type": "module"`), you can import the exact functions you need anywhere in your backend:

```javascript
import {
  createRoomOnChain,
  proposeMerkleRoot,
  setupBlockchainListeners,
} from "./blockchain-sdk/index.js";
```

## 4. Available Functions

All state-changing functions automatically sign the transaction using the `RELAYER_PRIVATE_KEY` and return the transaction receipt after it has been mined.

### A. Room & Participant Management

- **`createRoomOnChain(roomId, participants, disputeWindow)`**
- **`addParticipantOnChain(roomId, participantAddress)`**
- **`removeParticipantOnChain(roomId, participantAddress)`**
- **`transferRoomOwnershipOnChain(roomId, newMasterAddress)`**

### B. Merkle Root Forensics

- **`proposeMerkleRoot(roomId, messagesArray)`**
- **`disputeMerkleRoot(roomId)`**
- **`confirmMerkleRoot(roomId)`**
- **`verifyMessageProof(roomId, leafHash, proof)`**

### C. Configuration & Timelocks

- **`proposeRoomConfig(roomId, newDisputeWindow)`**
- **`vetoRoomConfig(roomId)`**
- **`executeRoomConfig(roomId)`**

### D. Admin / Read-Only

- **`pauseContract()` / `unpauseContract()`**
- **`getRoomDetails(roomId)`**
- **`isUserParticipant(roomId, userAddress)`**

---

## 5. Event Listeners (For Database Syncing)

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

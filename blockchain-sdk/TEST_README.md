# Testing the Blockchain SDK Locally

This guide explains how to test the ForensisChat Blockchain SDK on your local machine without spending real Sepolia ETH or waiting for slow block confirmations.

## Prerequisites

- You must have [Foundry](https://book.getfoundry.sh/) installed (`anvil`, `forge`, `cast`).
- Node.js installed.

---

## Step 1: Start the Local Blockchain (Anvil)

Open a new terminal at the root of the project (`c:\Code\Solidity\forensis-chat`) and start a local node:

```bash
anvil
```

_Leave this terminal window running in the background. Anvil automatically gives you 10 test accounts with 10,000 ETH each._

---

## Step 2: Deploy the Smart Contract to Anvil

Open a **second terminal** at the root of the project.

Because your deployment script reads `PRIVATE_KEY` from your root `.env` (which is your real Sepolia key with 0 local ETH), you must temporarily override the environment variable to use Anvil's rich Default Account #0.

**If you are using Git Bash or Linux/Mac:**
Run this exact command:

```bash
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" forge script script/DeployForensisChat.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

Once the script finishes, look at the terminal output and **copy the Proxy Address**:

> `Proxy deployed at: 0x...`

---

## Step 3: Configure the SDK Environment

Navigate into the `blockchain-sdk` folder.

1. Duplicate the `.env.example` file and name it `.env`.
2. Edit the `.env` file with your local Anvil details:

```env
RPC_URL=http://127.0.0.1:8545
RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONTRACT_ADDRESS=0x<PASTE_THE_PROXY_ADDRESS_FROM_STEP_2_HERE>
```

---

## Step 4: Run the Test Script

Ensure you have installed the npm dependencies if you haven't already:

```bash
cd blockchain-sdk
npm install
```

Now, run the integration test:

```bash
node test.js
```

### What `test.js` actually does:

1. **Event Listeners**: Hooks into `RoomCreated` and `RootProposed` to listen for on-chain events.
2. **Room Creation**: Calls `createRoomOnChain()` generating a random Room ID.
3. **State Verification**: Calls `getRoomDetails()` to prove the room was saved on the blockchain.
4. **Merkle Trees**: Takes dummy chat messages, builds a Merkle Tree, and calls `proposeMerkleRoot()`.
5. **Success Validation**: If everything works, it exits cleanly and prints `Test Completed Successfully!`.

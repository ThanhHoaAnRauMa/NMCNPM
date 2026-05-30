# ForensisChat Smart Contracts

ForensisChat is the on-chain dispute and configuration resolution layer for a privacy-first, forensic-ready secure messaging application. It acts as a mathematically proven, immutable contract governing the integrity and sequence of conversations between parties.

## Architecture

To bridge the gap between absolute privacy (like Telegram) and centralized convenience (like Messenger), ForensisChat implements a decentralized "Merkle Root Committing" architecture:

1. **Local P2P Execution:** Messages are exchanged off-chain. Each message is end-to-end encrypted, hashed, and signed by the sender's private key. Both parties maintain a local log.
2. **Merkle Trees:** Periodically, participants hash their local conversation log into a Merkle Tree.
3. **On-Chain Commits:** A participant proposes the Merkle Root of their conversation to this smart contract (`proposeRoot`).
4. **Dispute Window:** A time-bound dispute window allows any other participant to dispute the proposed root (`disputeRoot`) if it does not match their local mathematically-verified log.
5. **Confirmation:** If the dispute window elapses without objection, the root is permanently confirmed (`confirmRoot` or auto-confirmed on next proposal), establishing a legally verifiable point-in-time snapshot of the conversation.

## Features

- **Room Master Role:** The room creator acts as the room master, who can add/remove participants, configure the dispute window, and transfer ownership.
- **Config Timelock:** Any changes to the dispute window parameter enforce a 1-day timelock (`CONFIG_TIMELOCK = 1 days`), ensuring participants cannot be blindsided by sudden parameter changes.
- **Participant Vetoes:** Participants can veto config proposals before the 1-day timelock executes.
- **Proof Verification:** An on-chain getter (`verifyProof`) is available to independently verify if a specific message leaf belongs to the confirmed root.
- **Upgradable & Pausable:** Utilizes OpenZeppelin's UUPS proxy architecture and `Pausable` for future updates and emergency stops.

## Getting Started

### Prerequisites

- [Foundry](https://getfoundry.sh/) installed (`forge`, `cast`, `anvil`)
- OpenZeppelin dependencies (installed via Forge)

### Installation

Clone the repository and install the libraries:

```bash
git clone https://github.com/ThanhHoaAnRauMa/NMCNPM.git
cd NMCNPM
git checkout Tona

# Install Dependencies
forge install
```

### Build & Test

The test suite covers 100% of the lines, statements, and functions.

```bash
# Compile contracts
forge build

# Run tests
forge test

# Generate coverage report
forge coverage
```

### Deployment to Sepolia Testnet

> Deployement: https://sepolia.etherscan.io/address/0x6B8F21f887c6d141C101B2aD03B654d43Fc60eb0

1. Copy `.env.example` to `.env` and fill in your variables:
   ```bash
   cp .env.example .env
   ```
2. Source the `.env` variables:
   ```bash
   source .env
   ```
3. Run the deployment script to Sepolia and verify on Etherscan:
   ```bash
   forge script script/DeployForensisChat.s.sol:DeployForensisChat --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
   ```

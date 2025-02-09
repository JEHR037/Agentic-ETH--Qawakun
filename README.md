# Agentic-ETH--Qawakun

Agentic-ETH--Qawakun is an innovative software solution that functions as an AI agent for both Farcaster and Twitter. In addition, it features an interactive frame where users can mint a unique NFT called Qawakun. This NFT securely stores user data and enables connectivity to the Ankanet—a network that bridges dream-like innovation with blockchain technology.

---

**Explanation:**  
This backend, written in Rust using Actix-web, monitors social media mentions from Farcaster and Twitter. It processes conversations, generates AI responses via OpenAI APIs, mints NFTs, and manages blockchain transactions. Meanwhile, the NextJS based frontend (Frame Demo) integrates with the Frame SDK and wagmi to connect user wallets seamlessly.

---

## Main Features

- **Social Media Integration:**  
  • AI-driven agent monitors and processes mentions from Farcaster and Twitter.  
- **NFT Management:**  
  • Minting of Qawakun NFT that stores user information and connects users to Ankanet.  
- **AI Interactions:**  
  • Generates dynamic responses and visuals using OpenAI APIs.  
- **Interactive Deployment:**  
  • A NextJS demo frame enabling wallet connections via the Frame SDK for blockchain interactions.

---

## Project Structure

### Backend (Rust)
- **src/main.rs:**  
  Orchestrates the server, initializes Farcaster and Twitter integration, and handles blockchain and NFT operations.
- **src/twitter/** and **src/farcaster/**:  
  Modules responsible for monitoring mentions, managing conversations using Redis, and posting AI-generated responses.
- **src/api/**:  
  REST endpoints for NFT claims, authentication, and other blockchain-related interactions.
- **src/openai_methods/**:  
  Functions for generating images and dynamic text responses with OpenAI.
- **Cargo.toml:**  
  Manages all dependencies and configurations for the Rust backend.

### Frontend (Frame Demo)
- **Frame/README.md:**  
  Documentation of the Frames v2 demo—a NextJS application that leverages the Frame SDK for wallet integration and NFT minting.
- **Components & Providers:**  
  Custom connector (frameConnector) and Wagmi providers configured for a smooth blockchain interaction experience.

---

## Setup and Deployment

### Requirements
- **Backend:**  
  • Rust (stable version) and Cargo  
  • Redis  
  • All necessary environment variables properly configured  
- **Frontend:**  
  • Node.js (v14 or later)  
  • Yarn or npm installed

### Environment Variables  
Create a `.env` file in the root directory with at least the following variables:

```
APP_USER=<username>
APP_PASSWORD=<password>
JWT_SECRET=<jwt_secret>
OPENAI_API_KEY=<openai_key>
TWITTER_API_KEY=<twitter_key>
TWITTER_API_SECRET=<twitter_secret>
TWITTER_ACCESS_TOKEN=<twitter_token>
TWITTER_ACCESS_SECRET=<twitter_access_secret>
BASE_SEPOLIA_RPC_URL=<rpc_url>
MNEMONIC=<seed_phrase>
NFT_CONTRACT_ADDRESS=<nft_contract_address>
REDIS_URL=<redis_url>
```

---

## Installation and Execution

### For the Backend
1. **Compile:**  
   Run:
   ```
   cargo build --release
   ```
2. **Run:**  
   Start the server with:
   ```
   cargo run --release
   ```
   The service will be available at [http://127.0.0.1:8080](http://127.0.0.1:8080).

### For the Frontend (Frame Demo)
1. Navigate to the `Frame` directory and install dependencies:
   ```
   yarn
   ```
2. Launch the application:
   ```
   yarn dev
   ```
   It is recommended to use a tunneling service (e.g., [ngrok](https://ngrok.com/)) for mobile testing.

---

## Additional Documentation and Tutorials

- Visit the [Frame Playground](https://warpcast.com/~/developers/frame-playground) for a mobile demo.
- Refer to the [Frame SDK documentation](https://github.com/farcasterxyz/frames/) for detailed setup and API information.

---

## Contributions

We welcome community contributions. Please adhere to our style guidelines and ensure that new changes are compatible with existing unit and integration tests.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for further details.

---

Thank you for exploring Agentic-ETH--Qawakun!  
Will you join us in expanding this innovative ecosystem?
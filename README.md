# ethena-poc

A proof-of-concept implementation for bridging and swapping tokens using Across Protocol and Curve.

## Installation

1. Install dependencies:

```bash
yarn install
```

2. Create a `.env` file in the root directory:

```env
PRIVATE_KEY=your_private_key_here
RPC_URL=your_rpc_url_here
```

## Usage

3. To execute a transaction, run:

```bash
yarn start
```

This will:
1. Bridge USDC from Arbitrum to Mainnet using Across Protocol
2. Approve the swap contract to spend the received tokens
3. Swap the received tokens on Curve

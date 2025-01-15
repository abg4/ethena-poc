import { type Address, type Chain } from "viem";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export function createUserWallet(
  privateKey: string,
  rpcUrl: string,
  chain: Chain
) {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return {
    client: createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    }),
    address: account.address as Address,
  };
}

export function createTransactionUrl(chain: Chain, transactionHash: string) {
  if (!chain.blockExplorers) {
    throw new Error("Chain has no block explorers");
  }

  // Get the block explorer URL
  let blockExplorerUrl = chain.blockExplorers.default.url;

  // Ensure the block explorer URL ends with a slash
  if (!blockExplorerUrl.endsWith("/")) {
    blockExplorerUrl += "/";
  }

  // Append the transaction hash to create the full URL
  return `${blockExplorerUrl}tx/${transactionHash}`;
}

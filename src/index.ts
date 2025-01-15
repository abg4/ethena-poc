import { createAcrossClient } from "@across-protocol/app-sdk";
import dotenv from "dotenv";
import { type Address, parseUnits, formatUnits } from "viem";
import { mainnet, arbitrum } from "viem/chains";
import {
  generateApproveCallData,
  generateExchangeCallData,
} from "./utils/transactions.js";
import {
  createUserWallet,
  createTransactionUrl,
  getBalance,
} from "./utils/helpers.js";
import { logger } from "./utils/logger.js";
import { type CrossChainMessage } from "./utils/types.js";

dotenv.config();

// Configuration constants
const INTEGRATOR_ID = "0x0061"; // Ethena integrator ID

// Route: USDC from Arbitrum -> USDC on Mainnet
const route = {
  originChainId: arbitrum.id,
  destinationChainId: mainnet.id,
  inputToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address, // USDC arb
  outputToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address, // USDC mainnet
};

// Input amount to be used for bridge transaction
// Amount scaled to inputToken decimals (6 decimals for USDC)
const inputAmount = parseUnits("100", 6);

// Curve parameters for the quote and swap
const curveParams = {
  contractAddress: "0x02950460E2b9529D0E00284A5fA2d7bDF3fA4d72" as Address, // Curve USDe-USDC contract address
  i: 1n, // Index value for the coin to send
  j: 0n, // Index valie of the coin to recieve
};

// Function to execute the swap
async function executeSwap() {
  if (!process.env.PRIVATE_KEY || !process.env.RPC_URL) {
    throw new Error("PRIVATE_KEY or RPC_URL is not set");
  }

  try {
    logger.step("Initializing clients");
    // Create a wallet client using the origin chain to make Across deposit transaction
    const { client: walletClient, address: userAddress } = createUserWallet(
      process.env.PRIVATE_KEY,
      process.env.RPC_URL,
      arbitrum
    );

    const balance = await getBalance(arbitrum, userAddress, route.inputToken);
    if (balance < inputAmount) {
      throw new Error(
        `Insufficient balance. Required: ${formatUnits(
          inputAmount,
          6
        )}, Available: ${formatUnits(balance, 6)}`
      );
    }
    logger.success(
      `Balance check passed. Available: ${formatUnits(balance, 6)}`
    );

    // sets up the AcrossClient and configures chains
    const client = createAcrossClient({
      integratorId: INTEGRATOR_ID,
      chains: [mainnet, arbitrum],
    });

    logger.success("Clients initialized successfully");

    // Define the transactions executed after bridge transaction
    const approveAndSwapMessage: CrossChainMessage = {
      actions: [
        // Approve the swap contract to spend the input amount
        {
          target: route.outputToken,
          // Generate the approve call data
          callData: generateApproveCallData(
            curveParams.contractAddress,
            inputAmount
          ),
          value: 0n,
          // we use the update function to update the calldata based on the output amount from the quote
          update: (updatedOutputAmount: bigint) => {
            return {
              callData: generateApproveCallData(
                curveParams.contractAddress,
                updatedOutputAmount
              ),
            };
          },
        },
        {
          // Curve contract address
          target: curveParams.contractAddress,
          // Generate the exchange call data
          callData: await generateExchangeCallData(
            curveParams.contractAddress,
            curveParams.i,
            curveParams.j,
            inputAmount,
            userAddress
          ),
          value: 0n,
          // we use the update function to update the calldata based on the output amount from the quote
          update: async (updatedOutputAmount: bigint) => {
            return {
              callData: await generateExchangeCallData(
                curveParams.contractAddress,
                curveParams.i,
                curveParams.j,
                updatedOutputAmount,
                userAddress
              ),
            };
          },
        },
      ],
      // address to send the output token to if the swap fails
      fallbackRecipient: userAddress,
    };

    logger.step("Fetching quote");
    // Retrieves a quote for the bridge with approval and swap actions
    const quote = await client.getQuote({
      route,
      inputAmount: inputAmount,
      crossChainMessage: approveAndSwapMessage,
    });

    logger.json("Quote parameters", quote.deposit);

    logger.step("Executing transactions");
    await client.executeQuote({
      walletClient,
      deposit: quote.deposit, // returned by `getQuote`
      onProgress: (progress) => {
        if (progress.step === "approve" && progress.status === "txSuccess") {
          // if approving an ERC20, you have access to the approval receipt
          const { txReceipt } = progress;
          logger.success(
            `Approve TX: ${createTransactionUrl(
              arbitrum,
              txReceipt.transactionHash
            )}`
          );
        }

        if (progress.step === "deposit" && progress.status === "txSuccess") {
          // once deposit is successful you have access to depositId and the receipt
          const { depositId, txReceipt } = progress;
          logger.success(
            `Deposit TX: ${createTransactionUrl(
              arbitrum,
              txReceipt.transactionHash
            )}`
          );
          logger.success(`Deposit ID: ${depositId}`);
        }

        if (progress.step === "fill" && progress.status === "txSuccess") {
          // if the fill is successful, you have access the following data
          const { txReceipt, actionSuccess } = progress;
          // actionSuccess is a boolean flag, telling us if your cross chain messages were successful
          logger.success(
            `Fill TX: ${createTransactionUrl(
              mainnet,
              txReceipt.transactionHash
            )}`
          );
          logger.success(
            actionSuccess ? "Swap completed successfully" : "Swap failed"
          );
        }
      },
    });

    logger.step("Bridge transaction completed");
  } catch (error) {
    logger.error("Failed to execute swap", error);
    throw error;
  }
}

executeSwap();

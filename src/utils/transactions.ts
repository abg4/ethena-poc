import { type Address } from "viem";
import { encodeFunctionData, parseAbiItem } from "viem/utils";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

// Function to generate the calldata for the approve function
export function generateApproveCallData(spender: Address, amount: bigint) {
  // Generate the calldata for the approve function
  const approveCallData = encodeFunctionData({
    abi: [parseAbiItem("function approve(address spender, uint256 value)")],
    args: [spender, amount],
  });

  return approveCallData;
}

// Function to generate the calldata for the exchange function
export async function generateExchangeCallData(
  swapContractAddress: Address,
  i: bigint,
  j: bigint,
  _dx: bigint,
  _receiver: Address
) {
  // Get the minimum output amount
  const minDy = await getMinDy(swapContractAddress, i, j, _dx);
  // Calculate the adjusted minimum output amount with slippage
  const adjustedMinDy = calculateAdjustedMinOutput(minDy);

  // Generate the calldata for the exchange function
  const exchangeCallData = encodeFunctionData({
    abi: [
      parseAbiItem(
        "function exchange(int128 i,int128 j,uint256 _dx,uint256 _min_dy,address _receiver)"
      ),
    ],
    args: [i, j, _dx, adjustedMinDy, _receiver],
  });

  return exchangeCallData;
}

// Function to calculate the adjusted minimum output amount with slippage
function calculateAdjustedMinOutput(
  amount: bigint,
  slippageBps: bigint = 3n
): bigint {
  // 10000 - slippageBps = percentage to multiply by
  // e.g., 10000 - 3 = 9997 = 99.97%
  return (amount * (10000n - slippageBps)) / 10000n;
}

// Function to get the minimum output amount
async function getMinDy(
  swapContractAddress: Address,
  i: bigint,
  j: bigint,
  dx: bigint
): Promise<bigint> {
  // Create a public client to make the read contract request
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  // Retrieve the dy amount
  return await publicClient.readContract({
    abi: [
      parseAbiItem(
        "function get_dy(int128 i,int128 j,uint256 dx) external view returns (uint256)"
      ),
    ],
    address: swapContractAddress,
    functionName: "get_dy",
    args: [i, j, dx],
  });
}
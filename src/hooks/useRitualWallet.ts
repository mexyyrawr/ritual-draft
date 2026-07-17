import {
  useAccount,
  useReadContract,
  useWalletClient,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther, encodeFunctionData } from "viem";
import { RITUAL_ADDRESSES, RITUAL_WALLET_ABI } from "@/lib/ritual";
import { RITUAL_DRAFT_CONTRACT, RITUAL_DRAFT_ABI } from "@/lib/contract";
import { useState, useCallback } from "react";

export function useRitualWallet() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>();

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: pendingHash,
    query: { enabled: !!pendingHash },
  });

  const {
    data: balance,
    refetch: refetchBalance,
    isLoading: isBalanceLoading,
  } = useReadContract({
    address: RITUAL_ADDRESSES.SYSTEM.WALLET,
    abi: RITUAL_WALLET_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });

  const deposit = useCallback(
    async (amount: string = "0.5") => {
      if (!walletClient) throw new Error("Wallet not connected");

      // Deposit to contract's RitualWallet via depositForFees()
      const data = encodeFunctionData({
        abi: RITUAL_DRAFT_ABI,
        functionName: "depositForFees",
      });

      const hash = await walletClient.sendTransaction({
        to: RITUAL_DRAFT_CONTRACT,
        data,
        value: parseEther(amount),
        gas: 100_000n,
      });
      setPendingHash(hash);
      return hash;
    },
    [walletClient]
  );

  return {
    balance,
    balanceFormatted: balance ? formatEther(balance) : "0",
    deposit,
    isDepositing: isConfirming,
    isBalanceLoading,
    refetchBalance,
  };
}

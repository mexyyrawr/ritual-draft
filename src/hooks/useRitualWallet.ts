import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseEther, formatEther } from "viem";
import { RITUAL_ADDRESSES, RITUAL_WALLET_ABI } from "@/lib/ritual";
import { RITUAL_DRAFT_CONTRACT } from "@/lib/contract";
import { useState, useCallback } from "react";

export function useRitualWallet() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [isDepositing, setIsDepositing] = useState(false);

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
      setIsDepositing(true);
      try {
        const hash = await writeContractAsync({
          address: RITUAL_DRAFT_CONTRACT,
          abi: [
            {
              type: "function",
              name: "depositForFees",
              inputs: [],
              outputs: [],
              stateMutability: "payable",
            },
          ] as const,
          functionName: "depositForFees",
          value: parseEther(amount),
        });
        return hash;
      } finally {
        setIsDepositing(false);
      }
    },
    [writeContractAsync]
  );

  return {
    balance,
    balanceFormatted: balance ? formatEther(balance) : "0",
    deposit,
    isDepositing,
    isBalanceLoading,
    refetchBalance,
  };
}

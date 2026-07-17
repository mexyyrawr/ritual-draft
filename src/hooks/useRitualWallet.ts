import {
  useAccount,
  useReadContract,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther, encodeFunctionData } from "viem";
import { RITUAL_ADDRESSES, RITUAL_WALLET_ABI } from "@/lib/ritual";
import { useState, useCallback } from "react";

export function useRitualWallet() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
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
      const data = encodeFunctionData({
        abi: RITUAL_WALLET_ABI,
        functionName: "deposit",
        args: [100_000n], // lock for 100k blocks (~9.7 hours)
      });
      const hash = await sendTransactionAsync({
        to: RITUAL_ADDRESSES.SYSTEM.WALLET,
        data,
        value: parseEther(amount),
        gas: 100_000n,
      });
      setPendingHash(hash);
      return hash;
    },
    [sendTransactionAsync]
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

import { useState, useCallback } from "react";
import { useAccount, useSendTransaction, usePublicClient } from "wagmi";
import { encodeAbiParameters, decodeAbiParameters } from "viem";
import { RITUAL_ADDRESSES } from "@/lib/ritual";

interface GenerateState {
  status: "idle" | "submitting" | "pending" | "success" | "error";
  draft: string;
  txHash: `0x${string}` | null;
  error: string | null;
}

export function useGenerateDraft() {
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const [state, setState] = useState<GenerateState>({
    status: "idle",
    draft: "",
    txHash: null,
    error: null,
  });

  const generate = useCallback(
    async (prompt: string) => {
      if (!address) {
        setState({
          status: "error",
          draft: "",
          txHash: null,
          error: "Connect wallet first",
        });
        return;
      }

      setState({
        status: "submitting",
        draft: "",
        txHash: null,
        error: null,
      });

      try {
        // Encode LLM precompile call
        // Format: (string prompt, string model, uint256 maxTokens)
        const data = encodeAbiParameters(
          [{ type: "string" }, { type: "string" }, { type: "uint256" }],
          [prompt, "ritual-auto", 1000n]
        );

        const hash = await sendTransactionAsync({
          to: RITUAL_ADDRESSES.PRECOMPILE.LLM,
          data,
          gas: 500_000n,
        });

        setState({
          status: "pending",
          draft: "",
          txHash: hash,
          error: null,
        });

        // Wait for receipt (short-running async → result in spcCalls)
        const receipt = await publicClient!.waitForTransactionReceipt({
          hash,
        });

        // Extract result from spcCalls
        const spcCalls = (receipt as any).spcCalls;
        if (spcCalls && spcCalls.length > 0) {
          const output = spcCalls[0].output;
          const [response] = decodeAbiParameters(
            [{ type: "string" }],
            output
          );
          setState({
            status: "success",
            draft: response,
            txHash: hash,
            error: null,
          });
        } else {
          setState({
            status: "error",
            draft: "",
            txHash: hash,
            error: "No result in receipt. Check RitualWallet balance.",
          });
        }
      } catch (err: any) {
        setState({
          status: "error",
          draft: "",
          txHash: null,
          error: err.message || "Generation failed",
        });
      }
    },
    [address, sendTransactionAsync, publicClient]
  );

  const reset = useCallback(() => {
    setState({ status: "idle", draft: "", txHash: null, error: null });
  }, []);

  return { ...state, generate, reset };
}

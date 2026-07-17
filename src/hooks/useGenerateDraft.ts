import { useState, useCallback } from "react";
import { useAccount, useSendTransaction, usePublicClient } from "wagmi";
import { encodeLLMRequest, decodeLLMResult, LLM_PRECOMPILE } from "@/lib/llm";

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
        // Encode full 30-field LLM request
        const data = encodeLLMRequest({
          messages: [
            {
              role: "system",
              content:
                "You are a social media content creator for Ritual Chain (Chain ID 1979), an AI-focused blockchain. Generate draft X/Twitter posts based on the user's request. Be engaging, casual, and shareable. Do not use excessive hashtags (max 1-2). Do not sound like AI.",
            },
            { role: "user", content: prompt },
          ],
          maxCompletionTokens: 4096n,
          temperature: 700n,
          ttl: 300n,
        });

        const hash = await sendTransactionAsync({
          to: LLM_PRECOMPILE,
          data,
          gas: 3_000_000n,
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

        // Try to extract result from spcCalls
        const spcCalls = (receipt as any).spcCalls;
        if (spcCalls && spcCalls.length > 0) {
          const output = spcCalls[0].output;
          try {
            const result = decodeLLMResult(output);
            if (result.hasError) {
              setState({
                status: "error",
                draft: "",
                txHash: hash,
                error: `LLM error: ${result.errorMessage}`,
              });
            } else {
              setState({
                status: "success",
                draft: result.content,
                txHash: hash,
                error: null,
              });
            }
          } catch (decodeErr: any) {
            setState({
              status: "error",
              draft: "",
              txHash: hash,
              error: `Failed to decode LLM response: ${decodeErr.message}`,
            });
          }
        } else {
          // Fallback: try PrecompileCalled event
          const precompileLog = receipt.logs.find(
            (log: any) =>
              log.address?.toLowerCase() ===
              "0x0000000000000000000000000000000000000802"
          );

          if (precompileLog && precompileLog.data && precompileLog.data !== "0x") {
            try {
              const result = decodeLLMResult(precompileLog.data);
              if (result.hasError) {
                setState({
                  status: "error",
                  draft: "",
                  txHash: hash,
                  error: `LLM error: ${result.errorMessage}`,
                });
              } else {
                setState({
                  status: "success",
                  draft: result.content,
                  txHash: hash,
                  error: null,
                });
              }
            } catch {
              setState({
                status: "error",
                draft: "",
                txHash: hash,
                error: "Could not decode LLM result from event log",
              });
            }
          } else {
            setState({
              status: "error",
              draft: "",
              txHash: hash,
              error:
                "No LLM result found in receipt. Check RitualWallet balance (need ~0.31 RIT).",
            });
          }
        }
      } catch (err: any) {
        let errorMsg = err.message || "Generation failed";
        if (errorMsg.includes("sender locked")) {
          errorMsg =
            "You have a pending transaction. Wait for it to settle, then try again.";
        } else if (errorMsg.includes("insufficient")) {
          errorMsg =
            "Insufficient RitualWallet balance. Deposit at least 0.5 RIT.";
        }
        setState({
          status: "error",
          draft: "",
          txHash: null,
          error: errorMsg,
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

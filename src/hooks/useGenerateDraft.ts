import { useState, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { encodeFunctionData, parseEther } from "viem";
import { encodeLLMRequest, decodeLLMResult } from "@/lib/llm";
import { RITUAL_DRAFT_CONTRACT, RITUAL_DRAFT_ABI } from "@/lib/contract";

interface GenerateState {
  status: "idle" | "submitting" | "pending" | "polling" | "success" | "error";
  draft: string;
  txHash: `0x${string}` | null;
  error: string | null;
}

export function useGenerateDraft() {
  const { address } = useAccount();
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
        setState({ status: "error", draft: "", txHash: null, error: "Connect wallet first" });
        return;
      }

      setState({ status: "submitting", draft: "", txHash: null, error: null });

      try {
        const llmInput = encodeLLMRequest({
          messages: [
            {
              role: "system",
              content:
                "You are a social media content creator for Ritual Chain (Chain ID 1979). Generate draft X/Twitter posts. Be engaging, casual, shareable. Max 1-2 hashtags. Do not sound like AI.",
            },
            { role: "user", content: prompt },
          ],
          maxCompletionTokens: 4096n,
          temperature: 700n,
          ttl: 300n,
        });

        const data = encodeFunctionData({
          abi: RITUAL_DRAFT_ABI,
          functionName: "generateDraft",
          args: [llmInput],
        });

        // Use raw MetaMask provider to avoid wagmi nonce issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ethereum = (window as any).ethereum;
        if (!ethereum) {
          setState({ status: "error", draft: "", txHash: null, error: "MetaMask not found" });
          return;
        }

        // Get fresh nonce from the chain
        const nonce = await publicClient!.getTransactionCount({
          address,
          blockTag: "pending",
        });

        // Send via MetaMask directly (bypasses wagmi nonce management)
        const hash = await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: address,
              to: RITUAL_DRAFT_CONTRACT,
              data: data,
              value: "0x" + parseEther("0.01").toString(16), // 0.01 RITUAL for auto-deposit
              gas: "0x4C4B40", // 5,000,000
              nonce: "0x" + nonce.toString(16),
            },
          ],
        });

        setState({ status: "pending", draft: "", txHash: hash, error: null });

        // Wait for transaction receipt (viem for status check)
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });

        if (receipt.status === "reverted") {
          setState({
            status: "error",
            draft: "",
            txHash: hash,
            error: `Transaction reverted. Check: https://explorer.ritualfoundation.org/tx/${hash}`,
          });
          return;
        }

        // Get RAW receipt via eth_getTransactionReceipt to preserve Ritual-specific spcCalls field
        // viem's getTransactionReceipt strips non-standard fields
        const rawReceipt = await publicClient!.request({
          method: "eth_getTransactionReceipt" as any,
          params: [hash],
        } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const spcCalls = (rawReceipt as any)?.spcCalls;

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
              return;
            }

            setState({
              status: "success",
              draft: result.content,
              txHash: hash,
              error: null,
            });
          } catch (decodeErr) {
            console.error("Failed to decode spcCalls output:", decodeErr);
            setState({
              status: "error",
              draft: "",
              txHash: hash,
              error: `Failed to decode LLM result. TX: ${hash}`,
            });
          }
        } else {
          // No spcCalls — LLM might still be processing, poll for result
          setState({ status: "polling", draft: "", txHash: hash, error: null });
          await pollForResult(hash);
        }
      } catch (err: unknown) {
        let errorMsg = "Transaction failed";
        if (err instanceof Error) {
          errorMsg = err.message;
          const msg = err.message;
          if (msg.includes("nonce")) errorMsg = "Nonce error: reset MetaMask account";
          else if (msg.includes("insufficient")) errorMsg = "Insufficient funds or lock expired";
          else if (msg.includes("user rejected")) errorMsg = "Transaction rejected by user";
          else if (msg.includes("already known")) errorMsg = "Tx already pending — wait or reset MetaMask account";
          else if (msg.includes("Internal JSON-RPC")) errorMsg = `RPC error: ${msg.slice(0, 200)}`;
        } else if (typeof err === "object" && err !== null) {
          const e = err as any;
          if (e.message) errorMsg = e.message;
          else if (e.reason) errorMsg = e.reason;
          else if (e.data?.message) errorMsg = e.data.message;
          else errorMsg = JSON.stringify(err).slice(0, 300);
        }
        console.error("Generate error:", err);
        setState({ status: "error", draft: "", txHash: null, error: errorMsg });
      }
    },
    [address, publicClient]
  );

  const pollForResult = useCallback(
    async (hash: `0x${string}`) => {
      const maxAttempts = 30; // 30 attempts × 2s = 60s max
      const delay = 2000;

      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, delay));

        try {
          // Use raw RPC to preserve Ritual-specific spcCalls field
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawReceipt = await publicClient!.request({
            method: "eth_getTransactionReceipt" as any,
            params: [hash],
          } as any);

          const spcCalls = (rawReceipt as any)?.spcCalls;

          if (spcCalls && spcCalls.length > 0) {
            const output = spcCalls[0].output;
            const result = decodeLLMResult(output);

            if (result.hasError) {
              setState({
                status: "error",
                draft: "",
                txHash: hash,
                error: `LLM error: ${result.errorMessage}`,
              });
              return;
            }

            setState({
              status: "success",
              draft: result.content,
              txHash: hash,
              error: null,
            });
            return;
          }
        } catch {
          // Receipt not ready yet, continue polling
        }
      }

      // Timeout
      setState({
        status: "error",
        draft: "",
        txHash: hash,
        error: `Timeout waiting for LLM result. TX: ${hash}`,
      });
    },
    [publicClient]
  );

  const reset = useCallback(() => {
    setState({ status: "idle", draft: "", txHash: null, error: null });
  }, []);

  return { ...state, generate, reset };
}

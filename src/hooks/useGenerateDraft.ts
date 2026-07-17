import { useState, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { encodeFunctionData, decodeEventLog, parseEther } from "viem";
import { encodeLLMRequest } from "@/lib/llm";
import { RITUAL_DRAFT_CONTRACT, RITUAL_DRAFT_ABI } from "@/lib/contract";

interface GenerateState {
  status: "idle" | "submitting" | "pending" | "success" | "error";
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

        // Extract result from DraftGenerated event
        let content = "";
        for (const log of receipt.logs) {
          if (log.data && log.data !== "0x") {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const decoded = decodeEventLog({
                abi: RITUAL_DRAFT_ABI,
                data: log.data,
                topics: (log as any).topics,
              });
              if (decoded.eventName === "DraftGenerated") {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content = (decoded.args as any).content || "";
                break;
              }
            } catch {}
          }
        }

        if (content) {
          const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
          setState({ status: "success", draft: cleanContent, txHash: hash, error: null });
        } else {
          // Fallback: read from contract
          try {
            const draftId = await publicClient!.readContract({
              address: RITUAL_DRAFT_CONTRACT,
              abi: RITUAL_DRAFT_ABI,
              functionName: "nextDraftId",
            });
            const prevId = draftId - 1n;
            const [, storedContent] = await publicClient!.readContract({
              address: RITUAL_DRAFT_CONTRACT,
              abi: RITUAL_DRAFT_ABI,
              functionName: "getDraft",
              args: [prevId],
            });
            if (storedContent && storedContent !== "No content") {
              const cleanContent = storedContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
              setState({ status: "success", draft: cleanContent, txHash: hash, error: null });
            } else {
              setState({
                status: "error",
                draft: "",
                txHash: hash,
                error: `No content. TX: ${hash}. Check explorer.`,
              });
            }
          } catch {
            setState({
              status: "error",
              draft: "",
              txHash: hash,
              error: `Could not read result. TX: ${hash}`,
            });
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Transaction failed";
        setState({ status: "error", draft: "", txHash: null, error: errorMsg });
      }
    },
    [address, publicClient]
  );

  const reset = useCallback(() => {
    setState({ status: "idle", draft: "", txHash: null, error: null });
  }, []);

  return { ...state, generate, reset };
}

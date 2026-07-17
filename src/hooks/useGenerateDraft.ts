import { useState, useCallback } from "react";
import { useAccount, usePublicClient, useSendTransaction } from "wagmi";
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
  const { sendTransactionAsync } = useSendTransaction();
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

        const hash = await sendTransactionAsync({
          to: RITUAL_DRAFT_CONTRACT,
          data,
          value: parseEther("0.01"), // auto-deposit to extend RitualWallet lock
          gas: 5_000_000n,
        });

        setState({ status: "pending", draft: "", txHash: hash, error: null });

        const receipt = await publicClient!.waitForTransactionReceipt({ hash });

        // Check if tx reverted
        if (receipt.status === "reverted") {
          setState({
            status: "error",
            draft: "",
            txHash: hash,
            error: `Transaction reverted. Check explorer: https://explorer.ritualfoundation.org/tx/${hash}`,
          });
          return;
        }

        // Extract result from DraftGenerated event
        let content = "";
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: RITUAL_DRAFT_ABI,
              data: log.data,
              topics: log.topics as any,
            });
            if (decoded.eventName === "DraftGenerated") {
              content = (decoded.args as any).content || "";
              break;
            }
          } catch {}
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
                error: `No content generated. TX: ${hash}. Check explorer for details.`,
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
      } catch (err: any) {
        // Show ACTUAL error, not custom message
        const errorMsg = err.message || "Transaction failed";
        setState({ status: "error", draft: "", txHash: null, error: errorMsg });
      }
    },
    [address, sendTransactionAsync, publicClient]
  );

  const reset = useCallback(() => {
    setState({ status: "idle", draft: "", txHash: null, error: null });
  }, []);

  return { ...state, generate, reset };
}

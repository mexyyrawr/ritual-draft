import { useState, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { encodeFunctionData, decodeEventLog } from "viem";
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
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [state, setState] = useState<GenerateState>({
    status: "idle",
    draft: "",
    txHash: null,
    error: null,
  });

  const generate = useCallback(
    async (prompt: string) => {
      if (!address || !walletClient) {
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
        // Fetch latest nonce to avoid stale nonce issues
        const nonce = await publicClient!.getTransactionCount({
          address,
          blockTag: "pending",
        });

        // Encode 30-field LLM request
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

        // Call contract.generateDraft(llmInput)
        const data = encodeFunctionData({
          abi: RITUAL_DRAFT_ABI,
          functionName: "generateDraft",
          args: [llmInput],
        });

        const hash = await walletClient.sendTransaction({
          to: RITUAL_DRAFT_CONTRACT,
          data,
          gas: 5_000_000n,
          nonce,
        });

        setState({
          status: "pending",
          draft: "",
          txHash: hash,
          error: null,
        });

        // Wait for receipt
        const receipt = await publicClient!.waitForTransactionReceipt({
          hash,
        });

        // Extract result from DraftGenerated event
        let content = "";
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: RITUAL_DRAFT_ABI,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "DraftGenerated") {
              content = (decoded.args as any).content || "";
              break;
            }
          } catch {
            // Not our event, skip
          }
        }

        if (content) {
          const cleanContent = content
            .replace(/<think>[\s\S]*?<\/think>/g, "")
            .trim();
          setState({
            status: "success",
            draft: cleanContent,
            txHash: hash,
            error: null,
          });
        } else {
          // Try reading draft from contract
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
              const cleanContent = storedContent
                .replace(/<think>[\s\S]*?<\/think>/g, "")
                .trim();
              setState({
                status: "success",
                draft: cleanContent,
                txHash: hash,
                error: null,
              });
            } else {
              setState({
                status: "error",
                draft: "",
                txHash: hash,
                error: "Draft generated but content empty. Check contract RITUAL balance.",
              });
            }
          } catch {
            setState({
              status: "error",
              draft: "",
              txHash: hash,
              error: "Could not read draft from contract.",
            });
          }
        }
      } catch (err: any) {
        let errorMsg = err.message || "Generation failed";
        if (errorMsg.includes("sender locked")) {
          errorMsg =
            "Pending transaction. Wait for it to settle, then try again.";
        } else if (errorMsg.includes("insufficient")) {
          errorMsg = "Insufficient contract balance. Contact owner.";
        } else if (errorMsg.includes("LLM error")) {
          errorMsg = `LLM error: ${errorMsg.split("LLM error: ")[1] || "Unknown"}`;
        } else if (errorMsg.includes("nonce")) {
          errorMsg =
            "Nonce error. Reset MetaMask: Settings → Advanced → Clear activity tab data. Then refresh page.";
        }
        setState({
          status: "error",
          draft: "",
          txHash: null,
          error: errorMsg,
        });
      }
    },
    [address, walletClient, publicClient]
  );

  const reset = useCallback(() => {
    setState({ status: "idle", draft: "", txHash: null, error: null });
  }, []);

  return { ...state, generate, reset };
}

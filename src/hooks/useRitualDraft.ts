import { useState, useCallback } from "react";
import { useGenerateDraft } from "./useGenerateDraft";
import { buildDraftPrompt, type DraftOptions } from "@/lib/prompts";

interface DraftState {
  status:
    | "idle"
    | "researching"
    | "generating"
    | "success"
    | "error";
  researchSources: Array<{ name: string; content: string; url: string }>;
  draft: string;
  error: string | null;
}

export function useRitualDraft() {
  const [state, setState] = useState<DraftState>({
    status: "idle",
    researchSources: [],
    draft: "",
    error: null,
  });

  const {
    generate,
    status: llmStatus,
    draft: llmDraft,
    error: llmError,
    txHash,
    reset: resetLLM,
  } = useGenerateDraft();

  const createDraft = useCallback(
    async (query: string, options: DraftOptions) => {
      // Step 1: Research
      setState({
        status: "researching",
        researchSources: [],
        draft: "",
        error: null,
      });

      try {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (!res.ok) {
          throw new Error(`Research failed: ${res.status}`);
        }

        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setState((s) => ({ ...s, researchSources: data.sources || [] }));

        // Step 2: Generate via LLM precompile
        setState((s) => ({ ...s, status: "generating" }));

        const prompt = buildDraftPrompt(query, data.context || "", options);
        await generate(prompt);
      } catch (err: any) {
        setState({
          status: "error",
          researchSources: [],
          draft: "",
          error: err.message || "Failed to create draft",
        });
      }
    },
    [generate]
  );

  // Sync LLM state to draft state
  const draft = llmDraft || state.draft;
  const error = llmError || state.error;
  const status =
    llmStatus === "success"
      ? "success"
      : llmStatus === "error"
        ? "error"
        : state.status;

  const reset = useCallback(() => {
    setState({
      status: "idle",
      researchSources: [],
      draft: "",
      error: null,
    });
    resetLLM();
  }, [resetLLM]);

  return {
    status,
    researchSources: state.researchSources,
    draft,
    error,
    txHash,
    createDraft,
    reset,
  };
}

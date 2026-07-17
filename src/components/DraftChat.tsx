"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useRitualDraft } from "@/hooks/useRitualDraft";
import { useRitualWallet } from "@/hooks/useRitualWallet";
import type { DraftOptions } from "@/lib/prompts";

const EXAMPLE_QUERIES = [
  "Apa fitur terbaru Ritual Chain?",
  "Gimana cara build dApp di Ritual?",
  "Ritual vs chain lain bedanya apa?",
  "Apa itu LLM precompile di Ritual?",
];

export function DraftChat() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const {
    balanceFormatted,
    deposit,
    isDepositing,
    isBalanceLoading,
  } = useRitualWallet();
  const {
    status,
    researchSources,
    draft,
    error,
    txHash,
    createDraft,
    reset,
  } = useRitualDraft();

  const [query, setQuery] = useState("");
  const [style, setStyle] = useState<DraftOptions["style"]>("single");
  const [language, setLanguage] = useState<DraftOptions["language"]>("en");

  const handleGenerate = () => {
    if (!query.trim()) return;
    createDraft(query, { style, language });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(draft);
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
  };

  const balanceNum = parseFloat(balanceFormatted);
  const isLoading = status === "researching" || status === "generating";

  // Not connected
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <div className="text-6xl mb-2">📝</div>
        <h1 className="text-3xl font-bold text-white">Ritual Draft</h1>
        <p className="text-gray-400 text-center max-w-md">
          AI-powered content writer for Ritual Chain. Research from official
          sources, generate draft X posts.
        </p>
        <button
          onClick={() => connect({ connector: connectors[0] })}
          className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors"
        >
          Connect Wallet
        </button>
        <p className="text-xs text-gray-600">
          Need RITUAL tokens? Use the faucet.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          📝 Ritual Draft
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:inline">
            {isBalanceLoading ? "..." : `${balanceNum.toFixed(4)} RITUAL`}
          </span>
          <button
            onClick={() => disconnect()}
            className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800 px-3 py-1 rounded"
          >
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        </div>
      </div>

      {/* Deposit Gate */}
      {!isBalanceLoading && balanceNum < 0.01 && (
        <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
          <p className="text-yellow-400 text-sm mb-2">
            ⚠️ Deposit RITUAL ke RitualWallet dulu buat generate drafts.
          </p>
          <button
            onClick={() => deposit("0.5")}
            disabled={isDepositing}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm text-white disabled:opacity-50 transition-colors"
          >
            {isDepositing ? "Depositing..." : "Deposit 0.5 RITUAL"}
          </button>
        </div>
      )}

      {/* Example Queries */}
      {status === "idle" && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">Contoh pertanyaan:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((eq) => (
              <button
                key={eq}
                onClick={() => handleExampleClick(eq)}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                {eq}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="mb-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Mau nanya/nulis apa tentang Ritual?"
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white placeholder-gray-500 resize-none focus:border-purple-500 focus:outline-none transition-colors"
          rows={3}
          disabled={isLoading}
        />
      </div>

      {/* Options */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-1.5">
          {(
            [
              { key: "single", icon: "💬", label: "Single" },
              { key: "thread", icon: "🧵", label: "Thread" },
              { key: "educational", icon: "📚", label: "Edu" },
              { key: "hype", icon: "🔥", label: "Hype" },
            ] as const
          ).map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => setStyle(key)}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                style === key
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setLanguage("en")}
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              language === "en"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage("id")}
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              language === "id"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            ID
          </button>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!query.trim() || isLoading || balanceNum < 0.01}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-6"
      >
        {status === "researching"
          ? "🔍 Researching from docs, X, GitHub..."
          : status === "generating"
            ? "✨ Generating via LLM precompile..."
            : "✨ Generate Draft"}
      </button>

      {/* Research Sources */}
      {researchSources.length > 0 && (
        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
          <h3 className="text-xs font-bold text-gray-400 mb-2">
            📖 Sources:
          </h3>
          <div className="space-y-1">
            {researchSources
              .filter((s) => s.content && s.content.length > 10)
              .map((s, i) => (
                <div key={i} className="text-xs text-gray-500">
                  ✅ {s.name}
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 ml-1"
                    >
                      ↗
                    </a>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Draft Display */}
      {draft && (
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-sm font-bold text-gray-300 mb-3">
            📝 Generated Draft:
          </h3>
          <div className="whitespace-pre-wrap text-gray-200 text-sm leading-relaxed">
            {draft}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm text-white transition-colors"
            >
              📋 Copy
            </button>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm text-white transition-colors"
            >
              🔄 Regenerate
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
            >
              ✏️ New Query
            </button>
          </div>
          {txHash && (
            <p className="text-xs text-gray-600 mt-3">
              Tx:{" "}
              <a
                href={`https://explorer.ritualfoundation.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                {txHash.slice(0, 18)}...
              </a>
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg mt-4">
          <p className="text-red-400 text-sm">❌ {error}</p>
          {error.includes("RitualWallet") && (
            <button
              onClick={() => deposit("0.5")}
              disabled={isDepositing}
              className="mt-2 px-4 py-2 bg-yellow-600 rounded text-sm text-white"
            >
              {isDepositing ? "Depositing..." : "Deposit 0.5 RITUAL"}
            </button>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-gray-700 mt-8 text-center">
        ⚠️ Draft only — lo yang post sendiri di X
      </p>
    </div>
  );
}

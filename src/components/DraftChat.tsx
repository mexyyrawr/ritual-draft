"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useRitualDraft } from "@/hooks/useRitualDraft";
import type { DraftOptions } from "@/lib/prompts";

const EXAMPLE_QUERIES_EN = [
  "What are the latest Ritual Chain features?",
  "How to build a dApp on Ritual?",
  "What makes Ritual different from other chains?",
  "What is the LLM precompile?",
];

const EXAMPLE_QUERIES_ID = [
  "Apa fitur terbaru Ritual Chain?",
  "Gimana cara build dApp di Ritual?",
  "Ritual vs chain lain bedanya apa?",
  "Apa itu LLM precompile di Ritual?",
];

type Lang = "en" | "id";

export function DraftChat() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
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
  const [lang, setLang] = useState<Lang>("en");

  const isLoading = status !== "idle" && status !== "success" && status !== "error";
  const examples = lang === "en" ? EXAMPLE_QUERIES_EN : EXAMPLE_QUERIES_ID;

  const handleGenerate = () => {
    if (!query.trim() || isLoading) return;
    createDraft(query, { style, language: lang });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(draft);
  };

  // Not connected
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <div className="text-6xl mb-2">📝</div>
        <h1 className="text-3xl font-bold text-white">Ritual Draft</h1>
        <p className="text-gray-400 text-center max-w-md">
          {lang === "en"
            ? "AI-powered content writer for Ritual Chain. Research from official sources, generate draft X posts."
            : "AI content writer buat Ritual Chain. Research dari sumber official, generate draft post X."}
        </p>

        {/* Language toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setLang("en")}
            className={`px-4 py-2 rounded-lg text-sm ${lang === "en" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"}`}
          >
            English
          </button>
          <button
            onClick={() => setLang("id")}
            className={`px-4 py-2 rounded-lg text-sm ${lang === "id" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"}`}
          >
            Indonesia
          </button>
        </div>

        <button
          onClick={() => connect({ connector: connectors[0] })}
          className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors"
        >
          {lang === "en" ? "Connect Wallet" : "Hubungkan Wallet"}
        </button>
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
          {/* Language toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-1 rounded text-xs ${lang === "en" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500"}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang("id")}
              className={`px-2 py-1 rounded text-xs ${lang === "id" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-500"}`}
            >
              ID
            </button>
          </div>
          <button
            onClick={() => disconnect()}
            className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800 px-3 py-1 rounded"
          >
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        </div>
      </div>

      {/* Example Queries */}
      {status === "idle" && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">
            {lang === "en" ? "Example questions:" : "Contoh pertanyaan:"}
          </p>
          <div className="flex flex-wrap gap-2">
            {examples.map((eq) => (
              <button
                key={eq}
                onClick={() => setQuery(eq)}
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
          placeholder={
            lang === "en"
              ? "What do you want to know/write about Ritual?"
              : "Mau nanya/nulis apa tentang Ritual?"
          }
          className="w-full p-3 bg-gray-800 rounded-lg border border-gray-700 text-white placeholder-gray-500 resize-none focus:border-purple-500 focus:outline-none transition-colors"
          rows={3}
          disabled={isLoading}
        />
      </div>

      {/* Style Options */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            { key: "single", icon: "💬", labelEn: "Single", labelId: "Satu" },
            { key: "thread", icon: "🧵", labelEn: "Thread", labelId: "Thread" },
            { key: "educational", icon: "📚", labelEn: "Edu", labelId: "Edukasi" },
            { key: "hype", icon: "🔥", labelEn: "Hype", labelId: "Hype" },
          ] as const
        ).map(({ key, icon, labelEn, labelId }) => (
          <button
            key={key}
            onClick={() => setStyle(key)}
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              style === key
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {icon} {lang === "en" ? labelEn : labelId}
          </button>
        ))}
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!query.trim() || isLoading}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-6"
      >
        {status === "researching"
          ? lang === "en"
            ? "🔍 Researching from docs, X, GitHub..."
            : "🔍 Research dari docs, X, GitHub..."
          : status === "generating"
            ? lang === "en"
              ? "✨ Generating via LLM precompile..."
              : "✨ Generate via LLM precompile..."
            : "✨ Generate Draft"}
      </button>

      {/* Research Sources */}
      {researchSources.length > 0 && (
        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
          <h3 className="text-xs font-bold text-gray-400 mb-2">
            📖 {lang === "en" ? "Sources:" : "Sumber:"}
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
            📝 {lang === "en" ? "Generated Draft:" : "Draft yang Di-generate:"}
          </h3>
          <div className="whitespace-pre-wrap text-gray-200 text-sm leading-relaxed">
            {draft}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm text-white transition-colors"
            >
              📋 {lang === "en" ? "Copy" : "Salin"}
            </button>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm text-white transition-colors"
            >
              🔄 {lang === "en" ? "Regenerate" : "Generate Ulang"}
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
            >
              ✏️ {lang === "en" ? "New Query" : "Pertanyaan Baru"}
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
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-gray-700 mt-8 text-center">
        {lang === "en"
          ? "⚠️ Draft only — you post it yourself on X"
          : "⚠️ Draft aja — lo yang post sendiri di X"}
      </p>
    </div>
  );
}

import { encodeAbiParameters, decodeAbiParameters, parseAbiParameters } from "viem";
import type { Address, Hex } from "viem";

// LLM Precompile address
export const LLM_PRECOMPILE =
  "0x0000000000000000000000000000000000000802" as const;

// Model to use (pinned for production)
export const LLM_MODEL = "zai-org/GLM-4.7-FP8";

// Default executor on Ritual Testnet (query TEEServiceRegistry for latest)
export const DEFAULT_EXECUTOR =
  "0xB42e435c4252A5a2E7440e37B609F00c61a0c91B" as Address;

/**
 * Encode a full 30-field LLM precompile request.
 *
 * ABI layout (30 fields):
 *   executor, encryptedSecrets, ttl, secretSignatures, userPublicKey,
 *   messagesJson, model, frequencyPenalty, logitBiasJson, logprobs,
 *   maxCompletionTokens, metadataJson, modalitiesJson, n, parallelToolCalls,
 *   presencePenalty, reasoningEffort, responseFormatData, seed, serviceTier,
 *   stopJson, stream, temperature, toolChoiceData, toolsData, topLogprobs,
 *   topP, user, piiEnabled, convoHistory
 */
export function encodeLLMRequest(params: {
  executor?: Address;
  messages: Array<{ role: string; content: string }>;
  maxCompletionTokens?: bigint;
  temperature?: bigint;
  ttl?: bigint;
}): Hex {
  const {
    executor = DEFAULT_EXECUTOR,
    messages,
    maxCompletionTokens = 4096n,
    temperature = 700n, // 0.7 * 1000
    ttl = 300n,
  } = params;

  const messagesJson = JSON.stringify(messages);

  return encodeAbiParameters(
    parseAbiParameters(
      [
        "address", // executor
        "bytes[]", // encryptedSecrets
        "uint256", // ttl
        "bytes[]", // secretSignatures
        "bytes", // userPublicKey
        "string", // messagesJson
        "string", // model
        "int256", // frequencyPenalty
        "string", // logitBiasJson
        "bool", // logprobs
        "int256", // maxCompletionTokens
        "string", // metadataJson
        "string", // modalitiesJson
        "uint256", // n
        "bool", // parallelToolCalls
        "int256", // presencePenalty
        "string", // reasoningEffort
        "bytes", // responseFormatData
        "int256", // seed
        "string", // serviceTier
        "string", // stopJson
        "bool", // stream
        "int256", // temperature
        "bytes", // toolChoiceData
        "bytes", // toolsData
        "int256", // topLogprobs
        "int256", // topP
        "string", // user
        "bool", // piiEnabled
        "(string,string,string)", // convoHistory (StorageRef tuple)
      ].join(", ")
    ),
    [
      executor, // 0: executor
      [], // 1: encryptedSecrets (empty for now)
      ttl, // 2: ttl (300 blocks)
      [], // 3: secretSignatures
      "0x", // 4: userPublicKey
      messagesJson, // 5: messagesJson
      LLM_MODEL, // 6: model
      0n, // 7: frequencyPenalty
      "", // 8: logitBiasJson
      false, // 9: logprobs
      maxCompletionTokens, // 10: maxCompletionTokens (>=4096 for GLM)
      "", // 11: metadataJson
      "", // 12: modalitiesJson
      1n, // 13: n
      true, // 14: parallelToolCalls
      0n, // 15: presencePenalty
      "medium", // 16: reasoningEffort
      "0x", // 17: responseFormatData
      -1n, // 18: seed (null)
      "auto", // 19: serviceTier
      "", // 20: stopJson
      false, // 21: stream
      temperature, // 22: temperature (scaled ×1000)
      "0x", // 23: toolChoiceData
      "0x", // 24: toolsData
      -1n, // 25: topLogprobs (null)
      1000n, // 26: topP (1.0 × 1000)
      "", // 27: user
      false, // 28: piiEnabled
      ["", "", ""], // 29: convoHistory (empty StorageRef — no history)
    ]
  );
}

/**
 * Decode the LLM response from spcCalls output.
 *
 * Response ABI:
 *   (bytes simmedInput, bytes actualOutput)
 *
 * actualOutput:
 *   (bool hasError, bytes completionData, bytes modelMetadata, string errorMessage, (string,string,string) updatedConvoHistory)
 *
 * completionData (ABI-encoded):
 *   (string id, string object, uint256 created, string model,
 *    string systemFingerprint, string serviceTier,
 *    uint256 choicesCount, bytes[] choicesData, bytes usageData)
 *
 * Each choicesData element:
 *   (uint256 index, string finishReason, bytes messageData)
 * messageData:
 *   (string role, string content, string refusal, uint256 toolCallsCount, bytes[] toolCallsData)
 */
export function decodeLLMResult(spcOutput: Hex): {
  content: string;
  model: string;
  finishReason: string;
  hasError: boolean;
  errorMessage: string;
} {
  // Unwrap async envelope: (bytes simmedInput, bytes actualOutput)
  const [, actualOutput] = decodeAbiParameters(
    parseAbiParameters("bytes, bytes"),
    spcOutput
  );

  // Decode response envelope (first 4 fields only — skip tuple)
  const [hasError, completionData, modelMetadataBytes, errorMessage] =
    decodeAbiParameters(
      parseAbiParameters("bool, bytes, bytes, string"),
      actualOutput as Hex
    );

  if (hasError) {
    return {
      content: "",
      model: "",
      finishReason: "error",
      hasError: true,
      errorMessage: errorMessage || "Unknown LLM error",
    };
  }

  // Decode completionData
  const [id, obj, created, model, , , choicesCount, choicesData] =
    decodeAbiParameters(
      parseAbiParameters(
        "string, string, uint256, string, string, string, uint256, bytes[], bytes"
      ),
      completionData as Hex
    );

  // Extract content from first choice
  let content = "";
  let finishReason = "";

  if (choicesCount > 0n && choicesData.length > 0) {
    const [, reason, messageData] = decodeAbiParameters(
      parseAbiParameters("uint256, string, bytes"),
      choicesData[0] as Hex
    );
    finishReason = reason;

    const [, messageContent] = decodeAbiParameters(
      parseAbiParameters("string, string, string, uint256, bytes[]"),
      messageData as Hex
    );
    content = messageContent;
  }

  // Clean up content — remove <think>...</think> blocks from reasoning models
  const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  return {
    content: cleanContent,
    model: model as string,
    finishReason,
    hasError: false,
    errorMessage: "",
  };
}

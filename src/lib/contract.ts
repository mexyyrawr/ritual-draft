export const RITUAL_DRAFT_CONTRACT =
  "0xc35DD2db7947Ca48f13af94cfeD8273Cb70D0304" as const;

export const RITUAL_DRAFT_ABI = [
  {
    type: "function",
    name: "generateDraft",
    inputs: [{ name: "llmInput", type: "bytes" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "getDraftAuthor",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isDraftPending",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextDraftId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "DraftRequested",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "author", type: "address", indexed: true },
    ],
  },
] as const;

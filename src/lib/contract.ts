export const RITUAL_DRAFT_CONTRACT =
  "0xe7550a2F181840e3dc4e8CFD49dbdb41a2151664" as const;

export const RITUAL_DRAFT_ABI = [
  {
    type: "function",
    name: "generateDraft",
    inputs: [{ name: "llmInput", type: "bytes" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getDraft",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "author", type: "address" },
      { name: "content", type: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserDrafts",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
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
    type: "function",
    name: "depositForFees",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "event",
    name: "DraftGenerated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "author", type: "address", indexed: true },
      { name: "content", type: "string", indexed: false },
    ],
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

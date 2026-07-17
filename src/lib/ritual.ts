export const RITUAL_ADDRESSES = {
  PRECOMPILE: {
    LLM: "0x0000000000000000000000000000000000000802" as const,
  },
  SYSTEM: {
    WALLET: "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948" as const,
    ASYNC_JOB_TRACKER: "0xC069FFCa0389f44eCA2C626e55491b0ab045AEF5" as const,
    TEE_SERVICE_REGISTRY: "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F" as const,
  },
} as const;

export const RITUAL_WALLET_ABI = [
  {
    type: "function" as const,
    name: "balanceOf",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "lockUntil",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "deposit",
    inputs: [{ name: "lockDuration", type: "uint256" }],
    outputs: [],
    stateMutability: "payable" as const,
  },
] as const;

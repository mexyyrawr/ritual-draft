/**
 * Raw RPC helper — bypasses viem to preserve Ritual-specific fields (spcCalls).
 * viem's getTransactionReceipt strips non-standard fields.
 */

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.ritualfoundation.org";

export async function rawGetTransactionReceipt(
  hash: `0x${string}`
): Promise<any | null> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getTransactionReceipt",
      params: [hash],
      id: 1,
    }),
  });

  const data = await res.json();
  return data.result ?? null;
}

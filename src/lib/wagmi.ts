import { createConfig, http, injected } from "wagmi";
import { ritualChain } from "./chain";

export const wagmiConfig = createConfig({
  chains: [ritualChain],
  connectors: [injected()],
  transports: {
    [ritualChain.id]: http(),
  },
});

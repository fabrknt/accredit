import { createPublicClient, http } from "viem";

import { RPC_URL, hashkeyTestnet } from "./config";

export const publicClient = createPublicClient({
  chain: hashkeyTestnet,
  transport: http(RPC_URL),
});

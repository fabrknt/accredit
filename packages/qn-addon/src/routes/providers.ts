import { Router, Request, Response } from "express";
import { Connection } from "@solana/web3.js";
import { instanceLookup } from "../middleware/instance-lookup";
import {
  listProviders,
  checkProviderVerification,
  aggregateVerification,
} from "../services/provider-service";

const router = Router();

/**
 * Build a Connection from the provisioned instance's RPC URL.
 */
function getConnection(req: Request): Connection {
  const httpUrl = req.instance!.http_url;
  return new Connection(httpUrl, "confirmed");
}

/* ------------------------------------------------------------------ */
/*  GET /v1/kyc/providers — list available providers                   */
/* ------------------------------------------------------------------ */
router.get(
  "/v1/kyc/providers",
  async (_req: Request, res: Response) => {
    try {
      const providers = listProviders();
      res.json({ status: "ok", providers });
    } catch (err: any) {
      console.error("[kyc/providers] error:", err.message);
      res.status(500).json({ error: "Failed to list providers" });
    }
  },
);

/* ------------------------------------------------------------------ */
/*  POST /v1/kyc/verify/:provider/:wallet — check provider status      */
/* ------------------------------------------------------------------ */
router.post(
  "/v1/kyc/verify/:provider/:wallet",
  instanceLookup,
  async (req: Request, res: Response) => {
    try {
      const { provider, wallet } = req.params;

      if (!provider || !wallet) {
        res
          .status(400)
          .json({ error: "Missing provider or wallet parameter" });
        return;
      }

      const connection = getConnection(req);
      const result = await checkProviderVerification(
        connection,
        provider as string,
        wallet as string,
      );

      if (!result) {
        res.status(404).json({
          error: "No verification found for wallet with this provider",
        });
        return;
      }

      res.json({ status: "ok", result });
    } catch (err: any) {
      console.error("[kyc/verify/:provider/:wallet] error:", err.message);

      if (err.message?.includes("Unknown provider")) {
        res.status(400).json({ error: err.message });
        return;
      }

      res.status(500).json({ error: "Provider verification check failed" });
    }
  },
);

/* ------------------------------------------------------------------ */
/*  POST /v1/kyc/verify/aggregate — multi-provider aggregate check     */
/* ------------------------------------------------------------------ */
router.post(
  "/v1/kyc/verify/aggregate",
  instanceLookup,
  async (req: Request, res: Response) => {
    try {
      const { wallet, strategy, providers } = req.body;

      if (!wallet) {
        res.status(400).json({ error: "Missing wallet in request body" });
        return;
      }

      if (!strategy) {
        res.status(400).json({ error: "Missing strategy in request body" });
        return;
      }

      if (
        !Array.isArray(providers) ||
        providers.length === 0
      ) {
        res
          .status(400)
          .json({ error: "providers must be a non-empty array" });
        return;
      }

      const validStrategies = ["any", "all", "majority", "highest"];
      if (!validStrategies.includes(strategy)) {
        res.status(400).json({
          error: `Invalid strategy. Must be one of: ${validStrategies.join(", ")}`,
        });
        return;
      }

      const connection = getConnection(req);
      const result = await aggregateVerification(connection, {
        wallet,
        strategy,
        providers,
      });

      res.json({ status: "ok", ...result });
    } catch (err: any) {
      console.error("[kyc/verify/aggregate] error:", err.message);
      res
        .status(500)
        .json({ error: "Aggregate verification check failed" });
    }
  },
);

export default router;

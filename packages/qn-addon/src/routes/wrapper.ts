import { Router, Request, Response } from "express";
import { Connection } from "@solana/web3.js";
import { instanceLookup } from "../middleware/instance-lookup";
import {
  getAllWrapperConfigs,
  getWrapperConfigByMint,
  getWrapperSupply,
} from "../services/wrapper-service";

const router = Router();

/**
 * Build a Connection from the provisioned instance's RPC URL.
 */
function getConnection(req: Request): Connection {
  const httpUrl = req.instance!.http_url;
  return new Connection(httpUrl, "confirmed");
}

/* ------------------------------------------------------------------ */
/*  GET /v1/wrapper/configs — list all wrapper configs                 */
/* ------------------------------------------------------------------ */
router.get(
  "/v1/wrapper/configs",
  instanceLookup,
  async (req: Request, res: Response) => {
    try {
      const connection = getConnection(req);
      const configs = await getAllWrapperConfigs(connection);

      res.json({ status: "ok", configs });
    } catch (err: any) {
      console.error("[wrapper/configs] error:", err.message);
      res.status(500).json({ error: "Failed to fetch wrapper configs" });
    }
  },
);

/* ------------------------------------------------------------------ */
/*  GET /v1/wrapper/:underlyingMint — get wrapper config for a mint    */
/* ------------------------------------------------------------------ */
router.get(
  "/v1/wrapper/:underlyingMint",
  instanceLookup,
  async (req: Request, res: Response) => {
    try {
      const { underlyingMint } = req.params;

      if (!underlyingMint) {
        res
          .status(400)
          .json({ error: "Missing underlyingMint parameter" });
        return;
      }

      const connection = getConnection(req);
      const config = await getWrapperConfigByMint(
        connection,
        underlyingMint as string,
      );

      if (!config) {
        res
          .status(404)
          .json({ error: "No wrapper config found for underlying mint" });
        return;
      }

      res.json({ status: "ok", config });
    } catch (err: any) {
      console.error("[wrapper/:underlyingMint] error:", err.message);
      res.status(500).json({ error: "Failed to fetch wrapper config" });
    }
  },
);

/* ------------------------------------------------------------------ */
/*  GET /v1/wrapper/:underlyingMint/supply — get supply stats          */
/* ------------------------------------------------------------------ */
router.get(
  "/v1/wrapper/:underlyingMint/supply",
  instanceLookup,
  async (req: Request, res: Response) => {
    try {
      const { underlyingMint } = req.params;

      if (!underlyingMint) {
        res
          .status(400)
          .json({ error: "Missing underlyingMint parameter" });
        return;
      }

      const connection = getConnection(req);
      const supply = await getWrapperSupply(
        connection,
        underlyingMint as string,
      );

      if (!supply) {
        res
          .status(404)
          .json({ error: "No wrapper found for underlying mint" });
        return;
      }

      res.json({ status: "ok", supply });
    } catch (err: any) {
      console.error("[wrapper/:underlyingMint/supply] error:", err.message);
      res.status(500).json({ error: "Failed to fetch wrapper supply" });
    }
  },
);

export default router;

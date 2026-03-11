import express from "express";
import cors from "cors";
import morgan from "morgan";
import { requestId } from "./middleware/request-id";
import { apiLimiter } from "./middleware/rate-limit";
import { errorHandler } from "./middleware/error-handler";

import healthcheckRoutes from "./routes/healthcheck";
import provisionRoutes from "./routes/provision";
import kycRoutes from "./routes/kyc";
import routeRoutes from "./routes/route";
import zkRoutes from "./routes/zk";
import identityRoutes from "./routes/identity";
import trustRoutes from "./routes/trust";
import providerRoutes from "./routes/providers";
import wrapperRoutes from "./routes/wrapper";

const app = express();

/* ------------------------------------------------------------------ */
/*  Global middleware                                                   */
/* ------------------------------------------------------------------ */
app.use(cors());
app.use(express.json());
app.use(morgan("short"));
app.use(requestId);
app.use(apiLimiter);

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */
app.use(healthcheckRoutes);
app.use(provisionRoutes);
app.use(kycRoutes);
app.use(routeRoutes);
app.use(zkRoutes);
app.use(identityRoutes);
app.use(trustRoutes);
app.use(providerRoutes);
app.use(wrapperRoutes);

/* ------------------------------------------------------------------ */
/*  Error handler (must be last)                                       */
/* ------------------------------------------------------------------ */
app.use(errorHandler);

export default app;

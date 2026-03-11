import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3034", 10),
  qnBasicAuthUsername: process.env.QN_BASIC_AUTH_USERNAME || "",
  qnBasicAuthPassword: process.env.QN_BASIC_AUTH_PASSWORD || "",
  dbPath: process.env.DB_PATH || "./accredit-qn.db",
  transferHookProgramId:
    process.env.TRANSFER_HOOK_PROGRAM_ID ||
    "ACCReD1tKYCgateway1111111111111111111111111",
  wrapperProgramId:
    process.env.WRAPPER_PROGRAM_ID ||
    "CWRPxn8XsLkWW5fN5RYkWRQr5o4bT1RaAi3AhAPDnj1L",

  /* KYC provider configuration */
  civicGatekeeperNetwork: process.env.CIVIC_GATEKEEPER_NETWORK || "",
  worldcoinAppId: process.env.WORLDCOIN_APP_ID || "",
  worldcoinActionId: process.env.WORLDCOIN_ACTION_ID || "",
  worldcoinApiUrl:
    process.env.WORLDCOIN_API_URL || "https://developer.worldcoin.org",
};

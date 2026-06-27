export const identityRegistryAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "isVerified",
    inputs: [
      { name: "account", type: "address" },
      { name: "minKycLevel", type: "uint8" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "isFrozen",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "identityOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "kycLevel", type: "uint8" },
          { name: "jurisdiction", type: "uint16" },
          { name: "expiry", type: "uint64" },
          { name: "whitelisted", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "registerIdentity",
    inputs: [
      { name: "account", type: "address" },
      { name: "kycLevel", type: "uint8" },
      { name: "jurisdiction", type: "uint16" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "revokeIdentity",
    inputs: [{ name: "account", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "setAddressFrozen",
    inputs: [
      { name: "account", type: "address" },
      { name: "frozen", type: "bool" },
    ],
    outputs: [],
  },
] as const;

export const amlOracleAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "riskOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "score", type: "uint8" },
          { name: "updatedAt", type: "uint64" },
          { name: "modelRef", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "isClean",
    inputs: [
      { name: "account", type: "address" },
      { name: "maxScore", type: "uint8" },
      { name: "maxAge", type: "uint64" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "attestRisk",
    inputs: [
      { name: "account", type: "address" },
      { name: "score", type: "uint8" },
      { name: "modelRef", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export const modularComplianceAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "canTransfer",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "allowed", type: "bool" },
      { name: "reason", type: "string" },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "canReceive",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "allowed", type: "bool" },
      { name: "reason", type: "string" },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "canRedeem",
    inputs: [
      { name: "from", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "allowed", type: "bool" },
      { name: "reason", type: "string" },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "minKycLevel",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "maxRiskScore",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "maxRiskAge",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "setParams",
    inputs: [
      { name: "_minKycLevel", type: "uint8" },
      { name: "_maxRiskScore", type: "uint8" },
      { name: "_maxRiskAge", type: "uint64" },
      { name: "_maxTransferAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "setIdentityRegistry",
    inputs: [{ name: "_identityRegistry", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "setAmlOracle",
    inputs: [{ name: "_amlOracle", type: "address" }],
    outputs: [],
  },
] as const;

export const compliantTokenAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "burn",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "burnFrom",
    inputs: [
      { name: "from", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "forcedTransfer",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const mockUsdcAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const compliantWrapperAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "underlying",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "cToken",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "wrap",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "unwrap",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

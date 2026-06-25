#!/usr/bin/env bash
set -euo pipefail

: "${REGISTRY:?set REGISTRY}"
: "${AML:?set AML}"
: "${TOKEN:?set TOKEN}"
: "${DEMO_ALICE:?set DEMO_ALICE}"

RPC_URL="${RPC_URL:-https://testnet.hsk.xyz}"

echo "token.name()"
cast call "$TOKEN" "name()(string)" --rpc-url "$RPC_URL"

echo "token.symbol()"
cast call "$TOKEN" "symbol()(string)" --rpc-url "$RPC_URL"

echo "registry.isVerified(DEMO_ALICE, 1)"
cast call "$REGISTRY" "isVerified(address,uint8)(bool)" "$DEMO_ALICE" 1 --rpc-url "$RPC_URL"

echo "aml.isClean(DEMO_ALICE, 50, 30 days)"
cast call "$AML" "isClean(address,uint8,uint64)(bool)" "$DEMO_ALICE" 50 2592000 --rpc-url "$RPC_URL"

#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"
SCORER_DIR="${REPO_ROOT}/scorer"
WATCHLIST_FILE="${SCORER_DIR}/src/watchlist.json"

DEFAULT_RPC_URL="https://testnet.hsk.xyz"
EXPLORER_BASE_URL="https://testnet-explorer.hsk.xyz/address"
THIRTY_DAYS_SECONDS="2592000"
DEMO_KYC_LEVEL="2"
DEMO_JURISDICTION="392"
DEMO_EXPIRY="0"
LOW_RISK_SCORE="5"
MIN_GAS_ETH="0.02"
FUND_GAS_ETH="0.05"
ALICE_TARGET_BALANCE_WEI="1000000000000000000000"
TRANSFER_AMOUNT_WEI="50000000000000000000"
WRAP_AMOUNT_WEI="300000000000000000000"
UNWRAP_AMOUNT_WEI="100000000000000000000"
MAX_UINT256="115792089237316195423570985008687907853269984665640564039457584007913129639935"
MODEL_REF_TEXT="hashkey-testnet-demo-aml-v0.1"

NONINTERACTIVE="${NONINTERACTIVE:-0}"
if [[ "${1:-}" == "--no-pause" ]]; then
  NONINTERACTIVE=1
  shift
fi
if [[ $# -ne 0 ]]; then
  echo "Usage: $0 [--no-pause]" >&2
  exit 1
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

pause_between_beats() {
  if [[ "$NONINTERACTIVE" == "1" ]]; then
    return
  fi
  printf '\nPress Enter to continue...'
  read -r _
}

print_header() {
  local beat="$1"
  local title="$2"
  printf '\n== Beat %s: %s ==\n' "$beat" "$title"
}

trim_leading_zeros() {
  local value="$1"
  value="${value#"${value%%[!0]*}"}"
  if [[ -z "$value" ]]; then
    printf '0'
  else
    printf '%s' "$value"
  fi
}

big_lt() {
  local a b
  a="$(trim_leading_zeros "$1")"
  b="$(trim_leading_zeros "$2")"
  if (( ${#a} < ${#b} )); then
    return 0
  fi
  if (( ${#a} > ${#b} )); then
    return 1
  fi
  [[ "$a" < "$b" ]]
}

big_sub() {
  node -e 'console.log((BigInt(process.argv[1]) - BigInt(process.argv[2])).toString())' "$1" "$2"
}

format_token() {
  cast from-wei "$1"
}

extract_tx_hash() {
  local output="$1"
  local tx_hash
  # Compact-JSON receipt (this node): pull the transactionHash field specifically,
  # since the blob also contains blockHash/topics that are likewise 64-hex.
  tx_hash="$(printf '%s\n' "$output" | grep -Eo '"transactionHash":"0x[a-fA-F0-9]{64}"' | head -n 1 | grep -Eo '0x[a-fA-F0-9]{64}' || true)"
  if [[ -n "$tx_hash" ]]; then
    printf '%s' "$tx_hash"
    return
  fi
  # Table format: a "transactionHash   0x..." row.
  tx_hash="$(printf '%s\n' "$output" | awk '/transactionHash/ {print $2; exit}' | grep -Eo '0x[a-fA-F0-9]{64}' || true)"
  if [[ -n "$tx_hash" ]]; then
    printf '%s' "$tx_hash"
    return
  fi
  printf 'unparsed'
}

send_and_capture() {
  local output
  output="$("$@" 2>&1)"
  printf '%s' "$output"
}

erc20_balance() {
  cast call "$1" "balanceOf(address)(uint256)" "$2" --rpc-url "$RPC_URL" | awk '{print $1}'
}

erc20_allowance() {
  cast call "$1" "allowance(address,address)(uint256)" "$2" "$3" --rpc-url "$RPC_URL" | awk '{print $1}'
}

native_balance_eth() {
  cast balance "$1" --ether --rpc-url "$RPC_URL" | tr -d '[:space:]'
}

ensure_alice_token_balance() {
  local alice_balance mint_amount mint_output mint_tx
  alice_balance="$(erc20_balance "$TOKEN" "$DEMO_ALICE")"
  if big_lt "$alice_balance" "$ALICE_TARGET_BALANCE_WEI"; then
    mint_amount="$(big_sub "$ALICE_TARGET_BALANCE_WEI" "$alice_balance")"
    echo "Alice cHSP balance low; topping up to $(format_token "$ALICE_TARGET_BALANCE_WEI") cHSP."
    mint_output="$(send_and_capture cast send "$TOKEN" \
      "mint(address,uint256)" "$DEMO_ALICE" "$mint_amount" \
      --private-key "$PRIVATE_KEY" \
      --rpc-url "$RPC_URL")"
    mint_tx="$(extract_tx_hash "$mint_output")"
    echo "Top-up tx: ${mint_tx}"
  fi
}

ensure_alice_gas() {
  local alice_hsk balance_cmp fund_output fund_tx
  alice_hsk="$(native_balance_eth "$DEMO_ALICE")"
  balance_cmp="$(awk -v current="$alice_hsk" -v min="$MIN_GAS_ETH" 'BEGIN { if ((current + 0) < (min + 0)) print "low"; else print "ok"; }')"
  if [[ "$balance_cmp" == "low" ]]; then
    echo "Alice HSK balance is low (${alice_hsk} HSK); funding ${FUND_GAS_ETH} HSK from deployer."
    fund_output="$(send_and_capture cast send "$DEMO_ALICE" \
      --value "${FUND_GAS_ETH}ether" \
      --private-key "$PRIVATE_KEY" \
      --rpc-url "$RPC_URL")"
    fund_tx="$(extract_tx_hash "$fund_output")"
    echo "Funding tx: ${fund_tx}"
  fi
}

ensure_dead_registered() {
  local verified frozen unfreeze_output unfreeze_tx register_output register_tx
  verified="$(cast call "$REGISTRY" "isVerified(address,uint8)(bool)" "$DEAD_ADDRESS" 1 --rpc-url "$RPC_URL" | tr -d '[:space:]')"
  frozen="$(cast call "$REGISTRY" "isFrozen(address)(bool)" "$DEAD_ADDRESS" --rpc-url "$RPC_URL" | tr -d '[:space:]')"

  if [[ "$frozen" == "true" ]]; then
    echo "Dead address is frozen; unfreezing so AML remains the blocker."
    unfreeze_output="$(send_and_capture cast send "$REGISTRY" \
      "setAddressFrozen(address,bool)" "$DEAD_ADDRESS" false \
      --private-key "$PRIVATE_KEY" \
      --rpc-url "$RPC_URL")"
    unfreeze_tx="$(extract_tx_hash "$unfreeze_output")"
    echo "Unfreeze tx: ${unfreeze_tx}"
  fi

  if [[ "$verified" != "true" ]]; then
    echo "Registering dead address as KYC level ${DEMO_KYC_LEVEL} to isolate AML as the blocker."
    register_output="$(send_and_capture cast send "$REGISTRY" \
      "registerIdentity(address,uint8,uint16,uint64)" "$DEAD_ADDRESS" "$DEMO_KYC_LEVEL" "$DEMO_JURISDICTION" "$DEMO_EXPIRY" \
      --private-key "$PRIVATE_KEY" \
      --rpc-url "$RPC_URL")"
    register_tx="$(extract_tx_hash "$register_output")"
    echo "Register tx: ${register_tx}"
  else
    echo "Dead address already KYC-registered."
  fi
}

ensure_deployer_compliant() {
  local verified clean register_output register_tx attest_output attest_tx
  verified="$(cast call "$REGISTRY" "isVerified(address,uint8)(bool)" "$DEPLOYER_ADDRESS" 1 --rpc-url "$RPC_URL" | tr -d '[:space:]')"
  clean="$(cast call "$AML" "isClean(address,uint8,uint64)(bool)" "$DEPLOYER_ADDRESS" 50 "$THIRTY_DAYS_SECONDS" --rpc-url "$RPC_URL" | tr -d '[:space:]')"

  if [[ "$verified" != "true" ]]; then
    echo "Deployer not KYC-verified; registering for wrap/unwrap demo."
    register_output="$(send_and_capture cast send "$REGISTRY" \
      "registerIdentity(address,uint8,uint16,uint64)" "$DEPLOYER_ADDRESS" "$DEMO_KYC_LEVEL" "$DEMO_JURISDICTION" "$DEMO_EXPIRY" \
      --private-key "$PRIVATE_KEY" \
      --rpc-url "$RPC_URL")"
    register_tx="$(extract_tx_hash "$register_output")"
    echo "Register tx: ${register_tx}"
  fi

  if [[ "$clean" != "true" ]]; then
    echo "Deployer not AML-clean; attesting low risk for wrap/unwrap demo."
    attest_output="$(send_and_capture cast send "$AML" \
      "attestRisk(address,uint8,bytes32)" "$DEPLOYER_ADDRESS" "$LOW_RISK_SCORE" "$(cast keccak "$MODEL_REF_TEXT")" \
      --private-key "$PRIVATE_KEY" \
      --rpc-url "$RPC_URL")"
    attest_tx="$(extract_tx_hash "$attest_output")"
    echo "Attest tx: ${attest_tx}"
  fi
}

ensure_mockhsp_balance_and_allowance() {
  local balance allowance mint_amount mint_output mint_tx approve_output approve_tx
  balance="$(erc20_balance "$MOCKHSP" "$DEPLOYER_ADDRESS")"
  if big_lt "$balance" "$WRAP_AMOUNT_WEI"; then
    mint_amount="$(big_sub "$WRAP_AMOUNT_WEI" "$balance")"
    echo "Deployer MockHSP balance low; minting up to $(format_token "$WRAP_AMOUNT_WEI") HSP."
    mint_output="$(send_and_capture cast send "$MOCKHSP" \
      "mint(address,uint256)" "$DEPLOYER_ADDRESS" "$mint_amount" \
      --private-key "$PRIVATE_KEY" \
      --rpc-url "$RPC_URL")"
    mint_tx="$(extract_tx_hash "$mint_output")"
    echo "Mint tx: ${mint_tx}"
  fi

  allowance="$(erc20_allowance "$MOCKHSP" "$DEPLOYER_ADDRESS" "$WRAPPER")"
  if big_lt "$allowance" "$WRAP_AMOUNT_WEI"; then
    echo "Approving wrapper to spend MockHSP."
    approve_output="$(send_and_capture cast send "$MOCKHSP" \
      "approve(address,uint256)" "$WRAPPER" "$MAX_UINT256" \
      --private-key "$PRIVATE_KEY" \
      --rpc-url "$RPC_URL")"
    approve_tx="$(extract_tx_hash "$approve_output")"
    echo "Approve tx: ${approve_tx}"
  fi
}

require_cmd bash
require_cmd cast
require_cmd node
require_cmd pnpm

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Expected env file at ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

RPC_URL="${RPC_URL:-$DEFAULT_RPC_URL}"
AML_ORACLE_ADDRESS="${AML_ORACLE_ADDRESS:-${AML:-}}"
SCORER_PRIVATE_KEY="${SCORER_PRIVATE_KEY:-${PRIVATE_KEY:-}}"

require_env PRIVATE_KEY
require_env REGISTRY
require_env AML
require_env COMPLIANCE
require_env TOKEN
require_env MOCKHSP
require_env WRAPPER
require_env DEMO_ALICE
require_env DEMO_BOB
require_env ALICE_KEY
require_env RPC_URL
require_env AML_ORACLE_ADDRESS
require_env SCORER_PRIVATE_KEY

if [[ ! -f "$WATCHLIST_FILE" ]]; then
  echo "Missing scorer watchlist at ${WATCHLIST_FILE}" >&2
  exit 1
fi

DEAD_ADDRESS="$(grep -Eo '0x[a-fA-F0-9]{40}' "$WATCHLIST_FILE" | head -n 1 || true)"
if [[ -z "$DEAD_ADDRESS" ]]; then
  echo "Could not derive dead address from ${WATCHLIST_FILE}" >&2
  exit 1
fi

DEPLOYER_ADDRESS="$(cast wallet address --private-key "$PRIVATE_KEY" | tr -d '[:space:]')"
ALICE_FROM_KEY="$(cast wallet address --private-key "$ALICE_KEY" | tr -d '[:space:]')"

alice_from_key_lc="$(printf '%s' "$ALICE_FROM_KEY" | tr 'A-Z' 'a-z')"
demo_alice_lc="$(printf '%s' "$DEMO_ALICE" | tr 'A-Z' 'a-z')"
if [[ "$alice_from_key_lc" != "$demo_alice_lc" ]]; then
  echo "ALICE_KEY does not match DEMO_ALICE." >&2
  exit 1
fi

print_header "0" "The Stack Is Live"
for entry in \
  "IdentityRegistry:$REGISTRY" \
  "AmlOracle:$AML" \
  "ModularCompliance:$COMPLIANCE" \
  "CompliantToken:$TOKEN" \
  "MockHSP:$MOCKHSP" \
  "CompliantWrapper:$WRAPPER"
do
  name="${entry%%:*}"
  address="${entry##*:}"
  printf '%-18s %s\n' "${name}" "${address}"
  printf '  %s/%s\n' "$EXPLORER_BASE_URL" "$address"
done
pause_between_beats

ensure_alice_token_balance

print_header "1" "Onboard"
echo "Alice: ${DEMO_ALICE}"
echo "Bob:   ${DEMO_BOB}"
echo "isVerified(alice,1): $(cast call "$REGISTRY" "isVerified(address,uint8)(bool)" "$DEMO_ALICE" 1 --rpc-url "$RPC_URL" | tr -d '[:space:]')"
echo "isClean(alice,50,30d): $(cast call "$AML" "isClean(address,uint8,uint64)(bool)" "$DEMO_ALICE" 50 "$THIRTY_DAYS_SECONDS" --rpc-url "$RPC_URL" | tr -d '[:space:]')"
echo "balanceOf(alice): $(format_token "$(erc20_balance "$TOKEN" "$DEMO_ALICE")") cHSP"
pause_between_beats

print_header "2" "Compliant Payment"
ensure_alice_gas
alice_balance_before="$(format_token "$(erc20_balance "$TOKEN" "$DEMO_ALICE")")"
bob_balance_before_wei="$(erc20_balance "$TOKEN" "$DEMO_BOB")"
bob_balance_before="$(format_token "$bob_balance_before_wei")"
echo "Bob balance before: ${bob_balance_before} cHSP"
payment_output="$(send_and_capture cast send "$TOKEN" \
  "transfer(address,uint256)" "$DEMO_BOB" "$TRANSFER_AMOUNT_WEI" \
  --private-key "$ALICE_KEY" \
  --rpc-url "$RPC_URL")"
payment_tx="$(extract_tx_hash "$payment_output")"
bob_balance_after_wei="$(erc20_balance "$TOKEN" "$DEMO_BOB")"
bob_balance_after="$(format_token "$bob_balance_after_wei")"
alice_balance_after="$(format_token "$(erc20_balance "$TOKEN" "$DEMO_ALICE")")"
echo "Alice balance: ${alice_balance_before} -> ${alice_balance_after} cHSP"
echo "Bob balance:   ${bob_balance_before} -> ${bob_balance_after} cHSP"
echo "Tx hash: ${payment_tx}"
echo "Explorer: https://testnet-explorer.hsk.xyz/tx/${payment_tx}"
pause_between_beats

print_header "3" "AI-AML Scorer"
echo "Target: ${DEAD_ADDRESS}"
(
  cd "$SCORER_DIR"
  export RPC_URL AML_ORACLE_ADDRESS SCORER_PRIVATE_KEY
  pnpm -s score score "$DEAD_ADDRESS" --submit
)
echo "riskOf(dead):"
cast call "$AML" "riskOf(address)((uint8,uint64,bytes32))" "$DEAD_ADDRESS" --rpc-url "$RPC_URL"
pause_between_beats

print_header "4" "Blocked Transfer"
ensure_dead_registered
set +e
blocked_output="$(cast send "$TOKEN" \
  "transfer(address,uint256)" "$DEAD_ADDRESS" "$TRANSFER_AMOUNT_WEI" \
  --private-key "$ALICE_KEY" \
  --rpc-url "$RPC_URL" 2>&1)"
blocked_status=$?
set -e

if [[ "$blocked_status" -eq 0 ]]; then
  echo "Expected alice -> dead to revert, but it succeeded." >&2
  printf '%s\n' "$blocked_output" >&2
  exit 1
fi

echo "Live tx blocked as expected."
echo "cast send output:"
printf '%s\n' "$blocked_output"

set +e
revert_probe_output="$(cast call "$TOKEN" \
  "transfer(address,uint256)(bool)" "$DEAD_ADDRESS" "$TRANSFER_AMOUNT_WEI" \
  --from "$DEMO_ALICE" \
  --rpc-url "$RPC_URL" 2>&1)"
revert_probe_status=$?
set -e

echo "cast call --from ${DEMO_ALICE}:"
printf '%s\n' "$revert_probe_output"
if [[ "$revert_probe_status" -eq 0 ]]; then
  echo "Expected the diagnostic cast call to revert." >&2
  exit 1
fi
if ! printf '%s\n' "$revert_probe_output" | grep -q "recipient failed AML screen"; then
  echo "Did not find expected revert reason: recipient failed AML screen" >&2
  exit 1
fi
pause_between_beats

print_header "5" "Wrap / Unwrap"
ensure_deployer_compliant
ensure_mockhsp_balance_and_allowance
deployer_hsp_before_wei="$(erc20_balance "$MOCKHSP" "$DEPLOYER_ADDRESS")"
deployer_chsp_before_wei="$(erc20_balance "$TOKEN" "$DEPLOYER_ADDRESS")"
wrapper_hsp_before_wei="$(erc20_balance "$MOCKHSP" "$WRAPPER")"

wrap_output="$(send_and_capture cast send "$WRAPPER" \
  "wrap(uint256)" "$WRAP_AMOUNT_WEI" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$RPC_URL")"
wrap_tx="$(extract_tx_hash "$wrap_output")"

unwrap_output="$(send_and_capture cast send "$WRAPPER" \
  "unwrap(uint256)" "$UNWRAP_AMOUNT_WEI" \
  --private-key "$PRIVATE_KEY" \
  --rpc-url "$RPC_URL")"
unwrap_tx="$(extract_tx_hash "$unwrap_output")"

deployer_hsp_after_wei="$(erc20_balance "$MOCKHSP" "$DEPLOYER_ADDRESS")"
deployer_chsp_after_wei="$(erc20_balance "$TOKEN" "$DEPLOYER_ADDRESS")"
wrapper_hsp_after_wei="$(erc20_balance "$MOCKHSP" "$WRAPPER")"

echo "Deployer MockHSP: $(format_token "$deployer_hsp_before_wei") -> $(format_token "$deployer_hsp_after_wei") HSP"
echo "Deployer cHSP:    $(format_token "$deployer_chsp_before_wei") -> $(format_token "$deployer_chsp_after_wei") cHSP"
echo "Wrapper locked:   $(format_token "$wrapper_hsp_before_wei") -> $(format_token "$wrapper_hsp_after_wei") HSP"
echo "Net effect this beat: +200 cHSP / -200 HSP for deployer, +200 HSP locked in wrapper (1:1 backing)."
echo "Wrap tx:   ${wrap_tx}"
echo "Unwrap tx: ${unwrap_tx}"

printf '\nDemo complete.\n'

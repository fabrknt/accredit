# Demo Runner

`demo/run-demo.sh` drives the live HashKey testnet demo described in [docs/demo-script.md](/Users/hiroyusai/src/accredit/contracts-evm/docs/demo-script.md:1).

Prerequisites:
- `cast` and `bash`
- `pnpm` with the scorer dependencies already installed under `scorer/`
- A repo-root `.env` containing the deployed addresses and demo keys used by the testnet deployment

Run from anywhere:

```bash
bash demo/run-demo.sh
```

The script resolves paths relative to `demo/`, sources `../.env`, pauses between beats by default, and never prints a private key.

For a straight-through run without prompts:

```bash
NONINTERACTIVE=1 bash demo/run-demo.sh
```

or:

```bash
bash demo/run-demo.sh --no-pause
```

The script is rerunnable: it funds Alice with gas only if needed, re-registers the blocked recipient only if needed, and prepares the deployer for wrap/unwrap only when required.

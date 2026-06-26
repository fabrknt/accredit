# Demo recording (Puppeteer + Chromium → mp4)

Records the operations-console demo as a narrated (captioned) mp4.

## Run
```bash
# 1) serve the UI in production mode (faster/snappier than dev)
cd ../ui && pnpm build && node_modules/.bin/next start -p 3010 &
# 2) record (resets the cohort, drives the flow, writes accredit-demo.mp4)
cd ../demo-record && pnpm install --ignore-workspace && node record.mjs
```
Output: `accredit-demo.mp4` (1440×900, ~1m40s). Uses system ffmpeg (`/opt/homebrew/bin/ffmpeg`)
and Puppeteer's cached Chrome. The script injects caption overlays per the demo-script beats:
standby → Run sweep → console fills (KPIs/protect queue/growth inbox/accounts/audit) → Approve an
escalation → Flag a prospect → close. Silent + captioned; add a voiceover if desired.

For submission, upload the mp4 (e.g., YouTube) and link it on DoraHacks.

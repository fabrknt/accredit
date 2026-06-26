import puppeteer from "puppeteer";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";
import { spawn } from "node:child_process";

const URL = process.env.URL ?? "http://localhost:3010";
const RAW = "accredit-demo.raw.mp4";
const OUT = process.env.OUT ?? "accredit-demo.mp4";
const FFMPEG = process.env.FFMPEG ?? "/opt/homebrew/bin/ffmpeg";
const SWEEP_SPEED = 10; // timelapse factor for the on-chain sweep wait
const W = 1440, H = 900;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(cmd + " exited " + c))));
  });
}

async function main() {
  try {
    console.log("resetting cohort…");
    const r = await fetch(`${URL}/api/reset`, { method: "POST" });
    console.log("reset:", JSON.stringify(await r.json()));
  } catch (e) { console.log("reset skipped:", e.message); }

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
    args: [`--window-size=${W},${H}`, "--force-color-profile=srgb"],
  });
  const page = await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    window.__setCap = (t) => {
      let el = document.getElementById("demo-cap");
      if (!el) {
        el = document.createElement("div");
        el.id = "demo-cap";
        el.style.cssText =
          "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:1100px;" +
          "background:rgba(2,6,23,.82);color:#e2e8f0;font:600 22px/1.4 system-ui,sans-serif;" +
          "padding:14px 26px;border-radius:16px;border:1px solid rgba(56,189,248,.35);" +
          "box-shadow:0 10px 40px rgba(0,0,0,.5);z-index:2147483647;text-align:center;backdrop-filter:blur(4px)";
        document.body.appendChild(el);
      }
      el.textContent = t;
    };
  });

  const cap = (t) => page.evaluate((t) => window.__setCap(t), t);
  const clickText = async (t) => {
    const ok = await page.evaluate((t) => {
      const els = [...document.querySelectorAll("button, summary, a")];
      const el = els.find((e) => (e.textContent || "").trim().includes(t));
      if (el) { el.click(); return true; }
      return false;
    }, t);
    if (!ok) throw new Error("clickText not found: " + t);
  };
  const scrollTo = (t) =>
    page.evaluate((t) => {
      const els = [...document.querySelectorAll("h2,h3,section,div,table")];
      const el = els.find((e) => (e.textContent || "").includes(t));
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, t);
  const openDetails = (id) => page.evaluate((id) => { const d = document.getElementById(id); if (d) d.open = true; }, id);
  const waitText = async (t, timeout = 240000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await page.evaluate((t) => document.body.innerText.includes(t), t)) return;
      await sleep(800);
    }
    throw new Error("waitText timeout: " + t);
  };

  console.log("loading", URL);
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await waitText("Run sweep now", 30000);

  const recorder = new PuppeteerScreenRecorder(page, {
    fps: 25, ffmpeg_Path: FFMPEG, videoFrame: { width: W, height: H }, aspectRatio: "16:9",
  });
  await recorder.start(RAW);
  const recStart = Date.now();
  const at = () => (Date.now() - recStart) / 1000;
  let sweepClickSec = 0, populatedSec = 0;

  try {
    await cap("accredit — the AI operations layer for regulated finance on HashKey. Protect + Grow.");
    await sleep(4500);

    await cap("The console is on standby. One action: run the sweep.");
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((e) => (e.textContent || "").includes("Run sweep now"));
      if (b) b.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    await sleep(4000);

    await cap("One pass screens every account — live on HashKey testnet (real on-chain).");
    await clickText("Run sweep now");
    sweepClickSec = at();
    await sleep(1500);
    await waitText("Monitored", 240000);
    populatedSec = at();
    await sleep(1200);

    await cap("100% coverage in ~1 minute vs ~15 by hand. Every action a real on-chain transaction.");
    await scrollTo("Monitored");
    await sleep(5000);

    await cap("Protect: the AI auto-contains sanctions and escalates the judgment calls. It proposes — the human disposes.");
    await scrollTo("review queue");
    await sleep(4500);
    try { await clickText("Approve"); await cap("Approving the escalated freeze — the AI never moves funds on its own."); await sleep(6000); } catch (e) { console.log("approve skip:", e.message); }

    await cap("Grow: the same pass surfaces high-value prospects for BD — advisory, never front-running.");
    await scrollTo("Opportunity inbox");
    await sleep(4500);
    try { await clickText("Flag for outreach"); await sleep(3500); } catch (e) { console.log("flag skip:", e.message); }

    await cap("Every account on both dimensions — risk and opportunity — with a full on-chain audit trail.");
    await scrollTo("Monitored accounts");
    await sleep(4000);
    await scrollTo("Audit trail");
    await sleep(4000);

    // Manual interventions — the human's hands-on tools
    await cap("When a human needs to act by hand: manual interventions — screen, transfer policy, freeze / recover.");
    await openDetails("grp-intervene");
    await sleep(600);
    await page.evaluate(() => { const d = document.getElementById("grp-intervene"); if (d) d.scrollIntoView({ behavior: "smooth", block: "start" }); });
    await sleep(5500);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await cap("accredit — Protect + Grow, human in the loop. Live on HashKey.");
    await sleep(4500);
  } finally {
    await recorder.stop();
    await browser.close();
  }

  // Speed up only the on-chain sweep wait so the video stays tight.
  const A = (sweepClickSec + 3).toFixed(2);
  const B = Math.max(sweepClickSec + 4, populatedSec - 1).toFixed(2);
  console.log(`editing: speed sweep wait [${A}s..${B}s] x${SWEEP_SPEED}`);
  const fc =
    `[0:v]trim=0:${A},setpts=PTS-STARTPTS[a];` +
    `[0:v]trim=${A}:${B},setpts=(PTS-STARTPTS)/${SWEEP_SPEED}[b];` +
    `[0:v]trim=${B},setpts=PTS-STARTPTS[c];` +
    `[a][b][c]concat=n=3:v=1[v]`;
  await run(FFMPEG, ["-y", "-i", RAW, "-filter_complex", fc, "-map", "[v]", "-r", "25", "-pix_fmt", "yuv420p", OUT]);
  console.log("DONE ->", OUT);
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });

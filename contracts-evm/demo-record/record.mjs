import puppeteer from "puppeteer";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";

const URL = process.env.URL ?? "http://localhost:3010";
const OUT = process.env.OUT ?? "accredit-demo.mp4";
const FFMPEG = process.env.FFMPEG ?? "/opt/homebrew/bin/ffmpeg";
const W = 1440, H = 900;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Clean first-run state so the sweep shows onboarding + auto-freeze.
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

  // Caption overlay + helpers injected into every navigation.
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
  const waitText = async (t, timeout = 140000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const ok = await page.evaluate((t) => document.body.innerText.includes(t), t);
      if (ok) return;
      await sleep(800);
    }
    throw new Error("waitText timeout: " + t);
  };

  console.log("loading", URL);
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await waitText("Run sweep now", 30000);

  const recorder = new PuppeteerScreenRecorder(page, {
    fps: 25,
    ffmpeg_Path: FFMPEG,
    videoFrame: { width: W, height: H },
    aspectRatio: "16:9",
  });
  await recorder.start(OUT);
  try {

  // Beat 0 — title
  await cap("accredit — the AI operations layer for regulated finance on HashKey. Protect + Grow.");
  await sleep(4500);

  // Beat 1 — standby (center the glowing CTA above the caption)
  await cap("The console is on standby. One action: run the sweep.");
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((e) => (e.textContent || "").includes("Run sweep now"));
    if (b) b.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  await sleep(4000);

  // Beat 2 — run the sweep
  await cap("One pass screens every account — live on HashKey testnet (~1 min, real on-chain).");
  await clickText("Run sweep now");
  await sleep(1500);
  await waitText("Monitored", 240000); // KPI bar appears when the sweep finishes
  await sleep(1200);

  // Beat 3 — coverage / metrics
  await cap("100% coverage in ~1 minute vs ~15 by hand. Every action a real on-chain transaction.");
  await scrollTo("Monitored");
  await sleep(5000);

  // Beat 4 — Protect: human in the loop
  await cap("Protect: the AI auto-contains sanctions and escalates the judgment calls. It proposes — the human disposes.");
  await scrollTo("review queue");
  await sleep(4500);
  try { await clickText("Approve"); await cap("Approving the escalated freeze — the AI never moves funds on its own."); await sleep(6000); } catch (e) { console.log("approve skip:", e.message); }

  // Beat 5 — Grow
  await cap("Grow: the same pass surfaces high-value prospects for BD — advisory, never front-running.");
  await scrollTo("Opportunity inbox");
  await sleep(4500);
  try { await clickText("Flag for outreach"); await sleep(3500); } catch (e) { console.log("flag skip:", e.message); }

  // Beat 6 — accounts + audit
  await cap("Every account on both dimensions — risk and opportunity — with a full on-chain audit trail.");
  await scrollTo("Monitored accounts");
  await sleep(4500);
  await scrollTo("Audit trail");
  await sleep(4500);

  // Beat 7 — close
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await cap("accredit — Protect + Grow, human in the loop. Live on HashKey.");
  await sleep(4500);

  } finally {
    await recorder.stop();
    await browser.close();
  }
  console.log("DONE ->", OUT);
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });

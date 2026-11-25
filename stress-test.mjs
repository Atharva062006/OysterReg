/**
 * stress-test.mjs — Oyster Registration HTTP + Firebase Stress Tester
 *
 * Simulates real user registrations exactly as a browser would:
 *  1. Fetches the public event list from your deployed URL
 *  2. Validates and submits data via the Firebase JS SDK (same code path as the UI)
 *  3. Measures end-to-end latency with optional network throttling
 *
 * Usage:
 *   node stress-test.mjs [options]
 *
 * Options (all interactive if omitted):
 *   --url         Base URL of your deployed app, e.g. https://oyster.vercel.app
 *   --event       Event ID to register for, e.g. recruitment-2026
 *   --count       Total registrations to attempt (default: 50)
 *   --concurrency Max simultaneous users (default: 10)
 *   --network     Simulated network: fast | medium | slow | random (default: fast)
 *   --dry-run     Skip actual Firestore writes (smoke test only)
 *
 * Example:
 *   node stress-test.mjs --url https://myapp.vercel.app --event recruitment-2026 --count 100 --concurrency 20 --network medium
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  Timestamp,
} from "firebase/firestore";
import { createInterface } from "readline";
import https from "https";
import http from "http";

// ── Firebase config ───────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC5ICbFTGKHZq6uw9fkLnNpUgUNHt7Mh-E",
  authDomain: "oysterreg.firebaseapp.com",
  projectId: "oysterreg",
  storageBucket: "oysterreg.firebasestorage.app",
  messagingSenderId: "1002155483479",
  appId: "1:1002155483479:web:116cae095caa6cbfef9e12",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Network profiles (added delay simulating real-world connection quality) ──
const NETWORK_PROFILES = {
  fast:   { minMs: 10,  maxMs: 50,   label: "Fast 4G (~20 ms overhead)" },
  medium: { minMs: 80,  maxMs: 250,  label: "Average 4G (~150 ms overhead)" },
  slow:   { minMs: 300, maxMs: 900,  label: "Slow 3G (~600 ms overhead)" },
  random: { minMs: 10,  maxMs: 1000, label: "Random (10–1000 ms overhead)" },
};

// ── Fake data pools ───────────────────────────────────────────────────────────
const FIRST_NAMES = [
  "Aarav","Aditi","Arjun","Ananya","Bhavesh","Chirag","Disha","Esha",
  "Farhan","Gaurav","Harini","Ishaan","Janhvi","Kabir","Lakshmi",
  "Manav","Nidhi","Om","Priya","Rahul","Sneha","Tanvi","Uday",
  "Varsha","Yash","Zara","Rohan","Meera","Dev","Pooja",
];
const LAST_NAMES = [
  "Kulkarni","Sharma","Mehta","Verma","Patel","Singh","Joshi","Nair",
  "Iyer","Gupta","Shah","Desai","Rao","Pillai","Tiwari","Reddy",
  "Pandey","Chavan","Patil","Bhat",
];
const DEPARTMENTS = ["CSE","CSE AIML","IT","ENTC","EE","MECH","ROBOTICS","CIVIL"];
const YEARS = ["1st","2nd","3rd","4th"];
const GENDERS = ["Male","Female","Prefer not to say"];
const WHY_JOIN = [
  "Passionate about full-stack development and want to build real projects.",
  "Interested in AI/ML and want to connect with like-minded peers.",
  "Love competitive programming and want to grow with a team.",
  "Looking to contribute to open-source and club events.",
  "Eager to learn and participate in hackathons organized by the club.",
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function generateFakeRegistration(i, runId) {
  // Roll numbers shaped like real ones, prefixed to be easily identifiable & cleanable
  const rollNumber = `STRESS_${runId}_${String(i).padStart(5, "0")}`;
  return {
    name:         `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
    rollNumber,
    email:        `stress_${runId}_${i}@test.oyster.internal`,
    phone:        `9${String(randInt(100000000, 999999999))}`,
    department:   rand(DEPARTMENTS),
    year:         rand(YEARS),
    gender:       rand(GENDERS),
    whyJoin:      rand(WHY_JOIN),
    hasCodedBefore: Math.random() > 0.3,
    portfolioUrl: `https://github.com/stress_user_${runId}_${i}`,
  };
}

// ── HTTP fetch helper (native Node, no extra deps) ───────────────────────────
function fetchUrl(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith("https");
    const client = isHttps ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
    req.on("error", reject);
  });
}

// ── Core: simulate one user registration (mirrors browser code exactly) ───────
async function simulateUserRegistration({
  baseUrl,
  eventId,
  formData,
  networkProfile,
  dryRun,
  stageLog,
}) {
  const profile = NETWORK_PROFILES[networkProfile] || NETWORK_PROFILES.fast;

  // Stage 1: "Page load" — fetch the register page (simulates browser fetching event data)
  const pageStart = performance.now();
  if (baseUrl && !dryRun) {
    try {
      const networkDelay = randInt(profile.minMs, profile.maxMs);
      await sleep(networkDelay); // network round-trip overhead
      await fetchUrl(`${baseUrl}/register`, 10000);
    } catch (_) {
      // Non-fatal — page load failures are noted separately
    }
  } else {
    await sleep(randInt(profile.minMs, profile.maxMs));
  }
  const pageMs = performance.now() - pageStart;
  stageLog.pageMs = pageMs;

  // Stage 2: "User fills form" — simulate think time (0.5–3 s)
  const thinkMs = randInt(500, 3000);
  await sleep(thinkMs);

  // Stage 3: "Form submit" — Firebase SDK write (exactly what the browser does)
  const submitStart = performance.now();

  if (!dryRun) {
    const rollNumber = String(formData.rollNumber).toUpperCase().trim();
    const email = formData.email ? formData.email.toLowerCase().trim() : null;
    const docId = rollNumber || (email ? email.replace(/[^a-zA-Z0-9]/g, "_") : `REG_${Date.now()}`);

    const targetCollection =
      eventId === "recruitment-2026"
        ? collection(db, "registrations")
        : collection(db, "events", eventId, "registrations");

    const ref = doc(targetCollection, docId);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      throw new Error("DUPLICATE: registration already exists");
    }

    await setDoc(ref, {
      ...formData,
      hasCodedBefore: formData.hasCodedBefore === true,
      submittedAt: Timestamp.now(),
      present: false,
      status: "registered",
      formData: { ...formData },
      eventId,
      resumeUrl: "",
      paymentStatus: "free",
      _stressTest: true,      // marker for cleanup
      _stressRunId: String(formData.rollNumber).split("_")[1], // run prefix
    });
  } else {
    // Dry-run: simulate write latency only
    await sleep(randInt(50, 300) + randInt(profile.minMs, profile.maxMs));
  }

  stageLog.submitMs = performance.now() - submitStart;
  stageLog.thinkMs = thinkMs;
}

// ── Concurrency limiter ───────────────────────────────────────────────────────
async function pLimit(tasks, limit) {
  let i = 0;
  async function worker() {
    while (i < tasks.length) { const idx = i++; await tasks[idx](); }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

// ── Percentile ────────────────────────────────────────────────────────────────
function pct(sorted, p) {
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)] || 0;
}

// ── Interactive prompt ────────────────────────────────────────────────────────
function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

function parseFlag(flag) {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  if (arg) return arg.split("=")[1];
  const idx = process.argv.indexOf(`--${flag}`);
  if (idx !== -1) return process.argv[idx + 1];
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║       Oyster Registration — HTTP + Firebase Load Test      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const isDryRun = process.argv.includes("--dry-run");
  if (isDryRun) console.log("🟡  DRY-RUN mode — no Firestore writes.\n");

  // Collect config
  let baseUrl     = parseFlag("url");
  let eventId     = parseFlag("event");
  let countStr    = parseFlag("count");
  let concurStr   = parseFlag("concurrency");
  let networkMode = parseFlag("network");

  if (!baseUrl)     baseUrl     = await prompt("  Deployed app URL (e.g. https://oyster.vercel.app): ");
  if (!eventId)     eventId     = await prompt("  Event ID (e.g. recruitment-2026): ");
  if (!countStr)    countStr    = await prompt("  Number of registrations [50]: ") || "50";
  if (!concurStr)   concurStr   = await prompt("  Max concurrent users [10]: ")    || "10";
  if (!networkMode) networkMode = await prompt("  Network profile — fast/medium/slow/random [fast]: ") || "fast";

  baseUrl = baseUrl.replace(/\/$/, ""); // strip trailing slash
  const COUNT       = Math.max(1, parseInt(countStr, 10)  || 50);
  const CONCURRENCY = Math.max(1, parseInt(concurStr, 10) || 10);
  const PROFILE     = NETWORK_PROFILES[networkMode] || NETWORK_PROFILES.fast;
  const RUN_ID      = Date.now();

  console.log(`\n  App URL      : ${baseUrl}`);
  console.log(`  Event ID     : ${eventId}`);
  console.log(`  Registrations: ${COUNT}`);
  console.log(`  Concurrency  : ${CONCURRENCY} simultaneous users`);
  console.log(`  Network      : ${PROFILE.label}`);
  console.log(`  Dry-run      : ${isDryRun}`);
  console.log(`  Run ID       : ${RUN_ID}\n`);

  const confirm = await prompt("  Start load test? [Y/n]: ");
  if (confirm.toLowerCase() === "n") { console.log("  Aborted.\n"); process.exit(0); }

  console.log("\n  Running… (each dot = 1 completed registration)\n  ");

  const submitLatencies = [];
  const e2eLatencies    = [];
  let passed = 0, failed = 0;
  const errors = {};

  const tasks = Array.from({ length: COUNT }, (_, i) => async () => {
    const formData = generateFakeRegistration(i, RUN_ID);
    const stageTimes = {};
    const wallStart  = performance.now();

    try {
      await simulateUserRegistration({
        baseUrl,
        eventId,
        formData,
        networkProfile: networkMode,
        dryRun: isDryRun,
        stageLog: stageTimes,
      });

      const totalMs = performance.now() - wallStart;
      submitLatencies.push(stageTimes.submitMs || 0);
      e2eLatencies.push(totalMs);
      passed++;
      process.stdout.write("·");
    } catch (err) {
      failed++;
      const key = err.message.includes("DUPLICATE")
        ? "Duplicate (already registered)"
        : err.message.slice(0, 70);
      errors[key] = (errors[key] || 0) + 1;
      process.stdout.write("✗");
    }

    // Progress line every 20 completions
    if ((passed + failed) % 20 === 0) {
      process.stdout.write(` ${passed + failed}/${COUNT}\n  `);
    }
  });

  const wallStart = performance.now();
  await pLimit(tasks, CONCURRENCY);
  const wallMs = performance.now() - wallStart;

  submitLatencies.sort((a, b) => a - b);
  e2eLatencies.sort((a, b) => a - b);

  const total     = passed + failed;
  const rps       = (total / (wallMs / 1000)).toFixed(1);
  const successPct = ((passed / total) * 100 || 0).toFixed(1);

  console.log("\n\n  ┌──────────────────────────────────────────────────────────┐");
  console.log("  │                        RESULTS                           │");
  console.log("  ├──────────────────────────────────────────────────────────┤");
  console.log(`  │  Total attempted  : ${String(total).padEnd(36)}│`);
  console.log(`  │  ✓ Passed         : ${String(passed).padEnd(36)}│`);
  console.log(`  │  ✗ Failed         : ${String(failed).padEnd(36)}│`);
  console.log(`  │  Success rate     : ${(successPct + "%").padEnd(36)}│`);
  console.log("  ├──────────────────────────────────────────────────────────┤");
  console.log(`  │  Wall-clock time  : ${((wallMs / 1000).toFixed(2) + " s").padEnd(36)}│`);
  console.log(`  │  Throughput       : ${(rps + " reg/s").padEnd(36)}│`);

  if (submitLatencies.length > 0) {
    console.log("  ├──────────────────────────────────────────────────────────┤");
    console.log("  │  Firebase Write Latency (excl. think time):              │");
    console.log(`  │    p50  : ${(pct(submitLatencies,50).toFixed(0)  + " ms").padEnd(47)}│`);
    console.log(`  │    p95  : ${(pct(submitLatencies,95).toFixed(0)  + " ms").padEnd(47)}│`);
    console.log(`  │    p99  : ${(pct(submitLatencies,99).toFixed(0)  + " ms").padEnd(47)}│`);
    console.log(`  │    max  : ${(submitLatencies[submitLatencies.length-1].toFixed(0) + " ms").padEnd(47)}│`);
    console.log("  ├──────────────────────────────────────────────────────────┤");
    console.log("  │  End-to-End Latency per user (incl. page load + think):  │");
    console.log(`  │    p50  : ${((pct(e2eLatencies,50)/1000).toFixed(2)  + " s").padEnd(47)}│`);
    console.log(`  │    p95  : ${((pct(e2eLatencies,95)/1000).toFixed(2)  + " s").padEnd(47)}│`);
    console.log(`  │    p99  : ${((pct(e2eLatencies,99)/1000).toFixed(2)  + " s").padEnd(47)}│`);
  }

  if (Object.keys(errors).length > 0) {
    console.log("  ├──────────────────────────────────────────────────────────┤");
    console.log("  │  Failures:                                               │");
    for (const [msg, count] of Object.entries(errors)) {
      const line = `  │    ×${count}  ${msg}`;
      console.log((line.length > 61 ? line.slice(0, 58) + "..." : line).padEnd(61) + "│");
    }
  }

  console.log("  └──────────────────────────────────────────────────────────┘\n");

  if (!isDryRun && passed > 0) {
    console.log(`  ℹ  ${passed} docs written with _stressTest: true, _stressRunId: "${RUN_ID}"`);
    console.log("     Clean them up with:");
    console.log(`       node stress-test-cleanup.mjs ${eventId} ${RUN_ID}\n`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error("\n  Fatal:", err.message); process.exit(1); });

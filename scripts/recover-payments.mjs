/**
 * Recovery script: finds Razorpay payments for C-Marathon 2026 that have no
 * corresponding Firebase registration, and creates stub registration documents
 * so they appear in the admin panel (marked paymentStatus: "paid", status: "registered").
 *
 * The form fields that weren't saved (roll number, department, etc.) are left
 * blank — an admin can fill them in manually, or you can contact the registrant.
 *
 * Usage:
 *   node scripts/recover-payments.mjs
 *
 * Requires these env vars (reads from .env.local automatically):
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_API_KEY, etc.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
} from "firebase/firestore";

// ── Load .env.local manually (no dotenv dependency needed) ──────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const RZP_KEY_ID     = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// ── Init Firebase SDK (same config as the app) ───────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db    = getFirestore(fbApp);

// ── Config ──────────────────────────────────────────────────────────────────
const EVENT_ID = "c-marathon-2026-7309"; // from Firebase console screenshot

if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
  console.error("❌  RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set in .env.local");
  process.exit(1);
}
if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
  console.error("❌  Firebase env vars not set in .env.local");
  process.exit(1);
}

const rzpAuth = "Basic " + Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString("base64");
const REGS_COL = collection(db, "events", EVENT_ID, "registrations");

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Fetch all Razorpay payments for C-Marathon (captured only, INR 99+). */
async function fetchRazorpayPayments() {
  const payments = [];
  let skip = 0;
  const count = 100;

  while (true) {
    const url = `https://api.razorpay.com/v1/payments?count=${count}&skip=${skip}`;
    const res = await fetch(url, { headers: { Authorization: rzpAuth } });
    if (!res.ok) throw new Error(`Razorpay API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const batch = data.items || [];
    payments.push(...batch);
    if (batch.length < count) break;
    skip += count;
    // Safety: stop after 500 payments (5 pages)
    if (skip >= 500) break;
  }

  // Filter to C-Marathon payments: captured, ₹99 or ₹1 (test), note eventId matches
  return payments.filter((p) => {
    if (p.status !== "captured") return false;
    // Check order notes (attached via expand) — we'll fetch order notes separately
    return true;
  });
}

/** Fetch the Razorpay order for a payment to get the notes (name, email, phone, eventId). */
async function fetchOrderNotes(orderId) {
  if (!orderId) return null;
  const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: { Authorization: rzpAuth },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.notes || null;
}

/** Fetch all existing Firebase registrations for this event. */
async function fetchExistingRegistrations() {
  const snapshot = await getDocs(REGS_COL);
  const emails = new Set();
  const phones = new Set();
  for (const d of snapshot.docs) {
    const data = d.data();
    if (data.email) emails.add(data.email.toLowerCase().trim());
    if (data.phone) phones.add(data.phone.trim().replace(/\D/g, "").slice(-10));
  }
  return { emails, phones };
}

/** Write a stub registration document to Firestore via Firebase SDK. */
async function createStubRegistration(email, name, phone, paymentId, orderId, amount) {
  const docId = email.replace(/[^a-zA-Z0-9]/g, "_");
  const ref   = doc(REGS_COL, docId);

  // Don't overwrite if something already exists
  const existing = await getDoc(ref);
  if (existing.exists()) return "already_exists";

  const amountRupees = Math.round(amount / 100);

  await setDoc(ref, {
    name:              name || "",
    email:             email || "",
    phone:             phone || "",
    rollNumber:        "",   // unknown — fill in manually
    department:        "",
    year:              "",
    gender:            "",
    whyJoin:           "",
    hasCodedBefore:    false,
    portfolioUrl:      "",
    present:           false,
    status:            "registered",
    eventId:           EVENT_ID,
    resumeUrl:         "",
    paymentStatus:     "paid",
    paymentAmount:     amountRupees,
    razorpayPaymentId: paymentId || "",
    razorpayOrderId:   orderId  || "",
    recoveredStub:     true,
    submittedAt:       Timestamp.now(),
    formData: {
      name:  name  || "",
      email: email || "",
      phone: phone || "",
    },
  });

  return "created";
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍  Fetching Razorpay payments…");
  const allPayments = await fetchRazorpayPayments();
  console.log(`    Found ${allPayments.length} captured payments total.`);

  console.log("🔍  Fetching existing Firebase registrations…");
  const { emails: existingEmails, phones: existingPhones } = await fetchExistingRegistrations();
  console.log(`    ${existingEmails.size} registrations already in Firestore.`);

  console.log("\n🔄  Cross-referencing payments with Firebase…\n");

  const missing = [];
  const seen = new Set(); // deduplicate by payment ID

  for (const payment of allPayments) {
    if (seen.has(payment.id)) continue;
    seen.add(payment.id);

    // Skip tiny test payments under ₹50 (adjust if needed)
    if (payment.amount < 5000) {
      console.log(`  ⚪  ${payment.id} — ₹${payment.amount/100} (skipping low-amount test payment)`);
      continue;
    }

    // Get order notes to identify eventId and registrant details
    const notes = await fetchOrderNotes(payment.order_id);
    if (!notes) continue;

    // Only process C-Marathon payments — skip if eventId is absent or mismatched
    if (!notes.eventId || notes.eventId !== EVENT_ID) continue;

    const email = (notes.email || payment.email || "").toLowerCase().trim();
    const phone = (notes.contact || payment.contact || "").replace(/\D/g, "").slice(-10);
    const name  = notes.name || payment.description || "";

    const inFirestore = existingEmails.has(email) || existingPhones.has(phone);

    if (inFirestore) {
      console.log(`  ✅  ${payment.id} — ${email} — already in Firestore`);
    } else {
      console.log(`  ❌  ${payment.id} — ${email} (${phone}) — MISSING from Firestore`);
      missing.push({ payment, email, phone, name, notes });
    }
  }

  if (missing.length === 0) {
    console.log("\n✅  No missing registrations found. All paid users are in Firebase.");
    return;
  }

  console.log(`\n⚠️   Found ${missing.length} paid registration(s) missing from Firebase:`);
  for (const m of missing) {
    console.log(`     • ${m.name} <${m.email}> (${m.phone}) — ${m.payment.id}`);
  }

  console.log("\n📝  Creating stub registrations in Firestore…");
  for (const m of missing) {
    try {
      const result = await createStubRegistration(
        m.email,
        m.name,
        m.phone,
        m.payment.id,
        m.payment.order_id,
        m.payment.amount
      );
      if (result === "already_exists") {
        console.log(`  ⚪  ${m.email} — doc already exists, skipped`);
      } else {
        console.log(`  ✅  ${m.email} — stub created (roll number is blank, fill in manually)`);
      }
    } catch (err) {
      console.error(`  ❌  Failed to create stub for ${m.email}: ${err.message}`);
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Recovery complete.

NEXT STEPS:
1. Open the C-Marathon admin candidates page — the recovered registrants
   will now appear marked "✓ Paid ₹99" with an empty roll number.
2. Contact each recovered registrant to collect their missing form data
   (roll number, department, year) and update it in Firebase manually.
3. The recoveredStub: true flag identifies these records.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

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
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const FIREBASE_API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// ── Config ──────────────────────────────────────────────────────────────────
const EVENT_ID = "c-marathon-2026-7309"; // from Firebase console screenshot

if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
  console.error("❌  RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set in .env.local");
  process.exit(1);
}
if (!FIREBASE_PROJECT_ID || !FIREBASE_API_KEY) {
  console.error("❌  Firebase env vars not set in .env.local");
  process.exit(1);
}

const rzpAuth = "Basic " + Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString("base64");
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

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
  const url = `${FIRESTORE_BASE}/events/${EVENT_ID}/registrations?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore read error: ${res.status} ${text}`);
  }
  const data = await res.json();
  const docs = data.documents || [];
  // Return set of emails and phones already in Firebase
  const emails = new Set();
  const phones = new Set();
  for (const doc of docs) {
    const fields = doc.fields || {};
    if (fields.email?.stringValue) emails.add(fields.email.stringValue.toLowerCase().trim());
    if (fields.phone?.stringValue) phones.add(fields.phone.stringValue.trim());
  }
  return { emails, phones };
}

/** Write a stub registration document to Firestore via REST API. */
async function createStubRegistration(email, name, phone, paymentId, orderId, amount) {
  const docId = email.replace(/[^a-zA-Z0-9]/g, "_");
  const url = `${FIRESTORE_BASE}/events/${EVENT_ID}/registrations?documentId=${encodeURIComponent(docId)}&key=${FIREBASE_API_KEY}`;

  const now = new Date().toISOString();
  const amountRupees = Math.round(amount / 100); // paise → rupees

  const body = {
    fields: {
      name:               { stringValue: name || "" },
      email:              { stringValue: email || "" },
      phone:              { stringValue: phone || "" },
      rollNumber:         { stringValue: "" },   // unknown — fill in manually
      department:         { stringValue: "" },
      year:               { stringValue: "" },
      gender:             { stringValue: "" },
      whyJoin:            { stringValue: "" },
      hasCodedBefore:     { booleanValue: false },
      portfolioUrl:       { stringValue: "" },
      present:            { booleanValue: false },
      status:             { stringValue: "registered" },
      eventId:            { stringValue: EVENT_ID },
      resumeUrl:          { stringValue: "" },
      paymentStatus:      { stringValue: "paid" },
      paymentAmount:      { integerValue: String(amountRupees) },
      razorpayPaymentId:  { stringValue: paymentId || "" },
      razorpayOrderId:    { stringValue: orderId || "" },
      recoveredStub:      { booleanValue: true }, // flag so you can identify these
      submittedAt: {
        timestampValue: now,
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: rzpAuth, // not needed for Firestore REST but harmless
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    // If doc already exists (409), that's fine
    if (res.status === 409) return "already_exists";
    throw new Error(`Firestore write error ${res.status}: ${text}`);
  }
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

    // Only process C-Marathon payments
    if (notes.eventId && notes.eventId !== EVENT_ID) continue;

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

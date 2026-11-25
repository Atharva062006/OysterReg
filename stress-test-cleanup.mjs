/**
 * stress-test-cleanup.mjs — Remove stress-test registrations from Firestore
 *
 * Usage:
 *   node stress-test-cleanup.mjs <eventId> [prefix]
 *
 * Examples:
 *   node stress-test-cleanup.mjs recruitment-2026             # remove ALL stress docs
 *   node stress-test-cleanup.mjs recruitment-2026 1718200000000  # remove specific run
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { createInterface } from "readline";

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

const [, , eventIdArg, prefixArg] = process.argv;

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║    Oyster Registration — Stress Test Cleanup        ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  let eventId = eventIdArg;
  if (!eventId) eventId = await prompt("  Event ID to clean: ");

  const targetCollection =
    eventId === "recruitment-2026"
      ? collection(db, "registrations")
      : collection(db, "events", eventId, "registrations");

  console.log(`\n  Fetching stress-test documents from '${eventId}'…`);

  const q = query(targetCollection, where("_stressTest", "==", true));
  const snapshot = await getDocs(q);

  let docs = snapshot.docs;

  if (prefixArg) {
    docs = docs.filter((d) => d.id.includes(`_${prefixArg}_`));
    console.log(`  Filtered to prefix ${prefixArg}: ${docs.length} documents`);
  } else {
    console.log(`  Found ${docs.length} stress-test documents`);
  }

  if (docs.length === 0) {
    console.log("  Nothing to delete.\n");
    process.exit(0);
  }

  const confirm = await prompt(`\n  Delete ${docs.length} document(s)? [Y/n]: `);
  if (confirm.toLowerCase() === "n") { console.log("  Aborted.\n"); process.exit(0); }

  let deleted = 0;
  for (const d of docs) {
    await deleteDoc(doc(targetCollection, d.id));
    deleted++;
    process.stdout.write(`\r  Deleted ${deleted}/${docs.length}…`);
  }

  console.log(`\n\n  ✓ Cleaned up ${deleted} stress-test registrations from '${eventId}'.\n`);
  process.exit(0);
}

main().catch((err) => { console.error("\n  Fatal error:", err.message); process.exit(1); });

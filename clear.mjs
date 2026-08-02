import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC5ICbFTGKHZq6uw9fkLnNpUgUNHt7Mh-E",
  authDomain: "oysterreg.firebaseapp.com",
  projectId: "oysterreg",
  storageBucket: "oysterreg.firebasestorage.app",
  messagingSenderId: "1002155483479",
  appId: "1:1002155483479:web:116cae095caa6cbfef9e12",
  measurementId: "G-DG56E45KFH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get eventId from command line args (default: recruitment-2026)
const eventId = process.argv[2] || "recruitment-2026";

async function clearRegistrations() {
  console.log(`Locating registrations for event: "${eventId}"...`);

  // Target collection path
  const targetCollection = eventId === "recruitment-2026"
    ? collection(db, "registrations")
    : collection(db, "events", eventId, "registrations");

  const snapshot = await getDocs(targetCollection);

  if (snapshot.empty) {
    console.log("No registrations found to delete.");
    process.exit(0);
  }

  console.log(`Found ${snapshot.size} registration(s). Deleting...`);

  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.delete(d.ref);
    console.log(`- Queued deletion for roll: ${d.id}`);
  });

  await batch.commit();
  console.log(`✓ Successfully deleted all ${snapshot.size} registration(s) for "${eventId}"!`);
  process.exit(0);
}

clearRegistrations().catch((err) => {
  console.error("Cleanup error:", err);
  process.exit(1);
});

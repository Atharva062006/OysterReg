import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);

// ── Types ──────────────────────────────────────────────────────────────────

export interface Registration {
  name: string;
  rollNumber: string;
  email: string;
  phone: string;
  department: string;
  year: string;
  gender: string;
  whyJoin: string;
  hasCodedBefore: boolean;
  portfolioUrl: string;
  submittedAt: Timestamp;
  present: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Submit a new registration. Roll number is used as the document ID.
 *  Throws if a registration with the same roll number already exists. */
export async function submitRegistration(
  data: Omit<Registration, "submittedAt" | "present">
): Promise<void> {
  const ref = doc(db, "registrations", data.rollNumber.toUpperCase());
  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error("A registration with this roll number already exists.");
  }
  await setDoc(ref, {
    ...data,
    rollNumber: data.rollNumber.toUpperCase(),
    submittedAt: Timestamp.now(),
    present: false,
  });
}

/** Fetch all registrations ordered by submission time (newest first). */
export async function getAllRegistrations(): Promise<Registration[]> {
  const q = query(
    collection(db, "registrations"),
    orderBy("submittedAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as Registration);
}

/** Toggle the `present` field for a registration. */
export async function togglePresent(
  rollNumber: string,
  present: boolean
): Promise<void> {
  const ref = doc(db, "registrations", rollNumber.toUpperCase());
  await updateDoc(ref, { present });
}

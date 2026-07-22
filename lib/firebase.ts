import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
  query,
  orderBy,
  where,
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

export type CandidateStatus =
  | "registered"
  | "aptitude_shortlisted"
  | "interview_shortlisted"
  | "selected"
  | "rejected";

export interface PanelVerdict {
  verdict: "pass" | "fail" | "pending";
  notes: string;
  updatedAt: Timestamp;
}

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
  // Pipeline fields (optional — missing means "registered")
  status?: CandidateStatus;
  aptitudeNotes?: string;
  panelId?: string;
  interviews?: Record<string, PanelVerdict>;
}

export interface Panel {
  id: string;
  name: string;
  passcode: string;
  createdAt: Timestamp;
}

// ── Registration Helpers ───────────────────────────────────────────────────

/** Submit a new registration. Roll number is used as the document ID.
 *  Throws if a registration with the same roll number already exists. */
export async function submitRegistration(
  data: Omit<Registration, "submittedAt" | "present" | "status">
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
    status: "registered",
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

// ── Pipeline Helpers ───────────────────────────────────────────────────────

/** Update the pipeline status of a single candidate. */
export async function updateStatus(
  rollNumber: string,
  status: CandidateStatus
): Promise<void> {
  const ref = doc(db, "registrations", rollNumber.toUpperCase());
  await updateDoc(ref, { status });
}

/** Bulk-update the pipeline status of multiple candidates in one batch. */
export async function bulkUpdateStatus(
  rollNumbers: string[],
  status: CandidateStatus
): Promise<void> {
  const batch = writeBatch(db);
  for (const rn of rollNumbers) {
    const ref = doc(db, "registrations", rn.toUpperCase());
    batch.update(ref, { status });
  }
  await batch.commit();
}

/** Save or update aptitude notes for a candidate. */
export async function updateAptitudeNotes(
  rollNumber: string,
  notes: string
): Promise<void> {
  const ref = doc(db, "registrations", rollNumber.toUpperCase());
  await updateDoc(ref, { aptitudeNotes: notes });
}

/** Assign a candidate to an interview panel. */
export async function assignPanel(
  rollNumber: string,
  panelId: string
): Promise<void> {
  const ref = doc(db, "registrations", rollNumber.toUpperCase());
  await updateDoc(ref, { panelId });
}

/** Save a panel member's verdict and notes for a candidate. */
export async function savePanelVerdict(
  rollNumber: string,
  panelId: string,
  verdict: PanelVerdict["verdict"],
  notes: string
): Promise<void> {
  const ref = doc(db, "registrations", rollNumber.toUpperCase());
  await updateDoc(ref, {
    [`interviews.${panelId}`]: {
      verdict,
      notes,
      updatedAt: Timestamp.now(),
    },
  });
}

// ── Panel Helpers ──────────────────────────────────────────────────────────

/** Fetch all interview panels. */
export async function getPanels(): Promise<Panel[]> {
  const q = query(collection(db, "panels"), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Panel));
}

/** Create a new interview panel. */
export async function createPanel(
  name: string,
  passcode: string
): Promise<string> {
  const ref = doc(collection(db, "panels"));
  await setDoc(ref, { name, passcode, createdAt: Timestamp.now() });
  return ref.id;
}

/** Delete a panel by ID. */
export async function deletePanel(panelId: string): Promise<void> {
  const { deleteDoc } = await import("firebase/firestore");
  const ref = doc(db, "panels", panelId);
  await deleteDoc(ref);
}

/** Verify a panel passcode. Returns the Panel if valid, null if not. */
export async function verifyPanelPasscode(
  passcode: string
): Promise<Panel | null> {
  const q = query(
    collection(db, "panels"),
    where("passcode", "==", passcode)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as Panel;
}

/** Fetch candidates assigned to a specific panel (aptitude_shortlisted only). */
export async function getCandidatesForPanel(
  panelId: string
): Promise<Registration[]> {
  // Query only by panelId to avoid requiring a composite index in Firestore,
  // then filter and sort on the client side.
  const q = query(
    collection(db, "registrations"),
    where("panelId", "==", panelId)
  );
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map((d) => d.data() as Registration);
  return all
    .filter((c) => c.status === "aptitude_shortlisted" || c.status === "interview_shortlisted" || c.status === "rejected") // Include all assigned so they don't disappear immediately
    .sort((a, b) => b.submittedAt.toMillis() - a.submittedAt.toMillis());
}

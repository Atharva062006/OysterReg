import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
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
  | "rejected"
  | string;

export interface EvaluationScores {
  technical: number;
  communication: number;
  problemSolving: number;
  cultureFit: number;
}

export interface MemberEvaluation {
  memberName: string;
  verdict: "pass" | "fail" | "pending";
  notes: string;
  scores: EvaluationScores;
  updatedAt?: any;
}

export interface PanelVerdict {
  verdict: "pass" | "fail" | "pending";
  notes: string;
  evaluations?: Record<string, MemberEvaluation>; // Keyed by memberName
  averageScores?: EvaluationScores;
  overallScore?: number; // 0-10
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
  // Dynamic extra fields
  formData?: Record<string, any>;
  eventId?: string;
  resumeUrl?: string;
}

export interface Panel {
  id: string;
  name: string;
  passcode: string;
  members?: string[]; // Array of member names e.g. ["Atharva", "John", "Sarah"]
  createdAt: Timestamp;
  eventId?: string;
}

export interface EventStage {
  id: string;
  name: string;
  color: "default" | "blue" | "amber" | "green" | "purple" | "rose" | "indigo";
  order: number;
  isTerminal?: boolean;
}

export interface FormFieldConfig {
  id: string;
  label: string;
  type: "text" | "number" | "email" | "tel" | "textarea" | "select" | "radio" | "checkbox" | "url" | "file";
  placeholder?: string;
  required: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  gridSpan?: 1 | 2;
  panelVisible?: boolean;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  registrationOpen: boolean;
  isActive?: boolean;
  closedMessage?: string;
  stages: EventStage[];
  formSchema: FormFieldConfig[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  type: "recruitment" | "workshop";
  whatsappGroupLink?: string;
  panelVisibleFields?: string[];
}

// ── Standard Presets & Initial Defaults ─────────────────────────────────────

export const DEFAULT_RECRUITMENT_STAGES: EventStage[] = [
  { id: "registered", name: "Registered", color: "default", order: 1 },
  { id: "aptitude_shortlisted", name: "Aptitude Shortlisted", color: "blue", order: 2 },
  { id: "interview_shortlisted", name: "Interview Shortlisted", color: "amber", order: 3 },
  { id: "selected", name: "Selected", color: "green", order: 4, isTerminal: true },
  { id: "rejected", name: "Rejected", color: "rose", order: 5, isTerminal: true },
];

export const DEFAULT_WORKSHOP_STAGES: EventStage[] = [
  { id: "registered", name: "Registered", color: "default", order: 1 },
  { id: "confirmed", name: "RSVP Confirmed", color: "green", order: 2, isTerminal: true },
  { id: "attended", name: "Attended", color: "blue", order: 3, isTerminal: true },
  { id: "cancelled", name: "Cancelled", color: "rose", order: 4, isTerminal: true },
];

export const DEFAULT_RECRUITMENT_FORM_SCHEMA: FormFieldConfig[] = [
  { id: "name", label: "Full Name", type: "text", placeholder: "Your full name", required: true, gridSpan: 1 },
  { id: "rollNumber", label: "Roll Number", type: "text", placeholder: "e.g. 2403036", required: true, gridSpan: 1 },
  { id: "email", label: "Email Address", type: "email", placeholder: "your@email.com", required: true, gridSpan: 1 },
  { id: "phone", label: "Phone Number", type: "tel", placeholder: "10-digit mobile number", required: true, gridSpan: 1 },
  {
    id: "gender",
    label: "Gender",
    type: "radio",
    required: true,
    gridSpan: 2,
    options: [
      { value: "Male", label: "Male" },
      { value: "Female", label: "Female" },
      { value: "Prefer not to say", label: "Prefer not to say" },
    ],
  },
  {
    id: "department",
    label: "Department",
    type: "select",
    required: true,
    gridSpan: 1,
    options: [
      { value: "CSE", label: "Computer Science & Engineering" },
      { value: "CSE AIML", label: "Artificial Intelligence & Machine Learning" },
      { value: "IT", label: "Information Technology" },
      { value: "ENTC", label: "Electronics & Telecommunication" },
      { value: "EE", label: "Electrical Engineering" },
      { value: "MECH", label: "Mechanical Engineering" },
      { value: "ROBOTICS", label: "Robotics & Automation" },
      { value: "MECHATRONICS", label: "Mechatronics" },
      { value: "CIVIL", label: "Civil Engineering" },
      { value: "OTHER", label: "Other" },
    ],
  },
  {
    id: "year",
    label: "Year of Study",
    type: "select",
    required: true,
    gridSpan: 1,
    options: [
      { value: "1st", label: "1st Year" },
      { value: "2nd", label: "2nd Year" },
      { value: "3rd", label: "3rd Year" },
      { value: "4th", label: "4th Year" },
    ],
  },
  {
    id: "hasCodedBefore",
    label: "Have you coded before?",
    type: "radio",
    required: true,
    gridSpan: 2,
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "portfolioUrl",
    label: "GitHub / Portfolio URL",
    type: "url",
    placeholder: "https://github.com/yourhandle",
    required: false,
    hint: "Optional — share your work if you have any.",
    gridSpan: 2,
  },
  {
    id: "whyJoin",
    label: "Why do you want to join?",
    type: "textarea",
    placeholder: "In 2-3 sentences, tell us what draws you to the club...",
    required: true,
    gridSpan: 2,
  },
];

export const WORKSHOP_FORM_SCHEMA_PRESET: FormFieldConfig[] = [
  { id: "name", label: "Full Name", type: "text", placeholder: "Your full name", required: true, gridSpan: 1 },
  { id: "rollNumber", label: "Roll Number", type: "text", placeholder: "e.g. 2403036", required: true, gridSpan: 1 },
  { id: "email", label: "Email Address", type: "email", placeholder: "your@email.com", required: true, gridSpan: 1 },
  { id: "phone", label: "Phone Number", type: "tel", placeholder: "10-digit mobile number", required: true, gridSpan: 1 },
  {
    id: "experienceLevel",
    label: "Experience Level",
    type: "radio",
    required: true,
    gridSpan: 2,
    options: [
      { value: "beginner", label: "Beginner (Just starting)" },
      { value: "intermediate", label: "Intermediate (Built small projects)" },
      { value: "advanced", label: "Advanced (Experienced)" },
    ],
  },
  { id: "expectations", label: "What do you hope to learn?", type: "textarea", placeholder: "Tell us your goals...", required: true, gridSpan: 2 },
];

export const DEFAULT_RECRUITMENT_EVENT: Event = {
  id: "recruitment-2026",
  name: "Recruitment 2026",
  description: "Official Oyster Kode Club annual recruitment process.",
  registrationOpen: true,
  isActive: true,
  stages: DEFAULT_RECRUITMENT_STAGES,
  formSchema: DEFAULT_RECRUITMENT_FORM_SCHEMA,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  type: "recruitment",
};

// ── Multi-Event Helpers ───────────────────────────────────────────────────

/** Seed default "Recruitment 2026" event if events collection is empty or restricted. */
export async function seedDefaultEventIfEmpty(): Promise<Event> {
  try {
    const eventsCollectionRef = collection(db, "events");
    const snapshot = await getDocs(eventsCollectionRef);

    if (!snapshot.empty) {
      const events = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
      const active = events.find((e) => e.isActive) || events[0];
      return active;
    }

    const ref = doc(db, "events", DEFAULT_RECRUITMENT_EVENT.id);
    await setDoc(ref, DEFAULT_RECRUITMENT_EVENT);
    return DEFAULT_RECRUITMENT_EVENT;
  } catch (err) {
    console.warn("Firestore 'events' collection write/read restricted:", err);
    return DEFAULT_RECRUITMENT_EVENT;
  }
}

/** Fetch all events from Firestore with fallback. */
export async function getEvents(): Promise<Event[]> {
  try {
    await seedDefaultEventIfEmpty();
    const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return [DEFAULT_RECRUITMENT_EVENT];
    }
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
  } catch (err) {
    console.warn("Firestore 'events' collection read restricted:", err);
    return [DEFAULT_RECRUITMENT_EVENT];
  }
}

/** Fetch a single event by ID. */
export async function getEventById(eventId: string): Promise<Event | null> {
  try {
    const ref = doc(db, "events", eventId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      if (eventId === "recruitment-2026") {
        return DEFAULT_RECRUITMENT_EVENT;
      }
      return null;
    }
    return { id: snap.id, ...snap.data() } as Event;
  } catch (err) {
    console.warn("Firestore 'events' document read restricted:", err);
    if (eventId === "recruitment-2026") {
      return DEFAULT_RECRUITMENT_EVENT;
    }
    return null;
  }
}

/** Get the currently designated Active Event for default site registrations. */
export async function getActiveEvent(): Promise<Event> {
  try {
    const events = await getEvents();
    const active = events.find((e) => e.isActive);
    if (active) return active;
    if (events.length > 0) return events[0];
    return DEFAULT_RECRUITMENT_EVENT;
  } catch (err) {
    return DEFAULT_RECRUITMENT_EVENT;
  }
}

/** Set a specific event as the active registration event for `/register`. */
export async function setActiveEvent(eventId: string): Promise<void> {
  const events = await getEvents();
  const batch = writeBatch(db);
  for (const ev of events) {
    const ref = doc(db, "events", ev.id);
    batch.update(ref, { isActive: ev.id === eventId, updatedAt: Timestamp.now() });
  }
  await batch.commit();
}

/** Create a new event. */
export async function createEvent(
  name: string,
  description: string,
  preset: "recruitment" | "workshop" = "recruitment"
): Promise<string> {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  
  const eventId = `${slug}-${Date.now().toString().slice(-4)}`;
  const ref = doc(db, "events", eventId);

  let stages = DEFAULT_RECRUITMENT_STAGES;
  let formSchema = DEFAULT_RECRUITMENT_FORM_SCHEMA;

  if (preset === "workshop") {
    stages = DEFAULT_WORKSHOP_STAGES;
    formSchema = WORKSHOP_FORM_SCHEMA_PRESET;
  }

  const newEvent: Event = {
    id: eventId,
    name,
    description,
    type: preset,
    registrationOpen: true,
    isActive: false,
    stages,
    formSchema,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await setDoc(ref, newEvent);
  return eventId;
}

/** Update general event details. */
export async function updateEvent(
  eventId: string,
  updates: Partial<Omit<Event, "id" | "createdAt">>
): Promise<void> {
  const ref = doc(db, "events", eventId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/** Toggle open/closed status for an event's registration. */
export async function toggleEventRegistration(
  eventId: string,
  registrationOpen: boolean,
  closedMessage?: string
): Promise<void> {
  const ref = doc(db, "events", eventId);
  await updateDoc(ref, {
    registrationOpen,
    ...(closedMessage !== undefined ? { closedMessage } : {}),
    updatedAt: Timestamp.now(),
  });
}



/** Save updated form schema fields for an event. */
export async function saveEventFormSchema(
  eventId: string,
  formSchema: FormFieldConfig[]
): Promise<void> {
  const ref = doc(db, "events", eventId);
  // Strip undefined values which Firestore does not support
  const cleanFormSchema = JSON.parse(JSON.stringify(formSchema));
  await updateDoc(ref, {
    formSchema: cleanFormSchema,
    updatedAt: Timestamp.now(),
  });
}

/** Delete an event and all its registrations. */
export async function deleteEvent(eventId: string): Promise<void> {
  if (eventId === "recruitment-2026") {
    throw new Error("The default Recruitment 2026 event cannot be deleted.");
  }
  const ref = doc(db, "events", eventId);
  await deleteDoc(ref);
}

// ── Candidate Registrations per Event ──────────────────────────────────────

/** Submit candidate registration for a specific event. */
export async function submitEventRegistration(
  eventId: string,
  formData: Record<string, any>
): Promise<void> {
  const event = await getEventById(eventId);
  if (!event) throw new Error("Event not found.");
  if (!event.registrationOpen) {
    throw new Error(event.closedMessage || "Registrations for this event are currently closed.");
  }

  // Document ID based on rollNumber, email, or timestamp
  const rollNumber = formData.rollNumber ? String(formData.rollNumber).toUpperCase().trim() : null;
  const email = formData.email ? String(formData.email).toLowerCase().trim() : null;
  const docId = rollNumber || (email ? email.replace(/[^a-zA-Z0-9]/g, "_") : `REG_${Date.now()}`);

  // Registrations subcollection: events/{eventId}/registrations or root collection fallback for recruitment-2026
  const targetCollection = eventId === "recruitment-2026"
    ? collection(db, "registrations")
    : collection(db, "events", eventId, "registrations");

  const ref = doc(targetCollection, docId);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error("A registration with this identifier already exists for this event.");
  }

  const payload: Registration = {
    name: formData.name || "",
    rollNumber: rollNumber || "",
    email: email || "",
    phone: formData.phone || "",
    department: formData.department || "",
    year: formData.year || "",
    gender: formData.gender || "",
    whyJoin: formData.whyJoin || "",
    hasCodedBefore: formData.hasCodedBefore === "yes" || formData.hasCodedBefore === true,
    portfolioUrl: formData.portfolioUrl || "",
    submittedAt: Timestamp.now(),
    present: false,
    status: event.stages.length > 0 ? event.stages[0].id : "registered",
    formData,
    eventId,
    resumeUrl: Object.values(formData).find(val => typeof val === 'string' && val.includes('cloudinary.com')), // Extract the first cloudinary link if present
  };

  await setDoc(ref, payload);
}

/** Fetch all registrations for a specific event. */
export async function getEventRegistrations(eventId: string): Promise<Registration[]> {
  const targetCollection = eventId === "recruitment-2026"
    ? collection(db, "registrations")
    : collection(db, "events", eventId, "registrations");

  try {
    const q = query(targetCollection, orderBy("submittedAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as Registration);
  } catch (err) {
    // If orderBy submittedAt fails or empty, fetch raw docs
    const snapshot = await getDocs(targetCollection);
    return snapshot.docs
      .map((d) => d.data() as Registration)
      .sort((a, b) => (b.submittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || 0));
  }
}

/** Toggle candidate present flag in event. */
export async function toggleCandidatePresentInEvent(
  eventId: string,
  candidateId: string,
  present: boolean
): Promise<void> {
  const targetCollection = eventId === "recruitment-2026"
    ? collection(db, "registrations")
    : collection(db, "events", eventId, "registrations");
  const ref = doc(targetCollection, candidateId.toUpperCase());
  await updateDoc(ref, { present });
}

/** Update status of candidate in event. */
export async function updateCandidateStatusInEvent(
  eventId: string,
  candidateId: string,
  status: string
): Promise<void> {
  const targetCollection = eventId === "recruitment-2026"
    ? collection(db, "registrations")
    : collection(db, "events", eventId, "registrations");
  const ref = doc(targetCollection, candidateId.toUpperCase());
  await updateDoc(ref, { status });
}

/** Bulk update status of candidates in event. */
export async function bulkUpdateCandidateStatusInEvent(
  eventId: string,
  candidateIds: string[],
  status: string
): Promise<void> {
  const targetCollection = eventId === "recruitment-2026"
    ? collection(db, "registrations")
    : collection(db, "events", eventId, "registrations");

  const batch = writeBatch(db);
  for (const id of candidateIds) {
    const ref = doc(targetCollection, id.toUpperCase());
    batch.update(ref, { status });
  }
  await batch.commit();
}

// ── Legacy Compatibility Functions ──────────────────────────────────────────

/** Backward compatible: Submit a new registration. */
export async function submitRegistration(
  data: Omit<Registration, "submittedAt" | "present" | "status">
): Promise<void> {
  return submitEventRegistration("recruitment-2026", data as Record<string, any>);
}

/** Backward compatible: Fetch all registrations. */
export async function getAllRegistrations(): Promise<Registration[]> {
  return getEventRegistrations("recruitment-2026");
}

/** Backward compatible: Toggle present. */
export async function togglePresent(
  rollNumber: string,
  present: boolean
): Promise<void> {
  return toggleCandidatePresentInEvent("recruitment-2026", rollNumber, present);
}

/** Backward compatible: Update candidate status. */
export async function updateStatus(
  rollNumber: string,
  status: CandidateStatus
): Promise<void> {
  return updateCandidateStatusInEvent("recruitment-2026", rollNumber, status);
}

/** Backward compatible: Bulk update status. */
export async function bulkUpdateStatus(
  rollNumbers: string[],
  status: CandidateStatus
): Promise<void> {
  return bulkUpdateCandidateStatusInEvent("recruitment-2026", rollNumbers, status);
}

/** Save aptitude notes for a candidate. */
export async function updateAptitudeNotes(
  rollNumber: string,
  notes: string
): Promise<void> {
  const ref = doc(db, "registrations", rollNumber.toUpperCase());
  await updateDoc(ref, { aptitudeNotes: notes });
}

/** Assign candidate to panel in event. */
export async function assignPanelInEvent(
  eventId: string,
  rollNumber: string,
  panelId: string
): Promise<void> {
  const targetCollection = eventId === "recruitment-2026"
    ? collection(db, "registrations")
    : collection(db, "events", eventId, "registrations");
  const ref = doc(targetCollection, rollNumber.toUpperCase());
  await updateDoc(ref, { panelId });
}

/** Save panel verdict in event. */
export async function savePanelVerdictInEvent(
  eventId: string,
  rollNumber: string,
  panelId: string,
  verdict: PanelVerdict["verdict"],
  notes: string
): Promise<void> {
  const targetCollection = eventId === "recruitment-2026"
    ? collection(db, "registrations")
    : collection(db, "events", eventId, "registrations");
  const ref = doc(targetCollection, rollNumber.toUpperCase());
  await updateDoc(ref, {
    [`interviews.${panelId}`]: {
      verdict,
      notes,
      updatedAt: Timestamp.now(),
    },
  });
}

/** Backward compatible: Assign candidate to panel. */
export async function assignPanel(
  rollNumber: string,
  panelId: string
): Promise<void> {
  return assignPanelInEvent("recruitment-2026", rollNumber, panelId);
}

/** Backward compatible: Save panel verdict. */
export async function savePanelVerdict(
  rollNumber: string,
  panelId: string,
  verdict: PanelVerdict["verdict"],
  notes: string
): Promise<void> {
  return savePanelVerdictInEvent("recruitment-2026", rollNumber, panelId, verdict, notes);
}

// ── Panel Helpers ──────────────────────────────────────────────────────────

/** Fetch all interview panels. */
export async function getPanels(eventId?: string): Promise<Panel[]> {
  const q = query(collection(db, "panels"), orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Panel));
  if (eventId) {
    return all.filter((p) => !p.eventId || p.eventId === eventId);
  }
  return all;
}

/** Create a new interview panel. */
export async function createPanel(
  name: string,
  passcode: string,
  eventId?: string,
  members: string[] = []
): Promise<string> {
  const ref = doc(collection(db, "panels"));
  await setDoc(ref, {
    name,
    passcode,
    members,
    ...(eventId ? { eventId } : {}),
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

/** Update an existing panel (passcode, members, etc). */
export async function updatePanel(
  panelId: string,
  updates: Partial<Omit<Panel, "id" | "createdAt">>
): Promise<void> {
  const ref = doc(db, "panels", panelId);
  await updateDoc(ref, updates);
}

/** Save a specific panel member's evaluation for a candidate. */
export async function saveMemberEvaluationInEvent(
  eventId: string,
  rollNumber: string,
  panelId: string,
  memberName: string,
  evaluation: {
    verdict: "pass" | "fail" | "pending";
    notes: string;
    scores: EvaluationScores;
  }
): Promise<void> {
  const targetCollection = eventId === "recruitment-2026"
    ? collection(db, "registrations")
    : collection(db, "events", eventId, "registrations");
  const ref = doc(targetCollection, rollNumber.toUpperCase());
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Candidate registration not found.");

  const candidateData = snap.data() as Registration;
  const existingInterview = candidateData.interviews?.[panelId] || {
    verdict: "pending",
    notes: "",
    evaluations: {},
    updatedAt: Timestamp.now(),
  };

  const existingEvaluations = existingInterview.evaluations || {};
  const updatedEvaluations = {
    ...existingEvaluations,
    [memberName]: {
      memberName,
      verdict: evaluation.verdict,
      notes: evaluation.notes,
      scores: evaluation.scores,
      updatedAt: Date.now(),
    },
  };

  // Re-calculate averages across all panel member evaluations
  const evalsList = Object.values(updatedEvaluations);
  let totalTech = 0, totalComm = 0, totalProblem = 0, totalCulture = 0;
  let passVotes = 0, failVotes = 0;
  const notesList: string[] = [];

  evalsList.forEach((ev) => {
    if (ev.scores) {
      totalTech += Number(ev.scores.technical || 0);
      totalComm += Number(ev.scores.communication || 0);
      totalProblem += Number(ev.scores.problemSolving || 0);
      totalCulture += Number(ev.scores.cultureFit || 0);
    }
    if (ev.verdict === "pass") passVotes++;
    if (ev.verdict === "fail") failVotes++;
    if (ev.notes) notesList.push(`${ev.memberName}: "${ev.notes}"`);
  });

  const count = evalsList.length || 1;
  const avgScores: EvaluationScores = {
    technical: Math.round((totalTech / count) * 10) / 10,
    communication: Math.round((totalComm / count) * 10) / 10,
    problemSolving: Math.round((totalProblem / count) * 10) / 10,
    cultureFit: Math.round((totalCulture / count) * 10) / 10,
  };

  const overallAvg = Math.round(((avgScores.technical + avgScores.communication + avgScores.problemSolving + avgScores.cultureFit) / 4) * 10) / 10;
  const aggregatedVerdict = passVotes > 0 ? "pass" : failVotes > 0 ? "fail" : "pending";

  await updateDoc(ref, {
    [`interviews.${panelId}`]: {
      verdict: aggregatedVerdict,
      notes: notesList.join("\n\n"),
      evaluations: updatedEvaluations,
      averageScores: avgScores,
      overallScore: overallAvg,
      updatedAt: Timestamp.now(),
    },
  });
}

/** Delete a panel by ID. */
export async function deletePanel(panelId: string): Promise<void> {
  const ref = doc(db, "panels", panelId);
  await deleteDoc(ref);
}

/** Verify panel passcode. */
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

/** Fetch candidates assigned to a panel. */
export async function getCandidatesForPanel(
  panelId: string
): Promise<Registration[]> {
  const q = query(
    collection(db, "registrations"),
    where("panelId", "==", panelId)
  );
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map((d) => d.data() as Registration);
  return all
    .filter((c) => c.status === "aptitude_shortlisted" || c.status === "interview_shortlisted" || c.status === "rejected")
    .sort((a, b) => b.submittedAt.toMillis() - a.submittedAt.toMillis());
}


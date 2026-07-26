import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, Timestamp } from "firebase/firestore";

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

const candidates = [
  {
    name: "Atharva Kulkarni",
    rollNumber: "2403001",
    email: "atharva.k@example.com",
    phone: "9876543210",
    department: "CSE",
    year: "2nd",
    gender: "Male",
    whyJoin: "Enthusiastic about full-stack web development and AI system architecture.",
    hasCodedBefore: true,
    portfolioUrl: "https://github.com/atharva",
    present: true,
    status: "registered",
  },
  {
    name: "Sneha Sharma",
    rollNumber: "2403015",
    email: "sneha.sharma@example.com",
    phone: "9812345678",
    department: "CSE AIML",
    year: "2nd",
    gender: "Female",
    whyJoin: "Passionate about Machine Learning models and competitive programming.",
    hasCodedBefore: true,
    portfolioUrl: "https://github.com/sneha-aiml",
    present: true,
    status: "aptitude_shortlisted",
  },
  {
    name: "Rohan Mehta",
    rollNumber: "2403028",
    email: "rohan.mehta@example.com",
    phone: "9823456789",
    department: "IT",
    year: "3rd",
    gender: "Male",
    whyJoin: "Want to lead team projects and organize coding hackathons.",
    hasCodedBefore: true,
    portfolioUrl: "https://github.com/rohan-m",
    present: true,
    status: "interview_shortlisted",
  },
  {
    name: "Ananya Verma",
    rollNumber: "2403042",
    email: "ananya.v@example.com",
    phone: "9834567890",
    department: "ENTC",
    year: "1st",
    gender: "Female",
    whyJoin: "Eager to learn modern web development and collaborate in club workshops.",
    hasCodedBefore: true,
    portfolioUrl: "https://github.com/ananya-v",
    present: true,
    status: "selected",
  },
  {
    name: "Vikram Singh",
    rollNumber: "2403055",
    email: "vikram.singh@example.com",
    phone: "9845678901",
    department: "MECH",
    year: "2nd",
    gender: "Male",
    whyJoin: "Interested in hardware-software integration and robotics coding.",
    hasCodedBefore: false,
    portfolioUrl: "",
    present: false,
    status: "registered",
  },
  {
    name: "Priya Patel",
    rollNumber: "2403069",
    email: "priya.patel@example.com",
    phone: "9856789012",
    department: "ROBOTICS",
    year: "1st",
    gender: "Female",
    whyJoin: "Looking to connect with developer peers and build portfolio projects.",
    hasCodedBefore: false,
    portfolioUrl: "",
    present: true,
    status: "rejected",
  },
];

async function seed() {
  console.log("Seeding candidates into Firestore project: oysterreg...");
  for (const c of candidates) {
    const ref = doc(db, "registrations", c.rollNumber.toUpperCase());
    await setDoc(ref, {
      ...c,
      submittedAt: Timestamp.now(),
      formData: { ...c },
      eventId: "recruitment-2026",
    });
    console.log(`✓ Seeded ${c.name} (${c.rollNumber}) -> Stage: ${c.status}`);
  }
  console.log("Seeding completed successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});

import Link from "next/link";
import styles from "./success.module.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Application Submitted — Oyster Coding Club",
};

export default function SuccessPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className={styles.title}>Application Received</h1>
        <p className={styles.body}>
          Thank you for applying to the Oyster Coding Club. We have recorded your
          details. Shortlisted candidates will be contacted with information about the
          next steps.
        </p>
        <div className={styles.divider} />
        <p className={styles.note}>
          If you submitted your form by mistake or need to make changes, please
          reach out to us directly.
        </p>
        <Link href="/" className={`btn btn-outline ${styles.backBtn}`} id="back-to-home-btn">
          Back to Home
        </Link>
      </div>
    </main>
  );
}

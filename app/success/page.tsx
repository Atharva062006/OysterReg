import Link from "next/link";
import Image from "next/image";
import styles from "./success.module.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Application Submitted — Oyster Kode Club",
};

interface SuccessPageProps {
  searchParams: Promise<{ whatsapp?: string }>;
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const resolvedParams = await searchParams;
  const whatsappUrl = resolvedParams.whatsapp;

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <Image src="/logo1.svg" alt="Oyster Kode Club" width={32} height={32} />
          <span className={styles.clubTag}>Oyster Kode Club</span>
        </div>
        <div className={styles.icon} aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className={styles.title}>Application Received</h1>
        <p className={styles.body}>
          Thank you for applying to the Oyster Kode Club. We have recorded your
          details. Shortlisted candidates will be contacted with information about the
          next steps.
        </p>
        
        {whatsappUrl && (
          <div style={{ marginTop: "1.5rem", marginBottom: "0.5rem", background: "rgba(34, 197, 94, 0.1)", padding: "1.25rem", borderRadius: "var(--radius-lg)", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              Join our WhatsApp Group!
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
              Please join the official WhatsApp group for important updates and announcements regarding your application.
            </p>
            <a 
              href={whatsappUrl}
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ width: "100%", background: "#25D366", borderColor: "#25D366", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              Join WhatsApp Group
            </a>
          </div>
        )}
        
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


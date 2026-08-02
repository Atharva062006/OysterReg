"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  getEventById,
  getEventRegistrations,
  toggleEventRegistration,
  Event,
  Registration,
} from "@/lib/firebase";
import StatCard from "@/components/StatCard";
import EventAdminNav from "@/components/EventAdminNav";
import RegistrationTable from "@/components/RegistrationTable";
import styles from "@/app/admin/admin.module.css";

interface EventOverviewProps {
  params: Promise<{ eventId: string }>;
}

export default function EventOverviewPage({ params }: EventOverviewProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  // Auth gate
  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("oyster_admin")) {
      router.replace("/admin/login");
    }
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const ev = await getEventById(eventId);
      if (!ev) {
        setError("Event not found.");
        return;
      }
      setEvent(ev);
      const regs = await getEventRegistrations(eventId);
      setRegistrations(regs);
    } catch (err) {
      console.error(err);
      setError("Failed to load event data.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleSignOut() {
    sessionStorage.removeItem("oyster_admin");
    router.push("/admin/login");
  }

  async function handleToggleRegistration() {
    if (!event) return;
    const nextState = !event.registrationOpen;
    try {
      await toggleEventRegistration(eventId, nextState);
      setEvent((prev) => (prev ? { ...prev, registrationOpen: nextState } : prev));
    } catch {
      alert("Failed to update registration status.");
    }
  }

  function handleCopyShareLink() {
    const link = `${window.location.origin}/events/${eventId}/register`;
    navigator.clipboard.writeText(link).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }

  const total = registrations.length;
  const presentCount = registrations.filter((r) => r.present).length;

  // Pipeline stage counts
  const stageCounts: Record<string, number> = {};
  if (event) {
    event.stages.forEach((st) => {
      stageCounts[st.id] = 0;
    });
    registrations.forEach((r) => {
      const st = r.status || (event.stages[0]?.id || "registered");
      stageCounts[st] = (stageCounts[st] || 0) + 1;
    });
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading event dashboard…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.errorBanner}>{error || "Event not found."}</div>
          <Link href="/admin" className="btn btn-primary">
            ← Back to All Events
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.topBarLeft}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={32} height={32} />
            <div>
              <div className={styles.breadcrumb}>Event Workspace</div>
              <h1 className={styles.pageTitle}>{event.name}</h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button onClick={handleCopyShareLink} className="btn btn-outline" style={{ fontSize: "0.8125rem" }}>
              {copySuccess ? "✓ Link Copied!" : "Share Public Link"}
            </button>
            <button onClick={handleSignOut} className={`btn btn-outline ${styles.signOutBtn}`}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Nav */}
      <EventAdminNav eventId={eventId} eventName={event.name} eventType={event.type} />

      <main className={styles.main}>
        {/* Status Header Bar */}
        <section className={styles.section}>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem 1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {event.name} Dashboard
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                {event.description || "Manage stages, registrations, and interview panels for this event."}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span className={event.registrationOpen ? styles.badgeOpen : styles.badgeClosed}>
                {event.registrationOpen ? "Registrations Open" : "Registrations Closed"}
              </span>
              <button onClick={handleToggleRegistration} className={`btn ${event.registrationOpen ? "btn-outline" : "btn-primary"}`}>
                {event.registrationOpen ? "Close Registrations" : "Open Registrations"}
              </button>
            </div>
          </div>
        </section>

        {/* Pipeline Stages Overview */}
        <section className={styles.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className={styles.sectionTitle}>Pipeline Stages</h2>
          </div>

          <div className={styles.pipeline} style={{ marginTop: "1rem" }}>
            {event.stages.map((st, idx) => (
              <div key={st.id} className={styles.pipelineStep}>
                <Link
                  href={`/admin/events/${eventId}/candidates?stage=${st.id}`}
                  className={`${styles.pipelineCard} ${styles[`pipeline_${st.color || "default"}`]}`}
                >
                  <span className={styles.pipelineCount}>{stageCounts[st.id] || 0}</span>
                  <span className={styles.pipelineLabel}>{st.name}</span>
                </Link>
                {idx < event.stages.length - 1 && <span className={styles.pipelineArrow}>→</span>}
              </div>
            ))}
          </div>
        </section>

        {/* Key Stats */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Overview Stats</h2>
          <div className={styles.statsGrid}>
            <StatCard label="Total Applicants" value={total} />
            <StatCard
              label="Attendance Marked"
              value={presentCount}
              sub={total > 0 ? `${Math.round((presentCount / total) * 100)}% of total` : "—"}
            />
            <StatCard label="Configured Stages" value={event.stages.length} />
          </div>
        </section>

        {/* Candidate Table Preview */}
        <section className={styles.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className={styles.sectionTitle}>Recent Candidate Registrations</h2>
            <Link href={`/admin/events/${eventId}/candidates`} className="btn btn-outline" style={{ fontSize: "0.8125rem" }}>
              View All Candidates →
            </Link>
          </div>
          <RegistrationTable initialData={registrations} />
        </section>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  getEvents,
  createEvent,
  toggleEventRegistration,
  setActiveEvent,
  deleteEvent,
  getEventRegistrations,
  Event,
} from "@/lib/firebase";
import StatCard from "@/components/StatCard";
import styles from "./admin.module.css";

export default function AdminHubPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [candidateCounts, setCandidateCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Event Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [preset, setPreset] = useState<"recruitment" | "hackathon" | "workshop">("recruitment");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  // Auth gate
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("oyster_admin");
      if (!auth) {
        router.replace("/admin/login");
      }
    }
  }, [router]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getEvents();
      setEvents(list);

      // Fetch registration count for each event
      const counts: Record<string, number> = {};
      await Promise.all(
        list.map(async (ev) => {
          try {
            const regs = await getEventRegistrations(ev.id);
            counts[ev.id] = regs.length;
          } catch (err) {
            console.warn(`Could not load candidate registrations for ${ev.id}:`, err);
            counts[ev.id] = 0;
          }
        })
      );
      setCandidateCounts(counts);
    } catch (err: any) {
      console.error("Error loading events:", err);
      if (err?.code === "permission-denied" || err?.message?.includes("permissions")) {
        setError("Note: Firestore Security Rules currently restrict access to custom events. Recruitment 2026 data is loaded by default.");
      } else {
        setError("Failed to load events. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  function handleSignOut() {
    sessionStorage.removeItem("oyster_admin");
    router.push("/admin/login");
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setFormError("Event name is required.");
      return;
    }

    setCreating(true);
    try {
      const newId = await createEvent(name.trim(), description.trim(), preset);
      setShowCreateModal(false);
      setName("");
      setDescription("");
      setPreset("recruitment");
      await loadEvents();
      router.push(`/admin/events/${newId}`);
    } catch (err: any) {
      console.error("Create event error:", err);
      if (err?.code === "permission-denied" || err?.message?.includes("permission")) {
        setFormError("Firestore Security Error: Please update your Firestore Security Rules in Firebase Console to allow read/write access to the 'events' collection.");
      } else {
        setFormError(err.message || "Failed to create event.");
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleRegistration(eventId: string, currentStatus: boolean) {
    try {
      await toggleEventRegistration(eventId, !currentStatus);
      setEvents((prev) =>
        prev.map((ev) => (ev.id === eventId ? { ...ev, registrationOpen: !currentStatus } : ev))
      );
    } catch {
      alert("Failed to update registration status.");
    }
  }

  async function handleSetActive(eventId: string) {
    try {
      await setActiveEvent(eventId);
      setEvents((prev) =>
        prev.map((ev) => ({ ...ev, isActive: ev.id === eventId }))
      );
    } catch {
      alert("Failed to set active event.");
    }
  }

  async function handleDeleteEvent(eventId: string, eventName: string) {
    if (eventId === "recruitment-2026") {
      alert("The default Recruitment 2026 event cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to delete "${eventName}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteEvent(eventId);
      setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    } catch (err: any) {
      alert(err.message || "Failed to delete event.");
    }
  }

  const totalEvents = events.length;
  const activeEvent = events.find((ev) => ev.isActive) || events[0];
  const totalCandidatesAcrossEvents = Object.values(candidateCounts).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading events hub…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Top Bar ── */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.topBarLeft}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={32} height={32} />
            <div>
              <div className={styles.breadcrumb}>Oyster Kode Club</div>
              <h1 className={styles.pageTitle}>Events Management Hub</h1>
            </div>
          </div>
          <button
            id="admin-signout-btn"
            onClick={handleSignOut}
            className={`btn btn-outline ${styles.signOutBtn}`}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {error && <div className={styles.errorBanner} role="alert">{error}</div>}

        {/* ── Section Header & Overview ── */}
        <section className={styles.section}>
          <div className="flex-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2 className={styles.sectionTitle}>All Events</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
                Create, customize, and manage registration processes for every Oyster event without touching any source code.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
              id="create-new-event-btn"
            >
              + Create New Event
            </button>
          </div>

          <div className={styles.statsGrid} style={{ marginTop: "1.5rem" }}>
            <StatCard label="Total Events" value={totalEvents} />
            <StatCard
              label="Active Primary Registration"
              value={activeEvent ? activeEvent.name : "None"}
              sub={activeEvent?.registrationOpen ? "Registrations Open" : "Registrations Closed"}
            />
            <StatCard label="Total Registrations" value={totalCandidatesAcrossEvents} />
          </div>
        </section>

        {/* ── Events Grid ── */}
        <section className={styles.section}>
          <div className={styles.eventsGrid}>
            {events.map((ev) => {
              const count = candidateCounts[ev.id] || 0;
              return (
                <div
                  key={ev.id}
                  className={`${styles.eventCard} ${ev.isActive ? styles.eventCardActive : ""}`}
                >
                  <div className={styles.eventHeader}>
                    <div className={styles.badgeRow}>
                      {ev.isActive && <span className={styles.badgeActive}>Active Site Registration</span>}
                      {ev.registrationOpen ? (
                        <span className={styles.badgeOpen}>Open</span>
                      ) : (
                        <span className={styles.badgeClosed}>Closed</span>
                      )}
                    </div>
                    <h3 className={styles.eventTitle}>{ev.name}</h3>
                    <p className={styles.eventDesc}>{ev.description || "No description provided."}</p>
                  </div>

                  <div className={styles.eventMeta}>
                    <span>Total Registrations</span>
                    <span className={styles.eventMetaValue}>{count}</span>
                  </div>

                  <div className={styles.eventControls}>
                    <div className={styles.toggleRow}>
                      <span>Registration Gate:</span>
                      <button
                        onClick={() => handleToggleRegistration(ev.id, ev.registrationOpen)}
                        className={`btn btn-sm ${ev.registrationOpen ? "btn-outline" : "btn-primary"}`}
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                      >
                        {ev.registrationOpen ? "Close Registrations" : "Open Registrations"}
                      </button>
                    </div>

                    {!ev.isActive && (
                      <div className={styles.toggleRow}>
                        <span>Primary Site Registration:</span>
                        <button
                          onClick={() => handleSetActive(ev.id)}
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                        >
                          Set Active
                        </button>
                      </div>
                    )}
                  </div>

                  <div className={styles.eventActions}>
                    <Link
                      href={`/admin/events/${ev.id}`}
                      className="btn btn-primary"
                      style={{ flex: 1, textAlign: "center", textDecoration: "none" }}
                    >
                      Manage Panel →
                    </Link>
                    {ev.id !== "recruitment-2026" && (
                      <button
                        onClick={() => handleDeleteEvent(ev.id, ev.name)}
                        className="btn btn-outline"
                        style={{ color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                        title="Delete Event"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ── Create Event Modal ── */}
      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Create New Event</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="flex-col gap-4" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className={styles.label} style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Event Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. CodeSprint 2026, AI Workshop"
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-primary)",
                    marginTop: "0.375rem",
                  }}
                />
              </div>

              <div>
                <label className={styles.label} style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the event..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-primary)",
                    marginTop: "0.375rem",
                  }}
                />
              </div>

              <div>
                <label className={styles.label} style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Form & Pipeline Template Preset
                </label>
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-primary)",
                    marginTop: "0.375rem",
                  }}
                >
                  <option value="recruitment">Standard Recruitment (Registered → Aptitude → Interview → Selected)</option>
                  <option value="hackathon">Hackathon / Project Contest (Registered → Idea Shortlist → Check-in → Winner)</option>
                  <option value="workshop">Workshop / Event RSVP (Registered → RSVP Confirmed → Attended)</option>
                </select>
              </div>

              {formError && (
                <p style={{ color: "var(--danger)", fontSize: "0.875rem" }} role="alert">
                  {formError}
                </p>
              )}

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary"
                >
                  {creating ? "Creating Event..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

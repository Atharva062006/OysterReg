"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getEventById,
  getEventRegistrations,
  updateCandidateStatusInEvent,
  bulkUpdateCandidateStatusInEvent,
  toggleCandidatePresentInEvent,
  Event,
  Registration,
} from "@/lib/firebase";
import EventAdminNav from "@/components/EventAdminNav";
import styles from "@/app/admin/admin.module.css";
import tableStyles from "@/components/RegistrationTable.module.css";

interface PageProps {
  params: Promise<{ eventId: string }>;
}

export default function AptitudeReviewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [showRejected, setShowRejected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

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
      const [ev, regs] = await Promise.all([
        getEventById(eventId),
        getEventRegistrations(eventId),
      ]);
      if (!ev) {
        setError("Event not found.");
        return;
      }
      setEvent(ev);
      setRegistrations(regs);
    } catch (err) {
      console.error(err);
      setError("Failed to load aptitude registrations.");
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

  async function handleTogglePresent(candidateId: string, currentPresent: boolean) {
    try {
      await toggleCandidatePresentInEvent(eventId, candidateId, !currentPresent);
      setRegistrations((prev) =>
        prev.map((r) => (r.rollNumber === candidateId ? { ...r, present: !currentPresent } : r))
      );
    } catch {
      alert("Failed to update attendance.");
    }
  }

  const [updatingRn, setUpdatingRn] = useState<string | null>(null);

  async function handleSingleAction(candidateId: string, targetStatus: string) {
    setUpdatingRn(candidateId);
    // Instant optimistic update
    setRegistrations((prev) =>
      prev.map((r) => (r.rollNumber === candidateId ? { ...r, status: targetStatus } : r))
    );
    try {
      await updateCandidateStatusInEvent(eventId, candidateId, targetStatus);
    } catch {
      alert("Failed to update status.");
      loadData();
    } finally {
      setUpdatingRn(null);
    }
  }

  async function handleBulkAction(targetStatus: string) {
    if (selectedIds.length === 0) return;
    setBusy(true);
    try {
      await bulkUpdateCandidateStatusInEvent(eventId, selectedIds, targetStatus);
      setRegistrations((prev) =>
        prev.map((r) => (selectedIds.includes(r.rollNumber) ? { ...r, status: targetStatus } : r))
      );
      setSelectedIds([]);
    } catch {
      alert("Failed to perform bulk update.");
    } finally {
      setBusy(false);
    }
  }

  // Aptitude stage candidates (registered, aptitude_shortlisted, rejected)
  const aptitudeCandidates = registrations.filter((r) => {
    const s = r.status || "registered";
    if (!showRejected && s === "rejected") return false;
    if (!["registered", "aptitude_shortlisted", "rejected"].includes(s)) return false;
    const q = search.toLowerCase().trim();
    if (q && !r.name.toLowerCase().includes(q) && !r.rollNumber.toLowerCase().includes(q)) return false;
    return true;
  });

  const registeredCount = registrations.filter((r) => (r.status || "registered") === "registered").length;
  const shortlistedCount = registrations.filter((r) => r.status === "aptitude_shortlisted").length;
  const presentCount = registrations.filter((r) => r.present).length;

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading aptitude review workspace…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.errorBanner}>{error || "Event not found."}</div>
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
              <div className={styles.breadcrumb}>{event.name}</div>
              <h1 className={styles.pageTitle}>Aptitude & Review Round</h1>
            </div>
          </div>
          <button onClick={handleSignOut} className={`btn btn-outline ${styles.signOutBtn}`}>
            Sign out
          </button>
        </div>
      </header>

      <EventAdminNav eventId={eventId} eventName={event.name} eventType={event.type} />

      <main className={styles.main}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Aptitude Overview Metric Cards */}
        <section className={styles.section}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1.25rem", borderRadius: "var(--radius-lg)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Awaiting Review</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "0.25rem" }}>{registeredCount}</div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1.25rem", borderRadius: "var(--radius-lg)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Aptitude Shortlisted</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--accent)", marginTop: "0.25rem" }}>{shortlistedCount}</div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1.25rem", borderRadius: "var(--radius-lg)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Present Candidates</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#22c55e", marginTop: "0.25rem" }}>{presentCount}</div>
            </div>
          </div>
        </section>

        {/* Controls & Table */}
        <section className={styles.section}>
          <div className={tableStyles.controlsRow}>
            <input
              type="text"
              placeholder="Search candidate name or roll number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={tableStyles.searchInput}
            />
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showRejected}
                onChange={(e) => setShowRejected(e.target.checked)}
              />
              Show Rejected
            </label>
          </div>

          {/* Bulk actions */}
          {selectedIds.length > 0 && (
            <div
              style={{
                background: "rgba(245, 166, 35, 0.1)",
                border: "1px solid var(--accent)",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-md)",
                margin: "1rem 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {selectedIds.length} candidate{selectedIds.length !== 1 ? "s" : ""} selected
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => handleBulkAction("aptitude_shortlisted")}
                  disabled={busy}
                  className="btn btn-sm btn-primary"
                >
                  Shortlist for Interview
                </button>
                <button
                  onClick={() => handleBulkAction("rejected")}
                  disabled={busy}
                  className="btn btn-sm btn-outline"
                  style={{ color: "var(--danger)" }}
                >
                  Reject Selected
                </button>
                <button onClick={() => setSelectedIds([])} className="btn btn-sm btn-outline">
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Aptitude Candidates Table */}
          <div className={tableStyles.tableWrapper} style={{ marginTop: "1rem" }}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      checked={aptitudeCandidates.length > 0 && selectedIds.length === aptitudeCandidates.length}
                      onChange={() => {
                        if (selectedIds.length === aptitudeCandidates.length) setSelectedIds([]);
                        else setSelectedIds(aptitudeCandidates.map((c) => c.rollNumber));
                      }}
                    />
                  </th>
                  <th>Candidate</th>
                  <th>Roll / Identifier</th>
                  <th>Attendance</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {aptitudeCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={tableStyles.emptyState}>
                      No candidates in Aptitude review stage.
                    </td>
                  </tr>
                ) : (
                  aptitudeCandidates.map((reg) => {
                    const isSelected = selectedIds.includes(reg.rollNumber);
                    const isShortlisted = reg.status === "aptitude_shortlisted";
                    const isRejected = reg.status === "rejected";

                    return (
                      <tr key={reg.rollNumber} className={isSelected ? tableStyles.rowSelected : ""}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              setSelectedIds((prev) =>
                                prev.includes(reg.rollNumber)
                                  ? prev.filter((id) => id !== reg.rollNumber)
                                  : [...prev, reg.rollNumber]
                              )
                            }
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{reg.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{reg.email}</div>
                        </td>
                        <td><code>{reg.rollNumber}</code></td>
                        <td>
                          <button
                            onClick={() => handleTogglePresent(reg.rollNumber, reg.present)}
                            className={`btn btn-sm ${reg.present ? "btn-primary" : "btn-outline"}`}
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                          >
                            {reg.present ? "✓ Present" : "Absent"}
                          </button>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "0.25rem 0.5rem",
                              borderRadius: "999px",
                              background: isShortlisted
                                ? "rgba(245, 166, 35, 0.15)"
                                : isRejected
                                ? "rgba(239, 68, 68, 0.15)"
                                : "rgba(148, 163, 184, 0.15)",
                              color: isShortlisted
                                ? "var(--accent)"
                                : isRejected
                                ? "var(--danger)"
                                : "var(--text-muted)",
                            }}
                          >
                            {isShortlisted ? "Shortlisted" : isRejected ? "Rejected" : "Awaiting Review"}
                          </span>
                        </td>
                        <td>
                          {updatingRn === reg.rollNumber ? (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Updating...</span>
                          ) : (
                            <div style={{ display: "flex", gap: "0.35rem" }}>
                              {isShortlisted ? (
                                <button
                                  onClick={() => handleSingleAction(reg.rollNumber, "registered")}
                                  className="btn btn-sm btn-outline"
                                  style={{ fontSize: "0.75rem" }}
                                >
                                  Reset
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSingleAction(reg.rollNumber, "aptitude_shortlisted")}
                                  className="btn btn-sm btn-primary"
                                  style={{ fontSize: "0.75rem" }}
                                >
                                  Shortlist
                                </button>
                              )}

                              {!isRejected && (
                                <button
                                  onClick={() => handleSingleAction(reg.rollNumber, "rejected")}
                                  className="btn btn-sm btn-outline"
                                  style={{ fontSize: "0.75rem", color: "var(--danger)" }}
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

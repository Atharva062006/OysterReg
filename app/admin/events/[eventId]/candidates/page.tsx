"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  getEventById,
  getEventRegistrations,
  getPanels,
  updateCandidateStatusInEvent,
  bulkUpdateCandidateStatusInEvent,
  toggleCandidatePresentInEvent,
  assignPanelInEvent,
  Event,
  Registration,
  Panel,
} from "@/lib/firebase";
import EventAdminNav from "@/components/EventAdminNav";
import styles from "@/app/admin/admin.module.css";
import tableStyles from "@/components/RegistrationTable.module.css";

interface CandidatesPageProps {
  params: Promise<{ eventId: string }>;
}

function VerdictBadge({ verdict }: { verdict?: string }) {
  if (!verdict || verdict === "pending") {
    return (
      <span
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          padding: "0.2rem 0.5rem",
          borderRadius: "999px",
          background: "rgba(148, 163, 184, 0.15)",
          color: "var(--text-muted)",
          border: "1px solid var(--border)",
        }}
      >
        Pending
      </span>
    );
  }
  if (verdict === "pass") {
    return (
      <span
        style={{
          fontSize: "0.6875rem",
          fontWeight: 700,
          padding: "0.2rem 0.5rem",
          borderRadius: "999px",
          background: "rgba(34, 197, 94, 0.15)",
          color: "#22c55e",
          border: "1px solid rgba(34, 197, 94, 0.3)",
        }}
      >
        PASS
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: "0.6875rem",
        fontWeight: 700,
        padding: "0.2rem 0.5rem",
        borderRadius: "999px",
        background: "rgba(239, 68, 68, 0.15)",
        color: "#ef4444",
        border: "1px solid rgba(239, 68, 68, 0.3)",
      }}
    >
      FAIL
    </span>
  );
}

export default function CandidatesPage({ params }: CandidatesPageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const searchParams = useSearchParams();
  const initialStageFilter = searchParams.get("stage") || "all";

  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Selection
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(initialStageFilter);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetStage, setTargetStage] = useState("");
  const [assigningRn, setAssigningRn] = useState<string | null>(null);

  // Detail Modal & Notes Modal
  const [viewCandidate, setViewCandidate] = useState<Registration | null>(null);
  const [notesModal, setNotesModal] = useState<{
    name: string;
    rollNumber: string;
    panelName: string;
    verdict?: string;
    notes: string;
  } | null>(null);

  // Auth gate
  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("oyster_admin")) {
      router.replace("/admin/login");
    }
  }, [router]);

  // Sync searchParam changes to state
  useEffect(() => {
    const s = searchParams.get("stage");
    if (s) setStageFilter(s);
  }, [searchParams]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ev, regs, pnls] = await Promise.all([
        getEventById(eventId),
        getEventRegistrations(eventId),
        getPanels(eventId),
      ]);
      if (!ev) {
        setError("Event not found.");
        return;
      }
      setEvent(ev);
      setRegistrations(regs);
      setPanels(pnls);
    } catch (err) {
      console.error(err);
      setError("Failed to load candidate registrations.");
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

  async function handleSingleStatusChange(candidateId: string, newStatus: string) {
    try {
      await updateCandidateStatusInEvent(eventId, candidateId, newStatus);
      setRegistrations((prev) =>
        prev.map((r) => (r.rollNumber === candidateId ? { ...r, status: newStatus } : r))
      );
    } catch {
      alert("Failed to update status.");
    }
  }

  async function handleAssignPanel(rollNumber: string, panelId: string) {
    setAssigningRn(rollNumber);
    try {
      await assignPanelInEvent(eventId, rollNumber, panelId);
      setRegistrations((prev) =>
        prev.map((r) => (r.rollNumber === rollNumber ? { ...r, panelId } : r))
      );
    } catch {
      alert("Failed to assign panel.");
    } finally {
      setAssigningRn(null);
    }
  }

  async function handleBulkStatusChange(specificStage?: string) {
    const stageToApply = specificStage || targetStage;
    if (selectedIds.length === 0 || !stageToApply) return;
    try {
      await bulkUpdateCandidateStatusInEvent(eventId, selectedIds, stageToApply);
      setRegistrations((prev) =>
        prev.map((r) => (selectedIds.includes(r.rollNumber) ? { ...r, status: stageToApply } : r))
      );
      setSelectedIds([]);
      setTargetStage("");
    } catch {
      alert("Failed to bulk update status.");
    }
  }

  function toggleSelectAll(filtered: Registration[]) {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((f) => f.rollNumber));
    }
  }

  // Filtered registrations
  const filtered = registrations.filter((r) => {
    const statusMatch = stageFilter === "all" || (r.status || "registered") === stageFilter;
    const q = search.toLowerCase().trim();
    const textMatch =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.rollNumber.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.department && r.department.toLowerCase().includes(q));
    return statusMatch && textMatch;
  });

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading candidate list…</p>
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

  const currentStageConfig = event.stages.find((s) => s.id === stageFilter);

  return (
    <div className={styles.page}>
      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.topBarLeft}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={32} height={32} />
            <div>
              <div className={styles.breadcrumb}>{event.name}</div>
              <h1 className={styles.pageTitle}>
                {stageFilter === "all"
                  ? "All Applicants & Pipeline"
                  : event.type === "recruitment"
                  ? (stageFilter === "registered"
                      ? "Aptitude & Initial Review"
                      : stageFilter === "aptitude_shortlisted"
                      ? "Interview & Panel Evaluation"
                      : stageFilter === "selected"
                      ? "Selected Candidates"
                      : currentStageConfig?.name || "Candidates")
                  : (currentStageConfig?.name || "Candidates")
                }
              </h1>
            </div>
          </div>
          <button onClick={handleSignOut} className={`btn btn-outline ${styles.signOutBtn}`}>
            Sign out
          </button>
        </div>
      </header>

      {/* Nav */}
      <EventAdminNav eventId={eventId} eventName={event.name} eventType={event.type} />

      <main className={styles.main}>
        <section className={styles.section}>
          <div className={tableStyles.controlsRow}>
            {/* Search */}
            <input
              type="text"
              placeholder="Search candidate name, roll number, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={tableStyles.searchInput}
            />

            {/* Filter by stage */}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className={tableStyles.filterSelect}
            >
              <option value="all">All Stages ({registrations.length})</option>
              {event.stages.map((st) => {
                const cnt = registrations.filter((r) => (r.status || event.stages[0]?.id) === st.id).length;
                return (
                  <option key={st.id} value={st.id}>
                    {st.name} ({cnt})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Bulk actions bar */}
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
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {selectedIds.length} candidate{selectedIds.length !== 1 ? "s" : ""} selected
              </span>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                {/* 1-Click Shortlist Shortcuts */}
                {event.stages.length > 1 && (
                  <button
                    onClick={() => handleBulkStatusChange(event.stages[1].id)}
                    className="btn btn-sm btn-primary"
                    style={{ fontSize: "0.75rem" }}
                  >
                    Shortlist for {event.stages[1].name}
                  </button>
                )}

                {event.stages.some((s) => s.id === "selected") && (
                  <button
                    onClick={() => handleBulkStatusChange("selected")}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: "0.75rem", borderColor: "#22c55e", color: "#22c55e" }}
                  >
                    Select Final
                  </button>
                )}

                {event.stages.some((s) => s.id === "rejected") && (
                  <button
                    onClick={() => handleBulkStatusChange("rejected")}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: "0.75rem", borderColor: "rgba(239, 68, 68, 0.4)", color: "var(--danger)" }}
                  >
                    Reject Selected
                  </button>
                )}

                <select
                  value={targetStage}
                  onChange={(e) => {
                    setTargetStage(e.target.value);
                    if (e.target.value) handleBulkStatusChange(e.target.value);
                  }}
                  style={{
                    padding: "0.375rem 0.75rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text-primary)",
                    fontSize: "0.8125rem",
                  }}
                >
                  <option value="">Move to Stage...</option>
                  {event.stages.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setSelectedIds([])}
                  className="btn btn-sm btn-outline"
                  style={{ fontSize: "0.75rem" }}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Candidates Table */}
          <div className={tableStyles.tableWrapper} style={{ marginTop: "1rem" }}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={() => toggleSelectAll(filtered)}
                    />
                  </th>
                  <th>Candidate</th>
                  <th>Roll / Identifier</th>
                  <th>Attendance</th>
                  <th>Stage Status</th>
                  {event.type !== "workshop" && <th>Assigned Panel</th>}
                  {event.type !== "workshop" && <th>Interviewer Score & Verdict</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={event.type === "workshop" ? 6 : 8} className={tableStyles.emptyState}>
                      No candidate registrations match your filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((reg) => {
                    const candidateId = reg.rollNumber || reg.email;
                    const isSelected = selectedIds.includes(candidateId);
                    const currentStageId = reg.status || event.stages[0]?.id || "registered";

                    // Assigned Panel info
                    const assignedPanelObj = panels.find((p) => p.id === reg.panelId);
                    const panelVerdictObj = reg.panelId ? reg.interviews?.[reg.panelId] : undefined;

                    return (
                      <tr key={candidateId} className={isSelected ? tableStyles.rowSelected : ""}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              setSelectedIds((prev) =>
                                prev.includes(candidateId)
                                  ? prev.filter((id) => id !== candidateId)
                                  : [...prev, candidateId]
                              )
                            }
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{reg.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {reg.department || "—"} {reg.year ? `(${reg.year})` : ""}
                          </div>
                        </td>
                        <td>
                          <code style={{ fontSize: "0.8125rem" }}>{reg.rollNumber || "N/A"}</code>
                        </td>
                        <td>
                          <button
                            onClick={() => handleTogglePresent(candidateId, reg.present)}
                            className={`btn btn-sm ${reg.present ? "btn-primary" : "btn-outline"}`}
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                          >
                            {reg.present ? "✓ Present" : "Absent"}
                          </button>
                        </td>
                        <td>
                          <select
                            value={currentStageId}
                            onChange={(e) => handleSingleStatusChange(candidateId, e.target.value)}
                            style={{
                              padding: "0.25rem 0.5rem",
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                              color: "var(--text-primary)",
                              fontSize: "0.8125rem",
                            }}
                          >
                            {event.stages.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        {event.type !== "workshop" && (
                          <td>
                            {/* Panel Assignment Dropdown */}
                            <select
                              value={reg.panelId || ""}
                              onChange={(e) => handleAssignPanel(reg.rollNumber, e.target.value)}
                              disabled={assigningRn === reg.rollNumber}
                              style={{
                                padding: "0.25rem 0.5rem",
                                background: reg.panelId ? "rgba(245, 166, 35, 0.1)" : "var(--surface)",
                                border: `1px solid ${reg.panelId ? "var(--accent)" : "var(--border)"}`,
                                borderRadius: "var(--radius-sm)",
                                color: "var(--text-primary)",
                                fontSize: "0.8125rem",
                              }}
                            >
                              <option value="">Unassigned Panel</option>
                              {panels.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        {event.type !== "workshop" && (
                          <td>
                            {/* Verdict & Notes */}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <VerdictBadge verdict={panelVerdictObj?.verdict} />
                              {panelVerdictObj?.notes && (
                                <button
                                  onClick={() =>
                                    setNotesModal({
                                      name: reg.name,
                                      rollNumber: reg.rollNumber,
                                      panelName: assignedPanelObj?.name || "Panel",
                                      verdict: panelVerdictObj?.verdict,
                                      notes: panelVerdictObj.notes,
                                    })
                                  }
                                  className="btn btn-sm btn-outline"
                                  style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}
                                >
                                  📝 Notes
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                        <td>
                          <button
                            onClick={() => setViewCandidate(reg)}
                            className="btn btn-sm btn-outline"
                            style={{ fontSize: "0.75rem" }}
                          >
                            Form Details
                          </button>
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

      {/* Interviewer Notes Modal */}
      {notesModal && (
        <div className={styles.modalOverlay} onClick={() => setNotesModal(null)}>
          <div className={styles.modalContent} style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Interviewer Notes</h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  {notesModal.name} ({notesModal.rollNumber}) — {notesModal.panelName}
                </p>
              </div>
              <button
                onClick={() => setNotesModal(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "1rem", background: "var(--bg)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Verdict
                </span>
                <VerdictBadge verdict={notesModal.verdict} />
              </div>
              <div style={{ fontSize: "0.9375rem", color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {notesModal.notes || "No additional notes provided by interviewer."}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setNotesModal(null)} className="btn btn-primary">
                Close Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Candidate Details Modal */}
      {viewCandidate && (
        <div className={styles.modalOverlay} onClick={() => setViewCandidate(null)}>
          <div className={styles.modalContent} style={{ maxWidth: "640px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>{viewCandidate.name}</h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  {viewCandidate.rollNumber} | {viewCandidate.email}
                </p>
              </div>
              <button
                onClick={() => setViewCandidate(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "60vh", overflowY: "auto" }}>
              {/* Dynamic form responses */}
              {event.formSchema.map((field) => {
                const val = viewCandidate.formData
                  ? viewCandidate.formData[field.id]
                  : (viewCandidate as any)[field.id];

                return (
                  <div
                    key={field.id}
                    style={{
                      background: "var(--bg)",
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      {field.label}
                    </div>
                    <div style={{ fontSize: "0.9375rem", color: "var(--text-primary)", marginTop: "0.25rem" }}>
                      {val === true ? "Yes" : val === false ? "No" : String(val || "N/A")}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setViewCandidate(null)} className="btn btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getEventById,
  getEventRegistrations,
  getPanels,
  updateCandidateStatusInEvent,
  bulkUpdateCandidateStatusInEvent,
  assignPanelInEvent,
  Event,
  Registration,
  Panel,
  MemberEvaluation,
  EvaluationScores,
} from "@/lib/firebase";
import EventAdminNav from "@/components/EventAdminNav";
import styles from "@/app/admin/admin.module.css";
import tableStyles from "@/components/RegistrationTable.module.css";

interface PageProps {
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

export default function InterviewWorkspacePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedPanelFilter, setSelectedPanelFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assigningRn, setAssigningRn] = useState<string | null>(null);
  const [updatingRn, setUpdatingRn] = useState<string | null>(null);

  // View Mode Toggle: "average" vs "individual"
  const [viewMode, setViewMode] = useState<"average" | "individual">("average");
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>("all");

  // Notes & Breakdown Modal
  const [breakdownModal, setBreakdownModal] = useState<{
    candidateName: string;
    rollNumber: string;
    panelName: string;
    verdict?: string;
    notes?: string;
    evaluations?: Record<string, MemberEvaluation>;
    averageScores?: EvaluationScores;
    overallScore?: number;
  } | null>(null);

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
      setError("Failed to load interview workspace.");
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

  async function handleAssignPanel(rollNumber: string, panelId: string) {
    setAssigningRn(rollNumber);
    setRegistrations((prev) =>
      prev.map((r) => (r.rollNumber === rollNumber ? { ...r, panelId } : r))
    );
    try {
      await assignPanelInEvent(eventId, rollNumber, panelId);
    } catch {
      alert("Failed to assign panel.");
      loadData();
    } finally {
      setAssigningRn(null);
    }
  }

  async function handleSingleAction(rollNumber: string, targetStatus: string) {
    setUpdatingRn(rollNumber);
    setRegistrations((prev) =>
      prev.map((r) => (r.rollNumber === rollNumber ? { ...r, status: targetStatus } : r))
    );
    try {
      await updateCandidateStatusInEvent(eventId, rollNumber, targetStatus);
    } catch {
      alert("Failed to update status.");
      loadData();
    } finally {
      setUpdatingRn(null);
    }
  }

  async function handleBulkAction(targetStatus: string) {
    if (selectedIds.length === 0) return;
    const idsToUpdate = [...selectedIds];
    setSelectedIds([]);
    setRegistrations((prev) =>
      prev.map((r) => (idsToUpdate.includes(r.rollNumber) ? { ...r, status: targetStatus } : r))
    );
    try {
      await bulkUpdateCandidateStatusInEvent(eventId, idsToUpdate, targetStatus);
    } catch {
      alert("Failed to update candidates.");
      loadData();
    }
  }

  // Filter candidates relevant to Interview round
  const interviewCandidates = registrations.filter((r) => {
    const s = r.status || "registered";
    if (!["aptitude_shortlisted", "interview_shortlisted", "selected", "rejected"].includes(s)) return false;
    if (selectedPanelFilter !== "all" && r.panelId !== selectedPanelFilter) return false;
    const q = search.toLowerCase().trim();
    if (q && !r.name.toLowerCase().includes(q) && !r.rollNumber.toLowerCase().includes(q)) return false;
    return true;
  });

  const aptitudeShortlistedCount = registrations.filter((r) => r.status === "aptitude_shortlisted").length;
  const passedInterviewCount = registrations.filter((r) => {
    const v = r.panelId && r.interviews?.[r.panelId]?.verdict;
    return v === "pass";
  }).length;
  const unassignedCount = interviewCandidates.filter((r) => !r.panelId).length;

  // Extract list of all member names across assigned panels
  const allMemberNames = Array.from(
    new Set(
      panels.flatMap((p) => p.members || [])
    )
  );

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading interview workspace…</p>
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
              <h1 className={styles.pageTitle}>Interview & Panel Scoring Workspace</h1>
            </div>
          </div>
          <button onClick={handleSignOut} className={`btn btn-outline ${styles.signOutBtn}`}>
            Sign out
          </button>
        </div>
      </header>

      <EventAdminNav eventId={eventId} eventName={event.name} />

      <main className={styles.main}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Stats Row */}
        <section className={styles.section}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1.25rem", borderRadius: "var(--radius-lg)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Aptitude Shortlisted</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--accent)", marginTop: "0.25rem" }}>{aptitudeShortlistedCount}</div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1.25rem", borderRadius: "var(--radius-lg)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Interviewer PASS Verdicts</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#22c55e", marginTop: "0.25rem" }}>{passedInterviewCount}</div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1.25rem", borderRadius: "var(--radius-lg)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Unassigned to Panel</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: unassignedCount > 0 ? "#ef4444" : "var(--text-primary)", marginTop: "0.25rem" }}>{unassignedCount}</div>
            </div>
          </div>
        </section>

        {/* Controls & Table Header */}
        <section className={styles.section}>
          <div className={tableStyles.controlsRow}>
            <input
              type="text"
              placeholder="Search candidate name or roll number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={tableStyles.searchInput}
            />

            <select
              value={selectedPanelFilter}
              onChange={(e) => setSelectedPanelFilter(e.target.value)}
              className={tableStyles.filterSelect}
            >
              <option value="all">All Panels ({panels.length})</option>
              {panels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* View Mode Toggle: Average vs Individual */}
            <div style={{ display: "flex", gap: "0.25rem", background: "var(--surface)", padding: "0.25rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
              <button
                onClick={() => setViewMode("average")}
                className={`btn btn-sm ${viewMode === "average" ? "btn-primary" : "btn-outline"}`}
                style={{ fontSize: "0.75rem" }}
              >
                Average View
              </button>
              <button
                onClick={() => setViewMode("individual")}
                className={`btn btn-sm ${viewMode === "individual" ? "btn-primary" : "btn-outline"}`}
                style={{ fontSize: "0.75rem" }}
              >
                Individual Members View
              </button>
            </div>

            {viewMode === "individual" && allMemberNames.length > 0 && (
              <select
                value={selectedMemberFilter}
                onChange={(e) => setSelectedMemberFilter(e.target.value)}
                className={tableStyles.filterSelect}
              >
                <option value="all">All Member Reviews</option>
                {allMemberNames.map((m) => (
                  <option key={m} value={m}>
                    Member: {m}
                  </option>
                ))}
              </select>
            )}
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
                <button onClick={() => handleBulkAction("selected")} className="btn btn-sm btn-primary">
                  Promote to Selected
                </button>
                <button onClick={() => handleBulkAction("rejected")} className="btn btn-sm btn-outline" style={{ color: "var(--danger)" }}>
                  Reject Selected
                </button>
                <button onClick={() => setSelectedIds([])} className="btn btn-sm btn-outline">
                  Clear
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
                      checked={interviewCandidates.length > 0 && selectedIds.length === interviewCandidates.length}
                      onChange={() => {
                        if (selectedIds.length === interviewCandidates.length) setSelectedIds([]);
                        else setSelectedIds(interviewCandidates.map((c) => c.rollNumber));
                      }}
                    />
                  </th>
                  <th>Candidate</th>
                  <th>Roll / Identifier</th>
                  <th>Assigned Panel</th>
                  <th>{viewMode === "average" ? "Overall Verdict & Avg Score" : "Interviewer Scores"}</th>
                  <th>Member Feedback</th>
                  <th>Decision Action</th>
                </tr>
              </thead>
              <tbody>
                {interviewCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={tableStyles.emptyState}>
                      No candidates in Interview stage yet. Shortlist candidates from Aptitude Review first.
                    </td>
                  </tr>
                ) : (
                  interviewCandidates.map((reg) => {
                    const isSelected = selectedIds.includes(reg.rollNumber);
                    const assignedPanelObj = panels.find((p) => p.id === reg.panelId);
                    const panelInterviewObj = reg.panelId ? reg.interviews?.[reg.panelId] : undefined;
                    const isUpdating = updatingRn === reg.rollNumber;
                    const isFinalSelected = reg.status === "selected";
                    const isRejected = reg.status === "rejected";

                    // Evaluations list
                    const evalsObj = panelInterviewObj?.evaluations || {};
                    const evalsList = Object.values(evalsObj);

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
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{reg.department || "—"}</div>
                        </td>
                        <td><code>{reg.rollNumber}</code></td>
                        <td>
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
                            <option value="">Unassigned</option>
                            {panels.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Verdict & Scores Column (Average vs Individual Mode) */}
                        <td>
                          {viewMode === "average" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              <VerdictBadge verdict={panelInterviewObj?.verdict} />
                              {panelInterviewObj?.overallScore !== undefined && (
                                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--accent)" }}>
                                  Avg: {panelInterviewObj.overallScore} / 10
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                              {evalsList.length === 0 ? (
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>No member evaluations</span>
                              ) : (
                                evalsList
                                  .filter((ev) => selectedMemberFilter === "all" || ev.memberName === selectedMemberFilter)
                                  .map((ev) => {
                                    const mScore = ev.scores
                                      ? Math.round(((ev.scores.technical + ev.scores.communication + ev.scores.problemSolving + ev.scores.cultureFit) / 4) * 10) / 10
                                      : null;

                                    return (
                                      <div key={ev.memberName} style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{ev.memberName}:</span>
                                        <VerdictBadge verdict={ev.verdict} />
                                        {mScore !== null && <span style={{ fontWeight: 600, color: "var(--accent)" }}>{mScore}/10</span>}
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          )}
                        </td>

                        {/* Read Notes & Breakdown Button */}
                        <td>
                          {evalsList.length > 0 || panelInterviewObj?.notes ? (
                            <button
                              onClick={() =>
                                setBreakdownModal({
                                  candidateName: reg.name,
                                  rollNumber: reg.rollNumber,
                                  panelName: assignedPanelObj?.name || "Panel",
                                  verdict: panelInterviewObj?.verdict,
                                  notes: panelInterviewObj?.notes,
                                  evaluations: panelInterviewObj?.evaluations,
                                  averageScores: panelInterviewObj?.averageScores,
                                  overallScore: panelInterviewObj?.overallScore,
                                })
                              }
                              className="btn btn-sm btn-outline"
                              style={{ fontSize: "0.75rem" }}
                            >
                              Read Notes & Breakdown ({evalsList.length})
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>No notes</span>
                          )}
                        </td>

                        {/* Responsive Decision Action UI */}
                        <td>
                          {isUpdating ? (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Updating...</span>
                          ) : isFinalSelected ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  padding: "0.25rem 0.6rem",
                                  borderRadius: "999px",
                                  background: "rgba(34, 197, 94, 0.15)",
                                  color: "#22c55e",
                                  border: "1px solid rgba(34, 197, 94, 0.3)",
                                }}
                              >
                                ✓ Selected
                              </span>
                              <button
                                onClick={() => handleSingleAction(reg.rollNumber, "aptitude_shortlisted")}
                                className="btn btn-sm btn-outline"
                                style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}
                              >
                                Undo
                              </button>
                            </div>
                          ) : isRejected ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  padding: "0.25rem 0.6rem",
                                  borderRadius: "999px",
                                  background: "rgba(239, 68, 68, 0.15)",
                                  color: "#ef4444",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                }}
                              >
                                Rejected
                              </span>
                              <button
                                onClick={() => handleSingleAction(reg.rollNumber, "aptitude_shortlisted")}
                                className="btn btn-sm btn-outline"
                                style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}
                              >
                                Undo
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                              <button
                                onClick={() => handleSingleAction(reg.rollNumber, "selected")}
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  padding: "0.3rem 0.65rem",
                                  borderRadius: "var(--radius-sm)",
                                  background: "rgba(34, 197, 94, 0.12)",
                                  color: "#22c55e",
                                  border: "1px solid rgba(34, 197, 94, 0.3)",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Select Final
                              </button>
                              <button
                                onClick={() => handleSingleAction(reg.rollNumber, "rejected")}
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  padding: "0.3rem 0.65rem",
                                  borderRadius: "var(--radius-sm)",
                                  background: "rgba(239, 68, 68, 0.08)",
                                  color: "#ef4444",
                                  border: "1px solid rgba(239, 68, 68, 0.25)",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Reject
                              </button>
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

      {/* Member Breakdown & Scores Modal */}
      {breakdownModal && (
        <div className={styles.modalOverlay} onClick={() => setBreakdownModal(null)}>
          <div className={styles.modalContent} style={{ maxWidth: "650px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Panel Evaluation Breakdown</h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  {breakdownModal.candidateName} ({breakdownModal.rollNumber}) — {breakdownModal.panelName}
                </p>
              </div>
              <button onClick={() => setBreakdownModal(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.25rem", cursor: "pointer" }}>✕</button>
            </div>

            {/* Overall Panel Averages Header */}
            {breakdownModal.averageScores && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "1rem", borderRadius: "var(--radius-md)", marginTop: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Overall Panel Metric Averages</span>
                  <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--accent)" }}>
                    Overall: {breakdownModal.overallScore} / 10
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem", fontSize: "0.8125rem" }}>
                  <div>Technical Skill: <strong style={{ color: "var(--text-primary)" }}>{breakdownModal.averageScores.technical}/10</strong></div>
                  <div>Communication: <strong style={{ color: "var(--text-primary)" }}>{breakdownModal.averageScores.communication}/10</strong></div>
                  <div>Problem Solving: <strong style={{ color: "var(--text-primary)" }}>{breakdownModal.averageScores.problemSolving}/10</strong></div>
                  <div>Culture Fit & Confidence: <strong style={{ color: "var(--text-primary)" }}>{breakdownModal.averageScores.cultureFit}/10</strong></div>
                </div>
              </div>
            )}

            {/* Individual Member Evaluations */}
            <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "50vh", overflowY: "auto" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Individual Member Reviews ({Object.keys(breakdownModal.evaluations || {}).length})
              </div>

              {Object.values(breakdownModal.evaluations || {}).length === 0 ? (
                <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", padding: "1rem", background: "var(--bg)", borderRadius: "var(--radius-md)" }}>
                  No member evaluations recorded yet.
                </div>
              ) : (
                Object.values(breakdownModal.evaluations || {}).map((mEval) => {
                  const mScore = mEval.scores
                    ? Math.round(((mEval.scores.technical + mEval.scores.communication + mEval.scores.problemSolving + mEval.scores.cultureFit) / 4) * 10) / 10
                    : null;

                  return (
                    <div key={mEval.memberName} style={{ background: "var(--bg)", border: "1px solid var(--border)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>
                          {mEval.memberName}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {mScore !== null && (
                            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--accent)" }}>
                              Score: {mScore}/10
                            </span>
                          )}
                          <VerdictBadge verdict={mEval.verdict} />
                        </div>
                      </div>

                      {mEval.scores && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.35rem", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                          <div>Tech: {mEval.scores.technical}/10</div>
                          <div>Comm: {mEval.scores.communication}/10</div>
                          <div>Problem Solving: {mEval.scores.problemSolving}/10</div>
                          <div>Culture Fit: {mEval.scores.cultureFit}/10</div>
                        </div>
                      )}

                      <div style={{ fontSize: "0.875rem", color: "var(--text-primary)", whiteSpace: "pre-wrap", marginTop: "0.35rem", background: "var(--surface)", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)" }}>
                        {mEval.notes || "No text notes entered."}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button onClick={() => setBreakdownModal(null)} className="btn btn-primary">Close Breakdown</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

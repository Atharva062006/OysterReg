"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getCandidatesForPanel,
  saveMemberEvaluationInEvent,
  getEventById,
  Registration,
  EvaluationScores,
  Event,
} from "@/lib/firebase";
import styles from "@/app/panel/panel.module.css";

interface EventPanelPageProps {
  params: Promise<{ eventId: string }>;
}

interface PanelSession {
  id: string;
  name: string;
  memberName: string;
  eventId?: string;
}

interface LocalMemberEval {
  verdict: "pass" | "fail" | "pending";
  notes: string;
  scores: EvaluationScores;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
}

const DEFAULT_SCORES: EvaluationScores = {
  technical: 5,
  communication: 5,
  problemSolving: 5,
  cultureFit: 5,
};

export default function EventPanelEvaluationPage({ params }: EventPanelPageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const router = useRouter();
  const [session, setSession] = useState<PanelSession | null>(null);
  const [candidates, setCandidates] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [evaluations, setEvaluations] = useState<Record<string, LocalMemberEval>>({});
  const [expandedRn, setExpandedRn] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = sessionStorage.getItem("oyster_panel");
      if (!raw) {
        router.replace(`/events/${eventId}/panel/login`);
        return;
      }
      try {
        const sess = JSON.parse(raw) as PanelSession;
        // Verify panel session belongs to this event
        if (sess.eventId && sess.eventId !== eventId) {
          router.replace(`/events/${eventId}/panel/login`);
          return;
        }
        setSession(sess);
      } catch {
        router.replace(`/events/${eventId}/panel/login`);
      }
    }
  }, [router, eventId]);

  const loadData = useCallback(
    (panelId: string, memberName: string) => {
      setLoading(true);
      getCandidatesForPanel(panelId, eventId)
        .then((regs) => {
          setCandidates(regs);
          const initial: Record<string, LocalMemberEval> = {};
          regs.forEach((r) => {
            const existingEval = r.interviews?.[panelId]?.evaluations?.[memberName];
            initial[r.rollNumber] = {
              verdict: existingEval?.verdict ?? "pending",
              notes: existingEval?.notes ?? "",
              scores: existingEval?.scores ?? { ...DEFAULT_SCORES },
              dirty: false,
              saving: false,
              saved: false,
            };
          });
          setEvaluations(initial);
        })
        .catch((err) => {
          console.error("Panel load error:", err);
          setError("Failed to load assigned candidates.");
        })
        .finally(() => setLoading(false));

      // Load event details for dynamic panel-visible form fields
      getEventById(eventId)
        .then((ev) => {
          setEvent(ev);
        })
        .catch(console.error);
    },
    [eventId]
  );

  useEffect(() => {
    if (session) {
      loadData(session.id, session.memberName || "Interviewer");
    }
  }, [session, loadData]);

  function handleSignOut() {
    sessionStorage.removeItem("oyster_panel");
    router.push(`/events/${eventId}/panel/login`);
  }

  function updateVerdict(rn: string, verdict: "pass" | "fail" | "pending") {
    setEvaluations((prev) => ({
      ...prev,
      [rn]: { ...prev[rn], verdict, dirty: true, saved: false },
    }));
  }

  function updateScore(rn: string, key: keyof EvaluationScores, val: number) {
    setEvaluations((prev) => ({
      ...prev,
      [rn]: {
        ...prev[rn],
        scores: { ...prev[rn].scores, [key]: val },
        dirty: true,
        saved: false,
      },
    }));
  }

  function updateNotes(rn: string, notes: string) {
    setEvaluations((prev) => ({
      ...prev,
      [rn]: { ...prev[rn], notes, dirty: true, saved: false },
    }));
  }

  async function handleSaveEvaluation(rn: string) {
    if (!session) return;
    const ev = evaluations[rn];
    if (!ev) return;

    setEvaluations((prev) => ({
      ...prev,
      [rn]: { ...prev[rn], saving: true },
    }));

    try {
      const memberName = session.memberName || "Interviewer";
      await saveMemberEvaluationInEvent(eventId, rn, session.id, memberName, {
        verdict: ev.verdict,
        notes: ev.notes,
        scores: ev.scores,
      });

      setEvaluations((prev) => ({
        ...prev,
        [rn]: { ...prev[rn], saving: false, dirty: false, saved: true },
      }));
    } catch (err) {
      console.error(err);
      setError("Failed to save evaluation. Please try again.");
      setEvaluations((prev) => ({
        ...prev,
        [rn]: { ...prev[rn], saving: false },
      }));
    }
  }

  if (loading || !session) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading candidate evaluation roster…</p>
      </div>
    );
  }

  const passCount = Object.values(evaluations).filter((v) => v.verdict === "pass").length;
  const failCount = Object.values(evaluations).filter((v) => v.verdict === "fail").length;

  return (
    <div className={styles.page}>
      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.topBarLeft}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={28} height={28} />
            <div>
              <div className={styles.breadcrumb}>
                {session.name} {event ? `(${event.name})` : ""} — Logged in as{" "}
                <strong style={{ color: "var(--accent)" }}>
                  {session.memberName || "Interviewer"}
                </strong>
              </div>
              <h1 className={styles.pageTitle}>Candidate Evaluations</h1>
            </div>
          </div>
          <button onClick={handleSignOut} className={`btn btn-outline ${styles.signOutBtn}`}>
            Sign out
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Summary Header */}
        <section className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryNum}>{candidates.length}</span>
            <span className={styles.summaryLabel}>Total Candidates</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryNum}>{passCount}</span>
            <span className={styles.summaryLabel}>Pass Votes</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryNum}>{failCount}</span>
            <span className={styles.summaryLabel}>Fail Votes</span>
          </div>
        </section>

        {candidates.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No candidates assigned to {session.name} yet.</p>
            <p className={styles.emptyHint}>
              The admin will assign candidates to this panel on the Interview Management workspace.
            </p>
          </div>
        ) : (
          <div className={styles.candidateList}>
            {candidates.map((r) => {
              const ev = evaluations[r.rollNumber];
              const isExpanded = expandedRn === r.rollNumber;
              const scores = ev?.scores || DEFAULT_SCORES;
              const overallScore =
                Math.round(
                  ((scores.technical + scores.communication + scores.problemSolving + scores.cultureFit) /
                    4) *
                    10
                ) / 10;

              return (
                <div
                  key={r.rollNumber}
                  className={`${styles.candidateCard} ${
                    ev?.verdict === "pass"
                      ? styles.cardPass
                      : ev?.verdict === "fail"
                      ? styles.cardFail
                      : ""
                  }`}
                >
                  {/* Card Header */}
                  <div
                    className={styles.cardHeader}
                    onClick={() => setExpandedRn(isExpanded ? null : r.rollNumber)}
                  >
                    <div className={styles.candidateInfo}>
                      <span className={styles.candidateName}>{r.name}</span>
                      <span className={styles.candidateMeta}>
                        Roll: <code>{r.rollNumber}</code> | Dept: {r.department || "N/A"}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 700,
                          padding: "0.25rem 0.6rem",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--surface)",
                          color: "var(--accent)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        Score: {overallScore} / 10
                      </span>

                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "0.25rem 0.6rem",
                          borderRadius: "999px",
                          background:
                            ev?.verdict === "pass"
                              ? "rgba(34, 197, 94, 0.15)"
                              : ev?.verdict === "fail"
                              ? "rgba(239, 68, 68, 0.15)"
                              : "rgba(148, 163, 184, 0.15)",
                          color:
                            ev?.verdict === "pass"
                              ? "#22c55e"
                              : ev?.verdict === "fail"
                              ? "#ef4444"
                              : "var(--text-muted)",
                        }}
                      >
                        {ev?.verdict?.toUpperCase() || "PENDING"}
                      </span>

                      <span className={styles.expandIcon}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded Evaluation Body */}
                  {isExpanded && (
                    <div
                      className={styles.cardBody}
                      style={{ padding: "1.25rem", borderTop: "1px solid var(--border)" }}
                    >
                      {/* Dynamic Panel Visible Fields */}
                      {event && (
                        <div
                          style={{
                            marginBottom: "1.5rem",
                            padding: "1rem",
                            background: "var(--bg)",
                            borderRadius: "var(--radius-md)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <h4
                            style={{
                              fontSize: "0.8125rem",
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              marginBottom: "0.75rem",
                              borderBottom: "1px solid var(--border)",
                              paddingBottom: "0.5rem",
                            }}
                          >
                            Candidate Information
                          </h4>
                          <div
                            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
                          >
                            {event.formSchema
                              .filter((f) => f.panelVisible)
                              .map((field) => {
                                const val = r.formData
                                  ? r.formData[field.id]
                                  : (r as any)[field.id];
                                if (val === undefined || val === null || val === "") return null;

                                if (
                                  field.type === "file" &&
                                  typeof val === "string" &&
                                  val.includes("http")
                                ) {
                                  return (
                                    <div key={field.id}>
                                      <span
                                        style={{
                                          fontSize: "0.75rem",
                                          fontWeight: 600,
                                          color: "var(--text-muted)",
                                          textTransform: "uppercase",
                                          display: "block",
                                        }}
                                      >
                                        {field.label}
                                      </span>
                                      <a
                                        href={val}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-sm btn-outline"
                                        style={{
                                          marginTop: "0.25rem",
                                          display: "inline-block",
                                          fontSize: "0.75rem",
                                        }}
                                      >
                                        📄 View PDF Document
                                      </a>
                                    </div>
                                  );
                                }

                                return (
                                  <div key={field.id}>
                                    <span
                                      style={{
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        color: "var(--text-muted)",
                                        textTransform: "uppercase",
                                        display: "block",
                                      }}
                                    >
                                      {field.label}
                                    </span>
                                    <span
                                      style={{ fontSize: "0.9375rem", color: "var(--text-primary)" }}
                                    >
                                      {String(val)}
                                    </span>
                                  </div>
                                );
                              })}

                            {/* Fallback for resumeUrl if it wasn't added as a visible field but exists */}
                            {r.resumeUrl &&
                              !event.formSchema.some(
                                (f) => f.panelVisible && f.type === "file"
                              ) && (
                                <div>
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      color: "var(--text-muted)",
                                      textTransform: "uppercase",
                                      display: "block",
                                    }}
                                  >
                                    Resume
                                  </span>
                                  <a
                                    href={r.resumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline"
                                    style={{
                                      marginTop: "0.25rem",
                                      display: "inline-block",
                                      fontSize: "0.75rem",
                                    }}
                                  >
                                    📄 View Resume PDF
                                  </a>
                                </div>
                              )}

                            {event.formSchema.filter((f) => f.panelVisible).length === 0 &&
                              !r.resumeUrl && (
                                <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                                  No additional fields configured for panel view.
                                </span>
                              )}
                          </div>
                        </div>
                      )}

                      {/* 1. Verdict Selector Buttons */}
                      <div style={{ marginBottom: "1.25rem" }}>
                        <label
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                          }}
                        >
                          Interviewer Verdict
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                          <button
                            type="button"
                            onClick={() => updateVerdict(r.rollNumber, "pass")}
                            className={`btn ${
                              ev?.verdict === "pass" ? "btn-primary" : "btn-outline"
                            }`}
                            style={{
                              background: ev?.verdict === "pass" ? "#22c55e" : undefined,
                              borderColor: "#22c55e",
                            }}
                          >
                            PASS
                          </button>
                          <button
                            type="button"
                            onClick={() => updateVerdict(r.rollNumber, "fail")}
                            className={`btn ${
                              ev?.verdict === "fail" ? "btn-primary" : "btn-outline"
                            }`}
                            style={{
                              background: ev?.verdict === "fail" ? "#ef4444" : undefined,
                              borderColor: "#ef4444",
                            }}
                          >
                            FAIL
                          </button>
                          <button
                            type="button"
                            onClick={() => updateVerdict(r.rollNumber, "pending")}
                            className={`btn ${
                              ev?.verdict === "pending" ? "btn-primary" : "btn-outline"
                            }`}
                          >
                            PENDING
                          </button>
                        </div>
                      </div>

                      {/* 2. Metric 0-10 Rating Sliders */}
                      <div
                        style={{
                          background: "var(--bg)",
                          padding: "1rem",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border)",
                          marginBottom: "1.25rem",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            marginBottom: "1rem",
                          }}
                        >
                          Candidate Rating Metrics (0 to 10)
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "1rem",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "var(--text-secondary)",
                                marginBottom: "0.25rem",
                              }}
                            >
                              <span>Technical Skill</span>
                              <span style={{ color: "var(--accent)" }}>{scores.technical}/10</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="1"
                              value={scores.technical}
                              onChange={(e) =>
                                updateScore(r.rollNumber, "technical", parseInt(e.target.value))
                              }
                              style={{ width: "100%", accentColor: "var(--accent)" }}
                            />
                          </div>

                          <div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "var(--text-secondary)",
                                marginBottom: "0.25rem",
                              }}
                            >
                              <span>Communication</span>
                              <span style={{ color: "var(--accent)" }}>
                                {scores.communication}/10
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="1"
                              value={scores.communication}
                              onChange={(e) =>
                                updateScore(r.rollNumber, "communication", parseInt(e.target.value))
                              }
                              style={{ width: "100%", accentColor: "var(--accent)" }}
                            />
                          </div>

                          <div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "var(--text-secondary)",
                                marginBottom: "0.25rem",
                              }}
                            >
                              <span>Problem Solving</span>
                              <span style={{ color: "var(--accent)" }}>
                                {scores.problemSolving}/10
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="1"
                              value={scores.problemSolving}
                              onChange={(e) =>
                                updateScore(r.rollNumber, "problemSolving", parseInt(e.target.value))
                              }
                              style={{ width: "100%", accentColor: "var(--accent)" }}
                            />
                          </div>

                          <div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "var(--text-secondary)",
                                marginBottom: "0.25rem",
                              }}
                            >
                              <span>Culture & Attitude</span>
                              <span style={{ color: "var(--accent)" }}>{scores.cultureFit}/10</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="1"
                              value={scores.cultureFit}
                              onChange={(e) =>
                                updateScore(r.rollNumber, "cultureFit", parseInt(e.target.value))
                              }
                              style={{ width: "100%", accentColor: "var(--accent)" }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 3. Interview Notes */}
                      <div style={{ marginBottom: "1rem" }}>
                        <label
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            display: "block",
                            marginBottom: "0.4rem",
                          }}
                        >
                          Private Notes & Observations
                        </label>
                        <textarea
                          value={ev?.notes || ""}
                          onChange={(e) => updateNotes(r.rollNumber, e.target.value)}
                          placeholder="Candidate's strengths, weaknesses, project discussion details..."
                          rows={3}
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            background: "var(--bg)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            color: "var(--text-primary)",
                            fontSize: "0.875rem",
                            lineHeight: 1.5,
                          }}
                        />
                      </div>

                      {/* Save Button & Status */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          {ev?.saved && !ev?.dirty && (
                            <span
                              style={{ fontSize: "0.8125rem", color: "#22c55e", fontWeight: 600 }}
                            >
                              ✓ Saved by {session.memberName}
                            </span>
                          )}
                          {ev?.dirty && (
                            <span style={{ fontSize: "0.8125rem", color: "var(--accent)" }}>
                              Unsaved changes
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveEvaluation(r.rollNumber)}
                          disabled={ev?.saving}
                          className="btn btn-primary"
                        >
                          {ev?.saving ? "Saving…" : "Save Evaluation"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

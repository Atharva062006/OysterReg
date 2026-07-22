"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getCandidatesForPanel, savePanelVerdict, Registration, PanelVerdict } from "@/lib/firebase";
import styles from "./panel.module.css";

interface PanelSession {
  id: string;
  name: string;
}

interface LocalVerdict {
  verdict: PanelVerdict["verdict"];
  notes: string;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
}

export default function PanelPage() {
  const router = useRouter();
  const [session, setSession] = useState<PanelSession | null>(null);
  const [candidates, setCandidates] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verdicts, setVerdicts] = useState<Record<string, LocalVerdict>>({});
  const [expandedRn, setExpandedRn] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = sessionStorage.getItem("oyster_panel");
      if (!raw) {
        router.replace("/panel/login");
        return;
      }
      try {
        const sess = JSON.parse(raw) as PanelSession;
        setSession(sess);
      } catch {
        router.replace("/panel/login");
      }
    }
  }, [router]);

  const load = useCallback(
    (panelId: string) => {
      setLoading(true);
      getCandidatesForPanel(panelId)
        .then((regs) => {
          setCandidates(regs);
          // Initialize local verdict state from existing Firestore data
          const initial: Record<string, LocalVerdict> = {};
          regs.forEach((r) => {
            const existing = r.interviews?.[panelId];
            initial[r.rollNumber] = {
              verdict: existing?.verdict ?? "pending",
              notes: existing?.notes ?? "",
              dirty: false,
              saving: false,
              saved: false,
            };
          });
          setVerdicts(initial);
        })
        .catch((err) => { console.error("Panel load error:", err); setError("Failed to load candidates."); })
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    if (session) load(session.id);
  }, [session, load]);

  function handleSignOut() {
    sessionStorage.removeItem("oyster_panel");
    router.push("/panel/login");
  }

  function setVerdict(rn: string, verdict: PanelVerdict["verdict"]) {
    setVerdicts((prev) => ({
      ...prev,
      [rn]: { ...prev[rn], verdict, dirty: true, saved: false },
    }));
  }

  function setNotes(rn: string, notes: string) {
    setVerdicts((prev) => ({
      ...prev,
      [rn]: { ...prev[rn], notes, dirty: true, saved: false },
    }));
  }

  async function handleSave(rn: string) {
    if (!session) return;
    const v = verdicts[rn];
    if (!v) return;
    setVerdicts((prev) => ({ ...prev, [rn]: { ...prev[rn], saving: true } }));
    try {
      await savePanelVerdict(rn, session.id, v.verdict, v.notes);
      setVerdicts((prev) => ({
        ...prev,
        [rn]: { ...prev[rn], saving: false, dirty: false, saved: true },
      }));
    } catch {
      setError("Failed to save verdict. Please try again.");
      setVerdicts((prev) => ({ ...prev, [rn]: { ...prev[rn], saving: false } }));
    }
  }

  if (loading || !session) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading candidates…</p>
      </div>
    );
  }

  const passCount = Object.values(verdicts).filter((v) => v.verdict === "pass").length;
  const failCount = Object.values(verdicts).filter((v) => v.verdict === "fail").length;
  const pendingCount = Object.values(verdicts).filter((v) => v.verdict === "pending").length;

  return (
    <div className={styles.page}>
      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.topBarLeft}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={28} height={28} />
            <div>
              <div className={styles.breadcrumb}>Oyster Kode Club — Interviewer View</div>
              <h1 className={styles.pageTitle}>{session.name}</h1>
            </div>
          </div>
          <button onClick={handleSignOut} className={`btn btn-outline ${styles.signOutBtn}`}>
            Sign out
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {error && <div className={styles.errorBanner} role="alert">{error}</div>}

        {/* Summary */}
        <section className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryNum}>{candidates.length}</span>
            <span className={styles.summaryLabel}>Total Assigned</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryNum}>{passCount}</span>
            <span className={styles.summaryLabel}>Pass</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryNum}>{failCount}</span>
            <span className={styles.summaryLabel}>Fail</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryNum}>{pendingCount}</span>
            <span className={styles.summaryLabel}>Pending</span>
          </div>
        </section>

        {candidates.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No candidates assigned yet</p>
            <p className={styles.emptyHint}>
              The admin will assign candidates to your panel on the Interview management page.
            </p>
          </div>
        ) : (
          <div className={styles.candidateList}>
            {candidates.map((r) => {
              const v = verdicts[r.rollNumber];
              const isExpanded = expandedRn === r.rollNumber;
              return (
                <div
                  key={r.rollNumber}
                  className={`${styles.candidateCard} ${
                    v?.verdict === "pass"
                      ? styles.cardPass
                      : v?.verdict === "fail"
                      ? styles.cardFail
                      : ""
                  }`}
                >
                  {/* Card header — always visible */}
                  <div
                    className={styles.cardHeader}
                    onClick={() => setExpandedRn(isExpanded ? null : r.rollNumber)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setExpandedRn(isExpanded ? null : r.rollNumber);
                      }
                    }}
                  >
                    <div className={styles.candidateBasic}>
                      <div>
                        <span className={styles.candidateName}>{r.name}</span>
                        <span className={styles.candidateMeta}>
                          {r.rollNumber} · {r.department} · {r.year} Year
                        </span>
                      </div>
                    </div>
                    <div className={styles.cardHeaderRight}>
                      {v?.verdict === "pass" && <span className={styles.vBadgePass}>✓ Pass</span>}
                      {v?.verdict === "fail" && <span className={styles.vBadgeFail}>✕ Fail</span>}
                      {v?.verdict === "pending" && <span className={styles.vBadgePending}>Pending</span>}
                      <span className={styles.expandIcon}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className={styles.cardBody}>
                      {/* Candidate info */}
                      <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Email</span>
                          <span className={styles.infoValue}>{r.email}</span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Phone</span>
                          <span className={styles.infoValue}>{r.phone}</span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Gender</span>
                          <span className={styles.infoValue}>{r.gender}</span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Coded Before?</span>
                          <span className={styles.infoValue}>{r.hasCodedBefore ? "Yes" : "No"}</span>
                        </div>
                        {r.portfolioUrl && (
                          <div className={styles.infoItem}>
                            <span className={styles.infoLabel}>Portfolio / GitHub</span>
                            <a
                              href={r.portfolioUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.portfolioLink}
                            >
                              {r.portfolioUrl}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Why Join */}
                      <div className={styles.whyJoinBlock}>
                        <span className={styles.whyJoinLabel}>Why do they want to join?</span>
                        <blockquote className={styles.whyJoinText}>{r.whyJoin}</blockquote>
                      </div>

                      {/* Verdict */}
                      <div className={styles.verdictSection}>
                        <span className={styles.verdictLabel}>Your Verdict</span>
                        <div className={styles.verdictOptions}>
                          {(["pass", "fail", "pending"] as PanelVerdict["verdict"][]).map((opt) => (
                            <label
                              key={opt}
                              className={`${styles.verdictOption} ${
                                v?.verdict === opt ? styles[`verdict_${opt}`] : ""
                              }`}
                              htmlFor={`verdict-${r.rollNumber}-${opt}`}
                            >
                              <input
                                type="radio"
                                id={`verdict-${r.rollNumber}-${opt}`}
                                name={`verdict-${r.rollNumber}`}
                                value={opt}
                                checked={v?.verdict === opt}
                                onChange={() => setVerdict(r.rollNumber, opt)}
                                className={styles.verdictRadio}
                              />
                              <span>{opt.charAt(0).toUpperCase() + opt.slice(1)}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      <div className={styles.notesSection}>
                        <label htmlFor={`notes-${r.rollNumber}`} className={styles.notesLabel}>
                          Interview Notes
                        </label>
                        <textarea
                          id={`notes-${r.rollNumber}`}
                          value={v?.notes ?? ""}
                          onChange={(e) => setNotes(r.rollNumber, e.target.value)}
                          placeholder="Add your observations, feedback, or concerns about this candidate…"
                          rows={4}
                          className={styles.notesTextarea}
                        />
                      </div>

                      {/* Save */}
                      <div className={styles.saveRow}>
                        <button
                          id={`save-verdict-${r.rollNumber}`}
                          onClick={() => handleSave(r.rollNumber)}
                          disabled={v?.saving || !v?.dirty}
                          className={`btn btn-primary ${styles.saveBtn}`}
                        >
                          {v?.saving ? "Saving…" : "Save Verdict"}
                        </button>
                        {v?.saved && !v?.dirty && (
                          <span className={styles.savedMsg}>✓ Saved</span>
                        )}
                        {v?.dirty && !v?.saving && (
                          <span className={styles.unsavedMsg}>Unsaved changes</span>
                        )}
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

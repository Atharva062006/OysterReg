"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getAllRegistrations,
  getPanels,
  Registration,
  Panel,
  bulkUpdateStatus,
  updateStatus,
  assignPanel,
} from "@/lib/firebase";
import AdminNav from "@/components/AdminNav";
import styles from "./interview.module.css";
import adminStyles from "../admin.module.css";

function VerdictBadge({ verdict }: { verdict?: string }) {
  if (!verdict || verdict === "pending") {
    return <span className={`${styles.vBadge} ${styles.vPending}`}>Pending</span>;
  }
  if (verdict === "pass") {
    return <span className={`${styles.vBadge} ${styles.vPass}`}>Pass</span>;
  }
  return <span className={`${styles.vBadge} ${styles.vFail}`}>Fail</span>;
}

export default function InterviewPage() {
  const router = useRouter();
  const [all, setAll] = useState<Registration[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showRejected, setShowRejected] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [assigningPanel, setAssigningPanel] = useState<string | null>(null);
  const [notesModal, setNotesModal] = useState<{
    name: string;
    rollNumber: string;
    panelName: string;
    notes: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("oyster_admin")) {
      router.replace("/admin/login");
    }
  }, [router]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getAllRegistrations(), getPanels()])
      .then(([regs, pnls]) => {
        setAll(regs);
        setPanels(pnls);
      })
      .catch((err) => { console.error("Interview load error:", err); setError("Failed to load data."); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSignOut() {
    sessionStorage.removeItem("oyster_admin");
    router.push("/admin/login");
  }

  const visible = all.filter((r) => {
    const s = r.status ?? "registered";
    if (!showRejected && s === "rejected") return false;
    if (!["aptitude_shortlisted", "interview_shortlisted", "rejected"].includes(s)) return false;
    const q = search.toLowerCase();
    if (q && !r.name.toLowerCase().includes(q) && !r.rollNumber.toLowerCase().includes(q)) return false;
    return true;
  });

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.rollNumber));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visible.map((r) => r.rollNumber)));
  }

  function toggleOne(rn: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(rn) ? next.delete(rn) : next.add(rn);
      return next;
    });
  }

  async function bulkAction(status: "aptitude_shortlisted" | "interview_shortlisted" | "rejected") {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await bulkUpdateStatus(Array.from(selected), status);
      setAll((prev) =>
        prev.map((r) => (selected.has(r.rollNumber) ? { ...r, status } : r))
      );
      setSelected(new Set());
    } catch {
      setError("Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function singleAction(rn: string, status: "aptitude_shortlisted" | "interview_shortlisted" | "rejected") {
    setBusy(true);
    try {
      await updateStatus(rn, status);
      setAll((prev) =>
        prev.map((r) => (r.rollNumber === rn ? { ...r, status } : r))
      );
    } catch {
      setError("Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignPanel(rollNumber: string, panelId: string) {
    setAssigningPanel(rollNumber);
    try {
      await assignPanel(rollNumber, panelId);
      setAll((prev) =>
        prev.map((r) => (r.rollNumber === rollNumber ? { ...r, panelId } : r))
      );
    } catch {
      setError("Failed to assign panel.");
    } finally {
      setAssigningPanel(null);
    }
  }

  if (loading) {
    return (
      <div className={adminStyles.loadingState}>
        <div className={adminStyles.spinner} />
        <p>Loading…</p>
      </div>
    );
  }

  const aptitudeCount = all.filter((r) => (r.status ?? "registered") === "aptitude_shortlisted").length;
  const interviewCount = all.filter((r) => (r.status ?? "registered") === "interview_shortlisted").length;

  return (
    <div className={adminStyles.page}>
      <header className={adminStyles.topBar}>
        <div className={adminStyles.topBarInner}>
          <div className={adminStyles.topBarLeft}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={32} height={32} />
            <div>
              <div className={adminStyles.breadcrumb}>Oyster Kode Club</div>
              <h1 className={adminStyles.pageTitle}>Interview Round</h1>
            </div>
          </div>
          <button onClick={handleSignOut} className={`btn btn-outline ${adminStyles.signOutBtn}`}>
            Sign out
          </button>
        </div>
      </header>

      <AdminNav />

      <main className={adminStyles.main}>
        {error && <div className={adminStyles.errorBanner} role="alert">{error}</div>}

        <section className={adminStyles.section}>
          <h2 className={adminStyles.sectionTitle}>Interview Overview</h2>
          <div className={styles.statRow}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{aptitudeCount}</span>
              <span className={styles.statLabel}>Aptitude Shortlisted</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{interviewCount}</span>
              <span className={styles.statLabel}>Interview Shortlisted</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{selected.size}</span>
              <span className={styles.statLabel}>Selected in table</span>
            </div>
          </div>
        </section>

        <section className={adminStyles.section}>
          <div className={styles.controls}>
            <input
              type="search"
              placeholder="Search by name or roll number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
              id="interview-search"
            />
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={showRejected}
                onChange={(e) => setShowRejected(e.target.checked)}
                id="show-rejected-interview"
              />
              Show rejected
            </label>
          </div>

          {selected.size > 0 && (
            <div className={styles.bulkBar}>
              <span className={styles.bulkCount}>{selected.size} selected</span>
              <button
                id="bulk-interview-shortlist-btn"
                disabled={busy}
                onClick={() => bulkAction("interview_shortlisted")}
                className={`btn btn-primary ${styles.bulkBtn}`}
              >
                {busy ? "Saving…" : "Shortlist for Final"}
              </button>
              <button
                id="bulk-interview-reject-btn"
                disabled={busy}
                onClick={() => bulkAction("rejected")}
                className={`btn btn-outline ${styles.rejectBtn}`}
              >
                Reject Selected
              </button>
              <button
                id="bulk-reset-btn"
                disabled={busy}
                onClick={() => bulkAction("aptitude_shortlisted")}
                className={`btn btn-outline ${styles.clearBtn}`}
              >
                Reset Selected
              </button>
              <button onClick={() => setSelected(new Set())} className={`btn btn-outline ${styles.clearBtn}`}>
                Clear
              </button>
            </div>
          )}
        </section>

        <section className={adminStyles.section}>
          <p className={styles.resultCount}>{visible.length} candidate{visible.length !== 1 ? "s" : ""}</p>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" id="interview-select-all" />
                  </th>
                  <th>Name</th>
                  <th>Roll No.</th>
                  <th>Dept</th>
                  <th>Year</th>
                  <th>Panel Assigned</th>
                  <th>Panel Verdicts</th>
                  <th>Interview Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={9} className={styles.empty}>
                      No candidates in this stage. Shortlist from the Aptitude round first.
                    </td>
                  </tr>
                ) : (
                  visible.map((r) => {
                    const status = r.status ?? "registered";
                    const verdicts = r.interviews ?? {};
                    const pid = r.panelId;
                    return (
                      <tr
                        key={r.rollNumber}
                        className={
                          status === "interview_shortlisted"
                            ? styles.rowShortlisted
                            : status === "rejected"
                            ? styles.rowRejected
                            : ""
                        }
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(r.rollNumber)}
                            onChange={() => toggleOne(r.rollNumber)}
                            aria-label={`Select ${r.name}`}
                            id={`ichk-${r.rollNumber}`}
                          />
                        </td>
                        <td>
                          <span className={styles.name}>{r.name}</span>
                          <span className={styles.email}>{r.email}</span>
                        </td>
                        <td className={styles.mono}>{r.rollNumber}</td>
                        <td><span className={styles.deptBadge}>{r.department}</span></td>
                        <td>{r.year}</td>
                        <td>
                          <select
                            value={pid ?? ""}
                            onChange={(e) => handleAssignPanel(r.rollNumber, e.target.value)}
                            disabled={assigningPanel === r.rollNumber}
                            className={styles.panelSelect}
                            id={`panel-assign-${r.rollNumber}`}
                          >
                            <option value="">— Assign Panel —</option>
                            {panels.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className={styles.verdictList}>
                            {!pid ? (
                              <span className={styles.noVerdict}>Unassigned</span>
                            ) : (
                              <div className={styles.verdictItem}>
                                <span className={styles.panelName}>
                                  {panels.find((p) => p.id === pid)?.name ?? "Unknown Panel"}
                                </span>
                                <VerdictBadge verdict={verdicts[pid]?.verdict} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          {pid ? (
                            <button
                              onClick={() => {
                                const panel = panels.find((p) => p.id === pid);
                                const notes = verdicts[pid]?.notes || "No notes submitted by the panel yet.";
                                setNotesModal({
                                  name: r.name,
                                  rollNumber: r.rollNumber,
                                  panelName: panel?.name || "Assigned Panel",
                                  notes,
                                });
                              }}
                              className={styles.viewNotesBtn}
                              id={`view-notes-${r.rollNumber}`}
                            >
                              📝 View
                            </button>
                          ) : (
                            <span className={styles.noVerdict}>—</span>
                          )}
                        </td>
                        <td className={styles.actionsCell}>
                          <div className={styles.actionsBtns}>
                            {status === "interview_shortlisted" ? (
                              <button
                                id={`reset-${r.rollNumber}`}
                                disabled={busy}
                                onClick={() => singleAction(r.rollNumber, "aptitude_shortlisted")}
                                className={styles.resetRowBtn}
                              >
                                Undo Shortlist
                              </button>
                            ) : (
                              <button
                                id={`ishortlist-${r.rollNumber}`}
                                disabled={busy}
                                onClick={() => singleAction(r.rollNumber, "interview_shortlisted")}
                                className={styles.shortlistBtn}
                              >
                                Shortlist
                              </button>
                            )}

                            {status === "rejected" ? (
                              <button
                                id={`ireject-reset-${r.rollNumber}`}
                                disabled={busy}
                                onClick={() => singleAction(r.rollNumber, "aptitude_shortlisted")}
                                className={styles.resetRowBtn}
                              >
                                Undo Reject
                              </button>
                            ) : (
                              <button
                                id={`ireject-${r.rollNumber}`}
                                disabled={busy}
                                onClick={() => singleAction(r.rollNumber, "rejected")}
                                className={styles.rejectRowBtn}
                              >
                                Reject
                              </button>
                            )}
                          </div>
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

      {/* Notes Modal */}
      {notesModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="View interview notes">
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Interview Notes</h2>
            <p className={styles.modalSub}>
              {notesModal.name} ({notesModal.rollNumber}) · {notesModal.panelName}
            </p>
            <div className={styles.notesContent}>
              {notesModal.notes}
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={() => setNotesModal(null)}
                className="btn btn-primary"
                id="close-notes-btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

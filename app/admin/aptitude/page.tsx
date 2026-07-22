"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getAllRegistrations,
  Registration,
  bulkUpdateStatus,
  updateStatus,
} from "@/lib/firebase";
import AdminNav from "@/components/AdminNav";
import styles from "./aptitude.module.css";
import adminStyles from "../admin.module.css";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    registered: styles.badgeDefault,
    aptitude_shortlisted: styles.badgeBlue,
    interview_shortlisted: styles.badgeAmber,
    selected: styles.badgeGreen,
    rejected: styles.badgeRed,
  };
  const labels: Record<string, string> = {
    registered: "Registered",
    aptitude_shortlisted: "Shortlisted",
    interview_shortlisted: "Interview",
    selected: "Selected",
    rejected: "Rejected",
  };
  return (
    <span className={`${styles.badge} ${map[status] ?? styles.badgeDefault}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function AptitudePage() {
  const router = useRouter();
  const [all, setAll] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showRejected, setShowRejected] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("oyster_admin")) {
      router.replace("/admin/login");
    }
  }, [router]);

  const load = useCallback(() => {
    setLoading(true);
    getAllRegistrations()
      .then(setAll)
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSignOut() {
    sessionStorage.removeItem("oyster_admin");
    router.push("/admin/login");
  }

  // Filter to only registered + previously shortlisted (for visibility)
  const visible = all.filter((r) => {
    const s = r.status ?? "registered";
    if (!showRejected && s === "rejected") return false;
    // Aptitude view shows: registered + aptitude_shortlisted + rejected
    if (!["registered", "aptitude_shortlisted", "rejected"].includes(s)) return false;
    const q = search.toLowerCase();
    if (q && !r.name.toLowerCase().includes(q) && !r.rollNumber.toLowerCase().includes(q)) return false;
    return true;
  });

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.rollNumber));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((r) => r.rollNumber)));
    }
  }

  function toggleOne(rn: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(rn) ? next.delete(rn) : next.add(rn);
      return next;
    });
  }

  async function bulkAction(status: "registered" | "aptitude_shortlisted" | "rejected") {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await bulkUpdateStatus(Array.from(selected), status);
      setAll((prev) =>
        prev.map((r) => (selected.has(r.rollNumber) ? { ...r, status } : r))
      );
      setSelected(new Set());
    } catch {
      setError("Action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function singleAction(rn: string, status: "registered" | "aptitude_shortlisted" | "rejected") {
    setBusy(true);
    try {
      await updateStatus(rn, status);
      setAll((prev) =>
        prev.map((r) => (r.rollNumber === rn ? { ...r, status } : r))
      );
    } catch {
      setError("Action failed. Please try again.");
    } finally {
      setBusy(false);
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

  const shortlistedCount = all.filter((r) => (r.status ?? "registered") === "aptitude_shortlisted").length;
  const registeredCount = all.filter((r) => (r.status ?? "registered") === "registered").length;

  return (
    <div className={adminStyles.page}>
      {/* Top Bar */}
      <header className={adminStyles.topBar}>
        <div className={adminStyles.topBarInner}>
          <div className={adminStyles.topBarLeft}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={32} height={32} />
            <div>
              <div className={adminStyles.breadcrumb}>Oyster Kode Club</div>
              <h1 className={adminStyles.pageTitle}>Aptitude Round</h1>
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

        {/* Stats */}
        <section className={adminStyles.section}>
          <h2 className={adminStyles.sectionTitle}>Aptitude Overview</h2>
          <div className={styles.statRow}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{registeredCount}</span>
              <span className={styles.statLabel}>Awaiting Review</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{shortlistedCount}</span>
              <span className={styles.statLabel}>Shortlisted</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{selected.size}</span>
              <span className={styles.statLabel}>Selected in table</span>
            </div>
          </div>
        </section>

        {/* Controls */}
        <section className={adminStyles.section}>
          <div className={styles.controls}>
            <input
              type="search"
              placeholder="Search by name or roll number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
              id="aptitude-search"
            />
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={showRejected}
                onChange={(e) => setShowRejected(e.target.checked)}
                id="show-rejected"
              />
              Show rejected
            </label>
          </div>

          {selected.size > 0 && (
            <div className={styles.bulkBar}>
              <span className={styles.bulkCount}>{selected.size} selected</span>
              <button
                id="bulk-shortlist-btn"
                disabled={busy}
                onClick={() => bulkAction("aptitude_shortlisted")}
                className={`btn btn-primary ${styles.bulkBtn}`}
              >
                {busy ? "Saving…" : "Shortlist Selected"}
              </button>
              <button
                id="bulk-reject-btn"
                disabled={busy}
                onClick={() => bulkAction("rejected")}
                className={`btn btn-outline ${styles.rejectBtn}`}
              >
                Reject Selected
              </button>
              <button
                id="bulk-reset-btn"
                disabled={busy}
                onClick={() => bulkAction("registered")}
                className={`btn btn-outline ${styles.clearBtn}`}
              >
                Reset Selected
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className={`btn btn-outline ${styles.clearBtn}`}
              >
                Clear
              </button>
            </div>
          )}
        </section>

        {/* Table */}
        <section className={adminStyles.section}>
          <p className={styles.resultCount}>{visible.length} candidate{visible.length !== 1 ? "s" : ""}</p>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Select all"
                      id="select-all"
                    />
                  </th>
                  <th>Name</th>
                  <th>Roll No.</th>
                  <th>Dept</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.empty}>No candidates found.</td>
                  </tr>
                ) : (
                  visible.map((r) => {
                    const status = r.status ?? "registered";
                    return (
                      <tr
                        key={r.rollNumber}
                        className={
                          status === "aptitude_shortlisted"
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
                            id={`chk-${r.rollNumber}`}
                          />
                        </td>
                        <td>
                          <span className={styles.name}>{r.name}</span>
                          <span className={styles.email}>{r.email}</span>
                        </td>
                        <td className={styles.mono}>{r.rollNumber}</td>
                        <td><span className={styles.deptBadge}>{r.department}</span></td>
                        <td>{r.year}</td>
                        <td><StatusBadge status={status} /></td>
                        <td className={styles.actions}>
                          <div className={styles.actionsBtns}>
                            {status === "aptitude_shortlisted" ? (
                              <button
                                id={`reset-${r.rollNumber}`}
                                disabled={busy}
                                onClick={() => singleAction(r.rollNumber, "registered")}
                                className={styles.resetRowBtn}
                              >
                                Undo Shortlist
                              </button>
                            ) : (
                              <button
                                id={`shortlist-${r.rollNumber}`}
                                disabled={busy}
                                onClick={() => singleAction(r.rollNumber, "aptitude_shortlisted")}
                                className={styles.shortlistBtn}
                              >
                                Shortlist
                              </button>
                            )}

                            {status === "rejected" ? (
                              <button
                                id={`reset-reject-${r.rollNumber}`}
                                disabled={busy}
                                onClick={() => singleAction(r.rollNumber, "registered")}
                                className={styles.resetRowBtn}
                              >
                                Undo Reject
                              </button>
                            ) : (
                              <button
                                id={`reject-${r.rollNumber}`}
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
    </div>
  );
}

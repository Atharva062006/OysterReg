"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getAllRegistrations,
  Registration,
  updateStatus,
  bulkUpdateStatus,
} from "@/lib/firebase";
import AdminNav from "@/components/AdminNav";
import styles from "./selected.module.css";
import adminStyles from "../admin.module.css";

export default function SelectedPage() {
  const router = useRouter();
  const [all, setAll] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
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

  // Show interview_shortlisted (pending final decision) + selected
  const candidates = all.filter((r) => {
    const s = r.status ?? "registered";
    if (!["interview_shortlisted", "selected"].includes(s)) return false;
    const q = search.toLowerCase();
    if (q && !r.name.toLowerCase().includes(q) && !r.rollNumber.toLowerCase().includes(q)) return false;
    return true;
  });

  const finalSelected = all.filter((r) => r.status === "selected");
  const pending = all.filter((r) => r.status === "interview_shortlisted");

  const allChosen =
    candidates.length > 0 && candidates.every((r) => selectedSet.has(r.rollNumber));

  function toggleAll() {
    if (allChosen) setSelectedSet(new Set());
    else setSelectedSet(new Set(candidates.map((r) => r.rollNumber)));
  }

  function toggleOne(rn: string) {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      next.has(rn) ? next.delete(rn) : next.add(rn);
      return next;
    });
  }

  async function bulkAction(status: "interview_shortlisted" | "selected" | "rejected") {
    if (selectedSet.size === 0) return;
    setBusy(true);
    try {
      await bulkUpdateStatus(Array.from(selectedSet), status);
      setAll((prev) =>
        prev.map((r) => (selectedSet.has(r.rollNumber) ? { ...r, status } : r))
      );
      setSelectedSet(new Set());
    } catch {
      setError("Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function singleAction(rn: string, status: "interview_shortlisted" | "selected" | "rejected") {
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

  function exportCSV() {
    const headers = ["Name", "Roll Number", "Email", "Phone", "Department", "Year", "Gender", "Portfolio"];
    const rows = finalSelected.map((r) => [
      r.name, r.rollNumber, r.email, r.phone,
      r.department, r.year, r.gender, r.portfolioUrl || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "selected_candidates.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className={adminStyles.loadingState}>
        <div className={adminStyles.spinner} />
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className={adminStyles.page}>
      <header className={adminStyles.topBar}>
        <div className={adminStyles.topBarInner}>
          <div className={adminStyles.topBarLeft}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={32} height={32} />
            <div>
              <div className={adminStyles.breadcrumb}>Oyster Kode Club</div>
              <h1 className={adminStyles.pageTitle}>Final Selection</h1>
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
          <h2 className={adminStyles.sectionTitle}>Final Round</h2>
          <div className={styles.statRow}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{pending.length}</span>
              <span className={styles.statLabel}>Awaiting Decision</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNum}>{finalSelected.length}</span>
              <span className={styles.statLabel}>Selected ✓</span>
            </div>
          </div>
        </section>

        {/* Controls */}
        <section className={adminStyles.section}>
          <div className={styles.controls}>
            <input
              type="search"
              placeholder="Search candidates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
              id="selected-search"
            />
            <button
              id="export-selected-csv-btn"
              onClick={exportCSV}
              disabled={finalSelected.length === 0}
              className={`btn btn-outline ${styles.exportBtn}`}
            >
              Export Selected ({finalSelected.length})
            </button>
          </div>

          {selectedSet.size > 0 && (
            <div className={styles.bulkBar}>
              <span className={styles.bulkCount}>{selectedSet.size} selected</span>
              <button
                id="bulk-select-btn"
                disabled={busy}
                onClick={() => bulkAction("selected")}
                className={`btn btn-primary ${styles.bulkBtn}`}
              >
                {busy ? "Saving…" : "✓ Mark as Selected"}
              </button>
              <button
                id="bulk-final-reject-btn"
                disabled={busy}
                onClick={() => bulkAction("rejected")}
                className={`btn btn-outline ${styles.rejectBtn}`}
              >
                Reject Selected
              </button>
              <button
                id="bulk-reset-btn"
                disabled={busy}
                onClick={() => bulkAction("interview_shortlisted")}
                className={`btn btn-outline ${styles.clearBtn}`}
              >
                Reset Selected
              </button>
              <button onClick={() => setSelectedSet(new Set())} className={`btn btn-outline ${styles.clearBtn}`}>
                Clear
              </button>
            </div>
          )}
        </section>

        {/* Table */}
        <section className={adminStyles.section}>
          <p className={styles.resultCount}>{candidates.length} candidate{candidates.length !== 1 ? "s" : ""}</p>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allChosen} onChange={toggleAll} aria-label="Select all" id="final-select-all" />
                  </th>
                  <th>Name</th>
                  <th>Roll No.</th>
                  <th>Dept</th>
                  <th>Year</th>
                  <th>Gender</th>
                  <th>Portfolio</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={9} className={styles.empty}>
                      No candidates here yet. Shortlist from the Interview round first.
                    </td>
                  </tr>
                ) : (
                  candidates.map((r) => {
                    const isSelected = r.status === "selected";
                    const status = r.status ?? "interview_shortlisted";
                    return (
                      <tr
                        key={r.rollNumber}
                        className={isSelected ? styles.rowSelected : ""}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedSet.has(r.rollNumber)}
                            onChange={() => toggleOne(r.rollNumber)}
                            aria-label={`Select ${r.name}`}
                            id={`fchk-${r.rollNumber}`}
                          />
                        </td>
                        <td>
                          <span className={styles.name}>{r.name}</span>
                          <span className={styles.email}>{r.email}</span>
                        </td>
                        <td className={styles.mono}>{r.rollNumber}</td>
                        <td><span className={styles.deptBadge}>{r.department}</span></td>
                        <td>{r.year}</td>
                        <td>{r.gender}</td>
                        <td>
                          {r.portfolioUrl ? (
                            <a
                              href={r.portfolioUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.portfolioLink}
                            >
                              View →
                            </a>
                          ) : (
                            <span className={styles.noLink}>—</span>
                          )}
                        </td>
                        <td>
                          {isSelected ? (
                            <span className={styles.selectedBadge}>✓ Selected</span>
                          ) : status === "rejected" ? (
                            <span className={styles.pendingBadge} style={{ color: "var(--danger)", borderColor: "rgba(248, 113, 113, 0.25)" }}>Rejected</span>
                          ) : (
                            <span className={styles.pendingBadge}>Pending</span>
                          )}
                        </td>
                        <td className={styles.actionsCell}>
                          <div className={styles.actionsBtns}>
                            {status === "selected" ? (
                              <button
                                id={`final-select-reset-${r.rollNumber}`}
                                disabled={busy}
                                onClick={() => singleAction(r.rollNumber, "interview_shortlisted")}
                                className={styles.resetRowBtn}
                              >
                                Undo Select
                              </button>
                            ) : (
                              <button
                                id={`final-select-${r.rollNumber}`}
                                disabled={busy}
                                onClick={() => singleAction(r.rollNumber, "selected")}
                                className={styles.selectBtn}
                              >
                                Select ✓
                              </button>
                            )}

                            {status === "rejected" ? (
                              <button
                                id={`final-reject-reset-${r.rollNumber}`}
                                disabled={busy}
                                onClick={() => singleAction(r.rollNumber, "interview_shortlisted")}
                                className={styles.resetRowBtn}
                              >
                                Undo Reject
                              </button>
                            ) : (
                              <button
                                id={`final-reject-${r.rollNumber}`}
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

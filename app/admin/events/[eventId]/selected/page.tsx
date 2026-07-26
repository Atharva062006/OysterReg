"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getEventById,
  getEventRegistrations,
  updateCandidateStatusInEvent,
  Event,
  Registration,
} from "@/lib/firebase";
import EventAdminNav from "@/components/EventAdminNav";
import styles from "@/app/admin/admin.module.css";
import tableStyles from "@/components/RegistrationTable.module.css";

interface PageProps {
  params: Promise<{ eventId: string }>;
}

export default function SelectedCandidatesPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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
      setError("Failed to load selected candidates.");
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

  async function handleRemoveSelected(rollNumber: string) {
    if (!window.confirm("Remove candidate from final selected list?")) return;
    try {
      await updateCandidateStatusInEvent(eventId, rollNumber, "interview_shortlisted");
      setRegistrations((prev) =>
        prev.map((r) => (r.rollNumber === rollNumber ? { ...r, status: "interview_shortlisted" } : r))
      );
    } catch {
      alert("Failed to update candidate.");
    }
  }

  const selectedCandidates = registrations.filter((r) => {
    if (r.status !== "selected") return false;
    const q = search.toLowerCase().trim();
    if (q && !r.name.toLowerCase().includes(q) && !r.rollNumber.toLowerCase().includes(q) && !r.department?.toLowerCase().includes(q)) return false;
    return true;
  });

  // Department distribution
  const deptCounts: Record<string, number> = {};
  selectedCandidates.forEach((c) => {
    const dept = c.department || "Other";
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
  });

  function exportCSV() {
    if (selectedCandidates.length === 0) return;
    const headers = ["Roll Number", "Name", "Department", "Year", "Email", "Phone", "Status"];
    const rows = selectedCandidates.map((c) => [
      `"${c.rollNumber}"`,
      `"${c.name}"`,
      `"${c.department || ""}"`,
      `"${c.year || ""}"`,
      `"${c.email}"`,
      `"${c.phone || ""}"`,
      `"${c.status}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${event?.name || "Event"}_Selected_Candidates.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading selected candidates…</p>
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
              <h1 className={styles.pageTitle}>Selected Candidates</h1>
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

        {/* Stats & Export */}
        <section className={styles.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2 className={styles.sectionTitle}>Final Selection Summary ({selectedCandidates.length})</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                Candidates officially accepted into <strong>{event.name}</strong>.
              </p>
            </div>
            <button
              onClick={exportCSV}
              disabled={selectedCandidates.length === 0}
              className="btn btn-primary"
            >
              Export Selected CSV
            </button>
          </div>
        </section>

        {/* Table */}
        <section className={styles.section}>
          <div className={tableStyles.controlsRow}>
            <input
              type="text"
              placeholder="Search selected by name, roll number, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={tableStyles.searchInput}
            />
          </div>

          <div className={tableStyles.tableWrapper} style={{ marginTop: "1rem" }}>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Roll Number</th>
                  <th>Department & Year</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {selectedCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={tableStyles.emptyState}>
                      No candidates marked as Selected yet.
                    </td>
                  </tr>
                ) : (
                  selectedCandidates.map((reg) => (
                    <tr key={reg.rollNumber}>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{reg.name}</div>
                      </td>
                      <td><code>{reg.rollNumber}</code></td>
                      <td>{reg.department || "—"} {reg.year ? `(${reg.year})` : ""}</td>
                      <td>{reg.email}</td>
                      <td>{reg.phone || "—"}</td>
                      <td>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.25rem 0.5rem",
                            borderRadius: "999px",
                            background: "rgba(34, 197, 94, 0.15)",
                            color: "#22c55e",
                            border: "1px solid rgba(34, 197, 94, 0.3)",
                          }}
                        >
                          SELECTED
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleRemoveSelected(reg.rollNumber)}
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: "0.75rem" }}
                        >
                          Reset
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

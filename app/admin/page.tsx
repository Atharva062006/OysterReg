"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllRegistrations, Registration } from "@/lib/firebase";
import StatCard from "@/components/StatCard";
import RegistrationTable from "@/components/RegistrationTable";
import styles from "./admin.module.css";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Auth gate — check sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("oyster_admin");
      if (!auth) {
        router.replace("/admin/login");
      }
    }
  }, [router]);

  useEffect(() => {
    getAllRegistrations()
      .then(setRegistrations)
      .catch((err) => {
        console.error(err);
        setError("Failed to load registrations. Check your Firebase config.");
      })
      .finally(() => setLoading(false));
  }, []);

  function handleSignOut() {
    sessionStorage.removeItem("oyster_admin");
    router.push("/admin/login");
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  const total = registrations.length;
  const presentCount = registrations.filter((r) => r.present).length;
  const male = registrations.filter((r) => r.gender === "Male").length;
  const female = registrations.filter((r) => r.gender === "Female").length;
  const other = total - male - female;

  // Department breakdown — top 3 + rest
  const deptMap: Record<string, number> = {};
  registrations.forEach((r) => {
    deptMap[r.department] = (deptMap[r.department] || 0) + 1;
  });
  const deptEntries = Object.entries(deptMap).sort((a, b) => b[1] - a[1]);

  // Year breakdown
  const yearMap: Record<string, number> = {};
  registrations.forEach((r) => {
    yearMap[r.year] = (yearMap[r.year] || 0) + 1;
  });
  const yearOrder = ["1st", "2nd", "3rd", "4th"];
  const yearEntries = yearOrder
    .filter((y) => yearMap[y])
    .map((y) => [y, yearMap[y]] as [string, number]);

  const hasCodedCount = registrations.filter((r) => r.hasCodedBefore).length;

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading registrations…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Top Bar ── */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div>
            <div className={styles.breadcrumb}>Oyster Coding Club</div>
            <h1 className={styles.pageTitle}>Admin Dashboard</h1>
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
        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {/* ── Stats Grid ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Overview</h2>
          <div className={styles.statsGrid}>
            <StatCard
              label="Total Registrations"
              value={total}
            />
            <StatCard
              label="Attendance Marked"
              value={presentCount}
              sub={total > 0 ? `${Math.round((presentCount / total) * 100)}% of total` : "—"}
            />
            <StatCard
              label="Coded Before"
              value={hasCodedCount}
              sub={total > 0 ? `${Math.round((hasCodedCount / total) * 100)}% of total` : "—"}
            />
          </div>
        </section>

        {/* ── Gender + Year breakdown ── */}
        <section className={styles.section}>
          <div className={styles.breakdownGrid}>
            {/* Gender */}
            <div className={styles.breakdownCard}>
              <h2 className={styles.cardTitle}>Gender</h2>
              <ul className={styles.breakdownList}>
                <li>
                  <span className={styles.breakdownLabel}>Male</span>
                  <span className={styles.breakdownBar}>
                    <span
                      className={styles.barFill}
                      style={{ width: total ? `${(male / total) * 100}%` : "0%" }}
                    />
                  </span>
                  <span className={styles.breakdownCount}>{male}</span>
                </li>
                <li>
                  <span className={styles.breakdownLabel}>Female</span>
                  <span className={styles.breakdownBar}>
                    <span
                      className={styles.barFill}
                      style={{ width: total ? `${(female / total) * 100}%` : "0%" }}
                    />
                  </span>
                  <span className={styles.breakdownCount}>{female}</span>
                </li>
                {other > 0 && (
                  <li>
                    <span className={styles.breakdownLabel}>Other</span>
                    <span className={styles.breakdownBar}>
                      <span
                        className={styles.barFill}
                        style={{ width: total ? `${(other / total) * 100}%` : "0%" }}
                      />
                    </span>
                    <span className={styles.breakdownCount}>{other}</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Year */}
            <div className={styles.breakdownCard}>
              <h2 className={styles.cardTitle}>Year of Study</h2>
              <ul className={styles.breakdownList}>
                {yearEntries.length === 0 ? (
                  <li className={styles.emptyNote}>No data yet</li>
                ) : (
                  yearEntries.map(([year, count]) => (
                    <li key={year}>
                      <span className={styles.breakdownLabel}>{year} Year</span>
                      <span className={styles.breakdownBar}>
                        <span
                          className={styles.barFill}
                          style={{ width: total ? `${(count / total) * 100}%` : "0%" }}
                        />
                      </span>
                      <span className={styles.breakdownCount}>{count}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Department */}
            <div className={styles.breakdownCard}>
              <h2 className={styles.cardTitle}>Department</h2>
              <ul className={styles.breakdownList}>
                {deptEntries.length === 0 ? (
                  <li className={styles.emptyNote}>No data yet</li>
                ) : (
                  deptEntries.map(([dept, count]) => (
                    <li key={dept}>
                      <span className={styles.breakdownLabel}>{dept}</span>
                      <span className={styles.breakdownBar}>
                        <span
                          className={styles.barFill}
                          style={{ width: total ? `${(count / total) * 100}%` : "0%" }}
                        />
                      </span>
                      <span className={styles.breakdownCount}>{count}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Registrations Table ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Registrations</h2>
          <RegistrationTable initialData={registrations} />
        </section>
      </main>
    </div>
  );
}

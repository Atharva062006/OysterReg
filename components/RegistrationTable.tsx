"use client";

import { useState } from "react";
import { Registration, togglePresent } from "@/lib/firebase";
import styles from "./RegistrationTable.module.css";

interface Props {
  initialData: Registration[];
}

type SortKey = "name" | "department" | "year" | "submittedAt";
type SortDir = "asc" | "desc";

export default function RegistrationTable({ initialData }: Props) {
  const [data, setData] = useState<Registration[]>(initialData);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterPresent, setFilterPresent] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [toggling, setToggling] = useState<string | null>(null);

  const departments = Array.from(new Set(initialData.map((r) => r.department))).sort();
  const years = ["1st", "2nd", "3rd", "4th"];

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function handleToggle(rollNumber: string, currentState: boolean) {
    setToggling(rollNumber);
    try {
      await togglePresent(rollNumber, !currentState);
      setData((prev) =>
        prev.map((r) =>
          r.rollNumber === rollNumber ? { ...r, present: !currentState } : r
        )
      );
    } catch (err) {
      console.error("Failed to toggle presence:", err);
    } finally {
      setToggling(null);
    }
  }

  function exportCSV() {
    const headers = [
      "Name", "Roll Number", "Email", "Phone", "Department",
      "Year", "Gender", "Coded Before", "Portfolio", "Submitted At", "Present",
    ];
    const rows = filtered.map((r) => [
      r.name,
      r.rollNumber,
      r.email,
      r.phone,
      r.department,
      r.year,
      r.gender,
      r.hasCodedBefore ? "Yes" : "No",
      r.portfolioUrl || "",
      r.submittedAt.toDate().toLocaleString(),
      r.present ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "registrations.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = data
    .filter((r) => {
      const q = search.toLowerCase();
      if (q && !r.name.toLowerCase().includes(q) && !r.rollNumber.toLowerCase().includes(q)) return false;
      if (filterDept && r.department !== filterDept) return false;
      if (filterYear && r.year !== filterYear) return false;
      if (filterGender && r.gender !== filterGender) return false;
      if (filterPresent === "present" && !r.present) return false;
      if (filterPresent === "absent" && r.present) return false;
      return true;
    })
    .sort((a, b) => {
      let av: string | number, bv: string | number;
      if (sortKey === "submittedAt") {
        av = a.submittedAt.seconds;
        bv = b.submittedAt.seconds;
      } else {
        av = a[sortKey].toLowerCase();
        bv = b[sortKey].toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  function SortIndicator({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className={styles.sortNeutral}>↕</span>;
    return <span className={styles.sortActive}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div className={styles.wrapper}>
      {/* ── Controls ── */}
      <div className={styles.controls}>
        <input
          type="search"
          placeholder="Search by name or roll number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
          id="admin-search"
        />
        <div className={styles.filters}>
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} id="filter-dept">
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} id="filter-year">
            <option value="">All Years</option>
            {years.map((y) => <option key={y} value={y}>{y} Year</option>)}
          </select>
          <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)} id="filter-gender">
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
          <select value={filterPresent} onChange={(e) => setFilterPresent(e.target.value)} id="filter-present">
            <option value="">All Attendance</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
          </select>
        </div>
        <button onClick={exportCSV} className={`btn btn-outline ${styles.exportBtn}`} id="export-csv-btn">
          Export CSV
        </button>
      </div>

      <p className={styles.resultCount}>
        {filtered.length} of {data.length} registrations
      </p>

      {/* ── Table ── */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort("name")} className={styles.sortable}>
                Name <SortIndicator k="name" />
              </th>
              <th>Roll No.</th>
              <th onClick={() => handleSort("department")} className={styles.sortable}>
                Dept <SortIndicator k="department" />
              </th>
              <th onClick={() => handleSort("year")} className={styles.sortable}>
                Year <SortIndicator k="year" />
              </th>
              <th>Gender</th>
              <th>Coded?</th>
              <th onClick={() => handleSort("submittedAt")} className={styles.sortable}>
                Submitted <SortIndicator k="submittedAt" />
              </th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.empty}>No registrations found.</td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.rollNumber} className={r.present ? styles.presentRow : ""}>
                  <td>
                    <span className={styles.name}>{r.name}</span>
                    <span className={styles.email}>{r.email}</span>
                  </td>
                  <td className={styles.mono}>{r.rollNumber}</td>
                  <td>
                    <span className={styles.badge}>{r.department}</span>
                  </td>
                  <td>{r.year}</td>
                  <td>{r.gender}</td>
                  <td>{r.hasCodedBefore ? "Yes" : "No"}</td>
                  <td className={styles.date}>
                    {r.submittedAt.toDate().toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    <button
                      id={`toggle-${r.rollNumber}`}
                      className={`${styles.attendanceBtn} ${r.present ? styles.present : styles.absent}`}
                      onClick={() => handleToggle(r.rollNumber, r.present)}
                      disabled={toggling === r.rollNumber}
                      aria-label={r.present ? "Mark absent" : "Mark present"}
                    >
                      {toggling === r.rollNumber ? "..." : r.present ? "Present" : "Absent"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

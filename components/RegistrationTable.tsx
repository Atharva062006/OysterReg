"use client";

import { useState, useEffect } from "react";
import {
  Registration,
  Event,
  FormFieldConfig,
  togglePresent,
  toggleCandidatePresentInEvent,
  DEFAULT_RECRUITMENT_FORM_SCHEMA,
} from "@/lib/firebase";
import { exportEventRegistrationsToCSV, getCandidateFieldValue } from "@/lib/csvExport";
import styles from "./RegistrationTable.module.css";

interface Props {
  initialData: Registration[];
  event?: Event | null;
  eventId?: string;
}

type SortKey = "name" | "rollNumber" | "submittedAt" | string;
type SortDir = "asc" | "desc";

export default function RegistrationTable({ initialData, event, eventId }: Props) {
  const [data, setData] = useState<Registration[]>(initialData);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterAttendance, setFilterAttendance] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [categoricalFilters, setCategoricalFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [toggling, setToggling] = useState<string | null>(null);

  // Detail Modal State
  const [viewCandidate, setViewCandidate] = useState<Registration | null>(null);

  // Keep local data in sync with props
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Determine effective form schema
  const schema: FormFieldConfig[] =
    event?.formSchema && event.formSchema.length > 0
      ? event.formSchema
      : DEFAULT_RECRUITMENT_FORM_SCHEMA;

  // Determine display columns for the table preview:
  // Exclude identity fields (name, rollNumber, email) and large textarea/file fields
  const displayColumns = schema.filter(
    (f) =>
      f.id !== "name" &&
      f.id !== "rollNumber" &&
      f.id !== "email" &&
      f.type !== "textarea" &&
      f.type !== "file"
  );

  // Determine categorical fields for dynamic filter dropdowns (select / radio fields)
  const filterableFields = schema.filter(
    (f) =>
      (f.type === "select" || f.type === "radio") &&
      f.id !== "gender" && // will show gender if it's the only one, but prioritize others
      f.id !== "hasCodedBefore"
  );

  // If no other select/radio found, fallback to any select/radio
  const activeFilterFields = (
    filterableFields.length > 0
      ? filterableFields
      : schema.filter((f) => f.type === "select" || f.type === "radio")
  ).slice(0, 2);

  // Check if payments are present
  const hasPaidRegistrations =
    Boolean(event?.razorpayEnabled) ||
    data.some(
      (r) =>
        r.paymentStatus === "paid" ||
        r.paymentStatus === "pending" ||
        Boolean(r.razorpayPaymentId)
    );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function handleToggle(candidateId: string, currentState: boolean) {
    setToggling(candidateId);
    try {
      if (eventId) {
        await toggleCandidatePresentInEvent(eventId, candidateId, !currentState);
      } else {
        await togglePresent(candidateId, !currentState);
      }
      setData((prev) =>
        prev.map((r) =>
          r.rollNumber === candidateId || r.email === candidateId
            ? { ...r, present: !currentState }
            : r
        )
      );
    } catch (err) {
      console.error("Failed to toggle presence:", err);
      alert("Failed to update attendance status.");
    } finally {
      setToggling(null);
    }
  }

  function handleExportCSV() {
    exportEventRegistrationsToCSV(
      event,
      filtered,
      undefined,
      `${(event?.name || "event").toLowerCase().replace(/[^a-z0-9]+/g, "_")}_overview_export.csv`
    );
  }

  // Filter registrations
  const filtered = data
    .filter((r) => {
      // 1. Text search across name, rollNumber, email, phone, and formData values
      const q = search.toLowerCase().trim();
      if (q) {
        const nameMatch = r.name?.toLowerCase().includes(q);
        const rollMatch = r.rollNumber?.toLowerCase().includes(q);
        const emailMatch = r.email?.toLowerCase().includes(q);
        const phoneMatch = r.phone?.toLowerCase().includes(q);
        const formDataMatch =
          r.formData &&
          Object.values(r.formData).some((v) =>
            typeof v === "string" ? v.toLowerCase().includes(q) : false
          );

        if (!nameMatch && !rollMatch && !emailMatch && !phoneMatch && !formDataMatch) {
          return false;
        }
      }

      // 2. Stage filter
      if (filterStage && (r.status || event?.stages?.[0]?.id || "registered") !== filterStage) {
        return false;
      }

      // 3. Attendance filter
      if (filterAttendance === "present" && !r.present) return false;
      if (filterAttendance === "absent" && r.present) return false;

      // 4. Payment filter
      if (filterPayment) {
        const currentPay = r.paymentStatus || (event?.razorpayEnabled ? "pending" : "free");
        if (currentPay !== filterPayment) return false;
      }

      // 5. Dynamic categorical filters
      for (const [fieldId, targetVal] of Object.entries(categoricalFilters)) {
        if (!targetVal) continue;
        const actualVal = r.formData?.[fieldId] ?? (r as any)[fieldId];
        if (String(actualVal || "").trim().toLowerCase() !== targetVal.trim().toLowerCase()) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      let av: any = "";
      let bv: any = "";

      if (sortKey === "submittedAt") {
        av = a.submittedAt?.seconds || 0;
        bv = b.submittedAt?.seconds || 0;
      } else if (sortKey === "name") {
        av = (a.name || "").toLowerCase();
        bv = (b.name || "").toLowerCase();
      } else if (sortKey === "rollNumber") {
        av = (a.rollNumber || "").toLowerCase();
        bv = (b.rollNumber || "").toLowerCase();
      } else {
        av = getCandidateFieldValue(a, sortKey).toLowerCase();
        bv = getCandidateFieldValue(b, sortKey).toLowerCase();
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
          placeholder="Search by name, roll number, email, or any field..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
          id="admin-search"
        />

        <div className={styles.filters}>
          {/* Stage Filter */}
          {event?.stages && event.stages.length > 0 && (
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              id="filter-stage"
            >
              <option value="">All Stages</option>
              {event.stages.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          )}

          {/* Dynamic Categorical Filters from Event Form Schema */}
          {activeFilterFields.map((field) => {
            // Collect distinct options from schema or actual submissions
            const optionValues: { value: string; label: string }[] = [];
            if (field.options && field.options.length > 0) {
              field.options.forEach((opt) => optionValues.push({ value: opt.value, label: opt.label }));
            } else {
              const uniqueVals = Array.from(
                new Set(
                  data
                    .map((r) => r.formData?.[field.id] ?? (r as any)[field.id])
                    .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
                )
              ).sort();
              uniqueVals.forEach((val) => optionValues.push({ value: String(val), label: String(val) }));
            }

            return (
              <select
                key={field.id}
                value={categoricalFilters[field.id] || ""}
                onChange={(e) =>
                  setCategoricalFilters((prev) => ({
                    ...prev,
                    [field.id]: e.target.value,
                  }))
                }
                id={`filter-${field.id}`}
              >
                <option value="">All {field.label}</option>
                {optionValues.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            );
          })}

          {/* Attendance Filter */}
          <select
            value={filterAttendance}
            onChange={(e) => setFilterAttendance(e.target.value)}
            id="filter-attendance"
          >
            <option value="">All Attendance</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
          </select>

          {/* Payment Filter */}
          {hasPaidRegistrations && (
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              id="filter-payment"
            >
              <option value="">All Payments</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="free">Free</option>
            </select>
          )}
        </div>

        <button
          onClick={handleExportCSV}
          className={`btn btn-outline ${styles.exportBtn}`}
          id="export-csv-btn"
          title="Export all form fields and submission details to CSV"
        >
          Export CSV ({filtered.length})
        </button>
      </div>

      <p className={styles.resultCount}>
        Showing {filtered.length} of {data.length} candidate registrations
      </p>

      {/* ── Table ── */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort("name")} className={styles.sortable}>
                Candidate <SortIndicator k="name" />
              </th>
              <th onClick={() => handleSort("rollNumber")} className={styles.sortable}>
                Roll / ID <SortIndicator k="rollNumber" />
              </th>

              {/* Dynamic Event Form Columns */}
              {displayColumns.map((col) => (
                <th
                  key={col.id}
                  onClick={() => handleSort(col.id)}
                  className={styles.sortable}
                >
                  {col.label} <SortIndicator k={col.id} />
                </th>
              ))}

              {/* Stage status if event has multiple stages */}
              {event?.stages && event.stages.length > 1 && <th>Stage</th>}

              {/* Payment column if applicable */}
              {hasPaidRegistrations && <th>Payment</th>}

              <th onClick={() => handleSort("submittedAt")} className={styles.sortable}>
                Submitted <SortIndicator k="submittedAt" />
              </th>
              <th>Attendance</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={displayColumns.length + (hasPaidRegistrations ? 6 : 5)}
                  className={styles.empty}
                >
                  No registrations found matching the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const candidateId = r.rollNumber || r.email || "N/A";
                const stageObj = event?.stages?.find(
                  (s) => s.id === (r.status || event.stages[0]?.id || "registered")
                );

                return (
                  <tr key={candidateId} className={r.present ? styles.presentRow : ""}>
                    {/* Candidate Name & Contact */}
                    <td>
                      <span className={styles.name}>{r.name || "Unnamed Candidate"}</span>
                      <span className={styles.email}>{r.email || "No email"}</span>
                    </td>

                    {/* Roll / Identifier */}
                    <td className={styles.mono}>{r.rollNumber || "—"}</td>

                    {/* Dynamic Event Form Values */}
                    {displayColumns.map((col) => {
                      const formatted = getCandidateFieldValue(r, col.id, col);

                      // If URL type
                      if (col.type === "url" && formatted && formatted.startsWith("http")) {
                        return (
                          <td key={col.id} className={styles.portfolioCell}>
                            <a
                              href={formatted}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.portfolioLink}
                              title={formatted}
                            >
                              Open ↗
                            </a>
                          </td>
                        );
                      }

                      // Badge style for categorical fields
                      if (col.type === "select" || col.type === "radio") {
                        return (
                          <td key={col.id}>
                            {formatted ? (
                              <span className={styles.badge}>{formatted}</span>
                            ) : (
                              <span className={styles.noLink}>—</span>
                            )}
                          </td>
                        );
                      }

                      return (
                        <td key={col.id}>
                          {formatted ? (
                            <span>{formatted}</span>
                          ) : (
                            <span className={styles.noLink}>—</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Stage status */}
                    {event?.stages && event.stages.length > 1 && (
                      <td>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "999px",
                            background: "rgba(148, 163, 184, 0.15)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {stageObj?.name || r.status || "Registered"}
                        </span>
                      </td>
                    )}

                    {/* Payment Status */}
                    {hasPaidRegistrations && (
                      <td>
                        {r.paymentStatus === "paid" ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "0.2rem 0.5rem",
                              borderRadius: "999px",
                              background: "rgba(34, 197, 94, 0.15)",
                              color: "#22c55e",
                              border: "1px solid rgba(34, 197, 94, 0.3)",
                              whiteSpace: "nowrap",
                            }}
                            title={`Payment ID: ${r.razorpayPaymentId || "N/A"}`}
                          >
                            ✓ Paid {r.paymentAmount ? `₹${r.paymentAmount}` : ""}
                          </span>
                        ) : r.paymentStatus === "pending" ? (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              padding: "0.2rem 0.5rem",
                              borderRadius: "999px",
                              background: "rgba(245, 166, 35, 0.15)",
                              color: "#f5a623",
                              border: "1px solid rgba(245, 166, 35, 0.3)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ⏳ Pending
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            Free
                          </span>
                        )}
                      </td>
                    )}

                    {/* Submitted At */}
                    <td className={styles.date}>
                      {r.submittedAt?.toDate
                        ? r.submittedAt.toDate().toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>

                    {/* Attendance Toggle */}
                    <td>
                      <button
                        id={`toggle-${candidateId}`}
                        className={`${styles.attendanceBtn} ${
                          r.present ? styles.present : styles.absent
                        }`}
                        onClick={() => handleToggle(candidateId, r.present)}
                        disabled={toggling === candidateId}
                        aria-label={r.present ? "Mark absent" : "Mark present"}
                      >
                        {toggling === candidateId
                          ? "..."
                          : r.present
                          ? "Present"
                          : "Absent"}
                      </button>
                    </td>

                    {/* Form Details Button */}
                    <td>
                      <button
                        onClick={() => setViewCandidate(r)}
                        className="btn btn-sm btn-outline"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", whiteSpace: "nowrap" }}
                        title="View all submitted fields for this candidate"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Candidate Details Modal ── */}
      {viewCandidate && (
        <div
          className={styles.modalOverlay}
          onClick={() => setViewCandidate(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>{viewCandidate.name || "Candidate Details"}</h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", margin: "0.25rem 0 0 0" }}>
                  {viewCandidate.rollNumber ? `Roll: ${viewCandidate.rollNumber} | ` : ""}
                  {viewCandidate.email || "No email"}
                  {viewCandidate.phone ? ` | Tel: ${viewCandidate.phone}` : ""}
                </p>
              </div>
              <button
                onClick={() => setViewCandidate(null)}
                className={styles.modalCloseBtn}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Event Form Responses */}
              {schema.map((field) => {
                const formatted = getCandidateFieldValue(viewCandidate, field.id, field);

                if (field.type === "file" && formatted && formatted.includes("http")) {
                  return (
                    <div key={field.id} className={styles.detailCard}>
                      <div className={styles.detailLabel}>{field.label}</div>
                      <a
                        href={formatted}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline"
                        style={{ marginTop: "0.375rem", display: "inline-block" }}
                      >
                        📄 View Uploaded Document ↗
                      </a>
                    </div>
                  );
                }

                if (field.type === "url" && formatted && formatted.startsWith("http")) {
                  return (
                    <div key={field.id} className={styles.detailCard}>
                      <div className={styles.detailLabel}>{field.label}</div>
                      <a
                        href={formatted}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.portfolioLink}
                        style={{ marginTop: "0.375rem", display: "inline-block" }}
                      >
                        {formatted} ↗
                      </a>
                    </div>
                  );
                }

                return (
                  <div key={field.id} className={styles.detailCard}>
                    <div className={styles.detailLabel}>{field.label}</div>
                    <div className={styles.detailValue}>{formatted || "—"}</div>
                  </div>
                );
              })}

              {/* Submission Metadata */}
              <div className={styles.detailCard}>
                <div className={styles.detailLabel}>Submission Information</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.25rem" }}>
                  <div>
                    <strong>Attendance:</strong> {viewCandidate.present ? "Present" : "Absent"}
                  </div>
                  {viewCandidate.status && (
                    <div>
                      <strong>Pipeline Stage:</strong>{" "}
                      {event?.stages?.find((s) => s.id === viewCandidate.status)?.name || viewCandidate.status}
                    </div>
                  )}
                  {viewCandidate.paymentStatus && (
                    <div>
                      <strong>Payment Status:</strong>{" "}
                      {viewCandidate.paymentStatus}
                      {viewCandidate.paymentAmount ? ` (₹${viewCandidate.paymentAmount})` : ""}
                      {viewCandidate.razorpayPaymentId ? ` — ID: ${viewCandidate.razorpayPaymentId}` : ""}
                    </div>
                  )}
                  {viewCandidate.submittedAt?.toDate && (
                    <div>
                      <strong>Submitted At:</strong>{" "}
                      {viewCandidate.submittedAt.toDate().toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
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

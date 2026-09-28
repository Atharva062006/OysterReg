import { Event, FormFieldConfig, Panel, Registration, DEFAULT_RECRUITMENT_FORM_SCHEMA } from "./firebase";

/**
 * Format any field value into a clean, human-readable string for CSV.
 */
export function formatFieldValue(
  val: any,
  fieldConfig?: FormFieldConfig
): string {
  if (val === undefined || val === null) return "";

  // If option with label exists, use human-readable label
  if (fieldConfig?.options && fieldConfig.options.length > 0 && typeof val === "string") {
    const matched = fieldConfig.options.find(
      (opt) => opt.value.trim().toLowerCase() === val.trim().toLowerCase()
    );
    if (matched) return matched.label;
  }

  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (val === "yes") return "Yes";
  if (val === "no") return "No";

  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (fieldConfig?.options) {
          const matched = fieldConfig.options.find(
            (opt) => opt.value.trim().toLowerCase() === String(item).trim().toLowerCase()
          );
          if (matched) return matched.label;
        }
        return String(item);
      })
      .join("; ");
  }

  // Handle Firestore Timestamp or Date object
  if (typeof val === "object") {
    if (typeof val.toDate === "function") {
      return val.toDate().toLocaleString("en-IN");
    }
    if (val instanceof Date) {
      return val.toLocaleString("en-IN");
    }
    return JSON.stringify(val);
  }

  return String(val);
}

/**
 * Escape a CSV cell value per RFC 4180 standard.
 */
export function escapeCsvCell(val: any): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Extract field value from registration (checking both r.formData and top-level properties).
 */
export function getCandidateFieldValue(
  r: Registration,
  fieldId: string,
  fieldConfig?: FormFieldConfig
): string {
  let val: any = undefined;

  if (r.formData && r.formData[fieldId] !== undefined) {
    val = r.formData[fieldId];
  } else if ((r as any)[fieldId] !== undefined) {
    val = (r as any)[fieldId];
  }

  return formatFieldValue(val, fieldConfig);
}

/**
 * Exports candidate registrations to CSV using the exact form schema of the event.
 * Automatically exports all form fields, stage status, attendance, payment details,
 * and panel evaluations without hardcoding or duplicate columns.
 */
export function exportEventRegistrationsToCSV(
  event: Event | null | undefined,
  registrations: Registration[],
  panels?: Panel[],
  customFilename?: string
): void {
  // 1. Determine form schema (use event formSchema or fallback to default recruitment)
  const schema: FormFieldConfig[] =
    event?.formSchema && event.formSchema.length > 0
      ? event.formSchema
      : DEFAULT_RECRUITMENT_FORM_SCHEMA;

  const schemaFieldIds = new Set(schema.map((f) => f.id));

  // 2. Discover any extra fields in formData not in schema
  const knownIgnoredKeys = new Set([
    "submittedAt",
    "present",
    "status",
    "aptitudeNotes",
    "panelId",
    "interviews",
    "formData",
    "eventId",
    "resumeUrl",
    "paymentStatus",
    "paymentAmount",
    "razorpayOrderId",
    "razorpayPaymentId",
  ]);

  const extraKeys: string[] = [];
  registrations.forEach((r) => {
    if (r.formData) {
      Object.keys(r.formData).forEach((k) => {
        if (!schemaFieldIds.has(k) && !knownIgnoredKeys.has(k) && !extraKeys.includes(k)) {
          extraKeys.push(k);
        }
      });
    }
  });

  // 3. Determine if payments or panels are relevant
  const hasPaymentData =
    Boolean(event?.razorpayEnabled) ||
    registrations.some(
      (r) =>
        r.paymentStatus === "paid" ||
        r.paymentStatus === "pending" ||
        Boolean(r.razorpayPaymentId) ||
        Boolean(r.paymentAmount)
    );

  const hasPanelData =
    (panels && panels.length > 0) ||
    registrations.some((r) => Boolean(r.panelId) || Boolean(r.interviews));

  // 4. Build headers
  const headers: string[] = [];

  // All event form fields
  schema.forEach((f) => {
    headers.push(f.label);
  });

  // Any extra submitted fields
  extraKeys.forEach((k) => {
    const formattedLabel = k
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());
    headers.push(formattedLabel);
  });

  // Process / Pipeline Columns
  headers.push("Stage Status");
  headers.push("Attendance");
  headers.push("Submitted At");

  if (hasPaymentData) {
    headers.push("Payment Status");
    headers.push("Payment Amount (INR)");
    headers.push("Razorpay Order ID");
    headers.push("Razorpay Payment ID");
  }

  if (hasPanelData) {
    headers.push("Assigned Panel");
    headers.push("Panel Verdict");
    headers.push("Overall Score");
    headers.push("Interviewer Notes");
  }

  // 5. Build rows
  const rows: string[][] = registrations.map((r) => {
    const row: string[] = [];

    // All form fields from schema
    schema.forEach((f) => {
      row.push(getCandidateFieldValue(r, f.id, f));
    });

    // Extra fields
    extraKeys.forEach((k) => {
      row.push(getCandidateFieldValue(r, k));
    });

    // Stage Status
    const stageObj = event?.stages?.find((s) => s.id === (r.status || "registered"));
    const stageName = stageObj?.name || r.status || "Registered";
    row.push(stageName);

    // Attendance
    row.push(r.present ? "Present" : "Absent");

    // Submitted At
    const dateStr = r.submittedAt?.toDate
      ? r.submittedAt.toDate().toLocaleString("en-IN")
      : "";
    row.push(dateStr);

    // Payment fields
    if (hasPaymentData) {
      row.push(r.paymentStatus || (event?.razorpayEnabled ? "pending" : "free"));
      row.push(r.paymentAmount !== undefined ? String(r.paymentAmount) : "0");
      row.push(r.razorpayOrderId || "");
      row.push(r.razorpayPaymentId || "");
    }

    // Panel fields
    if (hasPanelData) {
      const panelObj = r.panelId ? panels?.find((p) => p.id === r.panelId) : undefined;
      const verdictObj = r.panelId ? r.interviews?.[r.panelId] : undefined;

      row.push(panelObj?.name || (r.panelId ? `Panel (${r.panelId})` : "Unassigned"));
      row.push(verdictObj?.verdict || "pending");
      row.push(verdictObj?.overallScore !== undefined ? String(verdictObj.overallScore) : "N/A");
      row.push(verdictObj?.notes || "");
    }

    return row;
  });

  // 6. Generate CSV string
  const csvContent = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\r\n");

  // 7. Trigger download with UTF-8 BOM for Microsoft Excel compatibility
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const defaultName = event?.name
    ? `${event.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_registrations.csv`
    : "registrations.csv";

  a.download = customFilename || defaultName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

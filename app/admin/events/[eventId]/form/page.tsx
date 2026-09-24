"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getEventById,
  saveEventFormSchema,
  Event,
  FormFieldConfig,
  DEFAULT_RECRUITMENT_FORM_SCHEMA,
  WORKSHOP_FORM_SCHEMA_PRESET,
} from "@/lib/firebase";
import EventAdminNav from "@/components/EventAdminNav";
import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import styles from "@/app/admin/admin.module.css";

interface FormBuilderPageProps {
  params: Promise<{ eventId: string }>;
}

const FIELD_TYPES: { value: FormFieldConfig["type"]; label: string }[] = [
  { value: "text", label: "Single-line Text" },
  { value: "email", label: "Email Address" },
  { value: "tel", label: "Phone Number" },
  { value: "number", label: "Number" },
  { value: "url", label: "Web URL / Link" },
  { value: "textarea", label: "Multi-line Textarea" },
  { value: "select", label: "Dropdown Select" },
  { value: "radio", label: "Radio Options" },
  { value: "file", label: "File Upload (PDF)" },
];

export default function FormBuilderPage({ params }: FormBuilderPageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [formSchema, setFormSchema] = useState<FormFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Guard: only allow saving if the schema was successfully loaded from Firestore,
  // not from a hardcoded fallback (prevents accidental wipe during Firestore outages).
  const [schemaLoadedFromFirestore, setSchemaLoadedFromFirestore] = useState(false);

  // Tab: "builder" or "preview"
  const [activeTab, setActiveTab] = useState<"builder" | "preview">("builder");

  // New field state
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FormFieldConfig["type"]>("text");
  const [newPlaceholder, setNewPlaceholder] = useState("");
  const [newRequired, setNewRequired] = useState(true);
  const [newPanelVisible, setNewPanelVisible] = useState(false);
  const [newOptionsText, setNewOptionsText] = useState("");
  // Per-option price entries for select/radio fields when dynamic pricing is used
  const [newOptionsWithPrices, setNewOptionsWithPrices] = useState<{ label: string; price: string }[]>([]);
  const [usePricedOptions, setUsePricedOptions] = useState(false);
  const [newHint, setNewHint] = useState("");
  const [newSpan, setNewSpan] = useState<1 | 2>(1);
  // Conditional visibility state
  const [newEnableCondition, setNewEnableCondition] = useState(false);
  const [newConditionFieldId, setNewConditionFieldId] = useState("");
  const [newConditionValue, setNewConditionValue] = useState("");

  // Edit field modal states
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState<FormFieldConfig["type"]>("text");
  const [editPlaceholder, setEditPlaceholder] = useState("");
  const [editRequired, setEditRequired] = useState(true);
  const [editPanelVisible, setEditPanelVisible] = useState(false);
  const [editOptionsWithPrices, setEditOptionsWithPrices] = useState<{ label: string; price: string }[]>([]);
  const [editUsePricedOptions, setEditUsePricedOptions] = useState(false);
  const [editOptionsText, setEditOptionsText] = useState("");
  const [editHint, setEditHint] = useState("");
  const [editSpan, setEditSpan] = useState<1 | 2>(1);
  const [editEnableCondition, setEditEnableCondition] = useState(false);
  const [editConditionFieldId, setEditConditionFieldId] = useState("");
  const [editConditionValue, setEditConditionValue] = useState("");

  // Preview form test state
  const [previewData, setPreviewData] = useState<Record<string, any>>({});

  // Auth gate
  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("oyster_admin")) {
      router.replace("/admin/login");
    }
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setSchemaLoadedFromFirestore(false);
    try {
      const ev = await getEventById(eventId);
      if (!ev) {
        setError("Event not found.");
        return;
      }
      setEvent(ev);
      setFormSchema(ev.formSchema || []);
      // Only mark as safe-to-save if we got a real Firestore document
      setSchemaLoadedFromFirestore(true);
    } catch (err) {
      console.error(err);
      setError("Failed to load form configuration. Saving is disabled until the schema is confirmed from Firestore.");
      // schemaLoadedFromFirestore stays false — save will be blocked
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

  function handleAddField(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const id = newLabel
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (formSchema.some((f) => f.id === id)) {
      alert("A field with a similar label/ID already exists.");
      return;
    }

    let options: { value: string; label: string; price?: number }[] | undefined = undefined;
    if (newType === "select" || newType === "radio") {
      if (usePricedOptions) {
        // Build options from the structured per-option price builder
        const validEntries = newOptionsWithPrices.filter((o) => o.label.trim());
        if (validEntries.length === 0) {
          alert("Please add at least one option.");
          return;
        }
        options = validEntries.map((o) => ({
          value: o.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          label: o.label.trim(),
          ...(o.price.trim() !== "" ? { price: Number(o.price) } : {}),
        }));
      } else {
        // Legacy comma-separated plain text
        options = newOptionsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((opt) => ({ value: opt.toLowerCase().replace(/[^a-z0-9]+/g, "_"), label: opt }));
        if (!options || options.length === 0) {
          alert("Please provide at least one option (comma separated).");
          return;
        }
      }
    }

    const condition =
      newEnableCondition && newConditionFieldId && newConditionValue.trim()
        ? { fieldId: newConditionFieldId, value: newConditionValue.trim() }
        : undefined;

    const field: FormFieldConfig = {
      id,
      label: newLabel.trim(),
      type: newType,
      placeholder: newPlaceholder.trim() || undefined,
      required: newRequired,
      options,
      hint: newHint.trim() || undefined,
      gridSpan: newSpan,
      panelVisible: newPanelVisible,
      condition,
    };

    setFormSchema((prev) => [...prev, field]);
    setNewLabel("");
    setNewPlaceholder("");
    setNewOptionsText("");
    setNewOptionsWithPrices([]);
    setUsePricedOptions(false);
    setNewHint("");
    setNewPanelVisible(false);
    setNewEnableCondition(false);
    setNewConditionFieldId("");
    setNewConditionValue("");
  }

  function handleStartEdit(field: FormFieldConfig) {
    setEditingFieldId(field.id);
    setEditLabel(field.label);
    setEditType(field.type);
    setEditPlaceholder(field.placeholder || "");
    setEditRequired(field.required);
    setEditPanelVisible(!!field.panelVisible);
    setEditHint(field.hint || "");
    setEditSpan(field.gridSpan || 1);

    if (field.options && field.options.length > 0) {
      const hasPrices = field.options.some((o) => typeof o.price === "number");
      setEditUsePricedOptions(hasPrices);
      setEditOptionsWithPrices(
        field.options.map((o) => ({
          label: o.label,
          price: typeof o.price === "number" ? String(o.price) : "",
        }))
      );
      setEditOptionsText(field.options.map((o) => o.label).join(", "));
    } else {
      setEditOptionsWithPrices([]);
      setEditUsePricedOptions(false);
      setEditOptionsText("");
    }

    if (field.condition && field.condition.fieldId) {
      setEditEnableCondition(true);
      setEditConditionFieldId(field.condition.fieldId);
      setEditConditionValue(field.condition.value || "");
    } else {
      setEditEnableCondition(false);
      setEditConditionFieldId("");
      setEditConditionValue("");
    }
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingFieldId || !editLabel.trim()) return;

    let options: { value: string; label: string; price?: number }[] | undefined = undefined;
    if (editType === "select" || editType === "radio") {
      if (editUsePricedOptions) {
        const valid = editOptionsWithPrices.filter((o) => o.label.trim());
        if (valid.length === 0) {
          alert("Please provide at least one option.");
          return;
        }
        options = valid.map((o) => ({
          value: o.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          label: o.label.trim(),
          ...(o.price.trim() !== "" ? { price: Number(o.price) } : {}),
        }));
      } else {
        const parsed = editOptionsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parsed.length === 0) {
          alert("Please provide at least one option (comma separated).");
          return;
        }
        options = parsed.map((opt) => ({
          value: opt.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          label: opt,
        }));
      }
    }

    const condition =
      editEnableCondition && editConditionFieldId && editConditionValue.trim()
        ? { fieldId: editConditionFieldId, value: editConditionValue.trim() }
        : undefined;

    setFormSchema((prev) =>
      prev.map((f) =>
        f.id === editingFieldId
          ? {
              ...f,
              label: editLabel.trim(),
              type: editType,
              placeholder: editPlaceholder.trim() || undefined,
              required: editRequired,
              options,
              hint: editHint.trim() || undefined,
              gridSpan: editSpan,
              panelVisible: editPanelVisible,
              condition,
            }
          : f
      )
    );

    setEditingFieldId(null);
  }

  function handleTogglePanelVisible(id: string) {
    setFormSchema((prev) =>
      prev.map((field) =>
        field.id === id ? { ...field, panelVisible: !field.panelVisible } : field
      )
    );
  }

  function handleRemoveField(id: string) {
    if (formSchema.length <= 1) {
      alert("A registration form must have at least 1 field.");
      return;
    }
    setFormSchema((prev) => prev.filter((f) => f.id !== id));
  }

  function handleMoveField(index: number, direction: "up" | "down") {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === formSchema.length - 1)
    ) {
      return;
    }
    const next = [...formSchema];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setFormSchema(next);
  }

  function handleHotswapPreset(presetName: "recruitment" | "workshop") {
    // Require the admin to explicitly type "REPLACE" to prevent accidental schema wipes.
    const confirmation = prompt(
      `⚠️ This will PERMANENTLY REPLACE all ${formSchema.length} current field(s) with the "${presetName.toUpperCase()}" preset.\n\nType REPLACE to confirm:`
    );
    if (confirmation?.trim() !== "REPLACE") {
      alert("Hotswap cancelled — you must type REPLACE exactly to proceed.");
      return;
    }

    if (presetName === "recruitment") {
      setFormSchema(DEFAULT_RECRUITMENT_FORM_SCHEMA);
    } else if (presetName === "workshop") {
      setFormSchema(WORKSHOP_FORM_SCHEMA_PRESET);
    }
  }

  async function handleSave() {
    // Safety guard: never overwrite Firestore with a schema that wasn't confirmed
    // loaded from Firestore (e.g. hardcoded fallback used during a Firestore outage).
    if (!schemaLoadedFromFirestore) {
      setError("Cannot save — the schema could not be confirmed from Firestore. Reload the page and try again.");
      return;
    }
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      await saveEventFormSchema(eventId, formSchema);
      setSuccess("Registration form schema saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save form schema.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading form builder…</p>
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
              <h1 className={styles.pageTitle}>Dynamic Form Builder & Hotswapper</h1>
            </div>
          </div>
          <button onClick={handleSignOut} className={`btn btn-outline ${styles.signOutBtn}`}>
            Sign out
          </button>
        </div>
      </header>

      {/* Nav */}
      <EventAdminNav eventId={eventId} eventName={event.name} eventType={event.type} />

      <main className={styles.main}>
        {error && <div className={styles.errorBanner}>{error}</div>}
        {success && (
          <div
            style={{
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid #22c55e",
              color: "#22c55e",
              padding: "0.875rem 1rem",
              borderRadius: "var(--radius-md)",
            }}
          >
            {success}
          </div>
        )}

        {/* Builder / Preview Tabs */}
        <section className={styles.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => setActiveTab("builder")}
                className={`btn ${activeTab === "builder" ? "btn-primary" : "btn-outline"}`}
              >
                Form Schema Builder
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`btn ${activeTab === "preview" ? "btn-primary" : "btn-outline"}`}
              >
                Live Form Preview
              </button>
            </div>

            <button onClick={handleSave} disabled={saving} className="btn btn-primary" id="save-form-btn">
              {saving ? "Saving Schema..." : "Save Form Schema"}
            </button>
          </div>
        </section>

        {/* BUILDER TAB */}
        {activeTab === "builder" && (
          <>
            {/* Presets Hotswapper */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Hotswap Preset Templates</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                Apply pre-built form templates in 1 click:
              </p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => handleHotswapPreset("recruitment")}
                  className="btn btn-outline"
                >
                  Apply Standard Recruitment Preset
                </button>
                <button
                  onClick={() => handleHotswapPreset("workshop")}
                  className="btn btn-outline"
                >
                  Apply Workshop RSVP Preset
                </button>
              </div>
            </section>

            {/* Current Fields List */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Configured Form Fields ({formSchema.length})</h2>

              <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {formSchema.map((field, index) => (
                  <div
                    key={field.id}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-lg)",
                      padding: "1rem 1.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "1rem",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "240px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{field.label}</span>
                        {field.required && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>*Required</span>}
                        {field.panelVisible && <span style={{ color: "var(--accent)", fontSize: "0.75rem", border: "1px solid var(--accent)", padding: "0.1rem 0.3rem", borderRadius: "var(--radius-sm)" }}>👁 Panel Visible</span>}
                        {field.condition && (
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              background: "rgba(245, 166, 35, 0.15)",
                              border: "1px solid rgba(245, 166, 35, 0.4)",
                              color: "var(--accent)",
                              padding: "0.1rem 0.35rem",
                              borderRadius: "var(--radius-sm)",
                              fontWeight: 500,
                            }}
                          >
                            ⚡ Only when [{formSchema.find((f) => f.id === field.condition?.fieldId)?.label || field.condition.fieldId}] = &quot;{field.condition.value}&quot;
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            background: "var(--bg)",
                            padding: "0.15rem 0.4rem",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                          }}
                        >
                          {field.type}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        ID: <code>{field.id}</code> | Span: {field.gridSpan || 1} col
                        {field.options && ` | Options: ${field.options.map((o) => {
                          const priceStr = typeof o.price === "number" ? ` (\u20b9${o.price})` : "";
                          return o.label + priceStr;
                        }).join(", ")}`}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button
                        onClick={() => handleMoveField(index, "up")}
                        disabled={index === 0}
                        className="btn btn-sm btn-outline"
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMoveField(index, "down")}
                        disabled={index === formSchema.length - 1}
                        className="btn btn-sm btn-outline"
                        title="Move Down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleTogglePanelVisible(field.id)}
                        className="btn btn-sm btn-outline"
                        style={{ color: field.panelVisible ? "var(--text-muted)" : "var(--accent)", borderColor: field.panelVisible ? "var(--border)" : "rgba(59, 130, 246, 0.3)" }}
                        title={field.panelVisible ? "Hide from Panel" : "Show in Panel"}
                      >
                        {field.panelVisible ? "👁 Hide" : "👁 Show"}
                      </button>
                      <button
                        onClick={() => handleStartEdit(field)}
                        className="btn btn-sm btn-outline"
                        style={{ color: "var(--accent)", borderColor: "rgba(245, 166, 35, 0.4)" }}
                        title="Edit Field"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleRemoveField(field.id)}
                        className="btn btn-sm btn-outline"
                        style={{ color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                        title="Remove Field"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Add Custom Field Form */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Add Custom Field</h2>
              <form
                onSubmit={handleAddField}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Field Label *
                    </label>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="e.g. T-Shirt Size, GitHub Profile"
                      required
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Field Type
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as any)}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(newType === "select" || newType === "radio") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                        Options
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={usePricedOptions}
                          onChange={(e) => setUsePricedOptions(e.target.checked)}
                        />
                        Set price per option (for dynamic pricing)
                      </label>
                    </div>

                    {!usePricedOptions ? (
                      // Legacy: plain comma-separated options
                      <input
                        type="text"
                        value={newOptionsText}
                        onChange={(e) => setNewOptionsText(e.target.value)}
                        placeholder="e.g. Small, Medium, Large, XL"
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          color: "var(--text-primary)",
                        }}
                      />
                    ) : (
                      // Priced options builder
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {newOptionsWithPrices.map((opt, idx) => (
                          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 120px 32px", gap: "0.5rem", alignItems: "center" }}>
                            <input
                              type="text"
                              value={opt.label}
                              onChange={(e) => {
                                const updated = [...newOptionsWithPrices];
                                updated[idx] = { ...updated[idx], label: e.target.value };
                                setNewOptionsWithPrices(updated);
                              }}
                              placeholder="Option label (e.g. Single, Duo)"
                              style={{
                                padding: "0.5rem 0.75rem",
                                background: "var(--bg)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-md)",
                                color: "var(--text-primary)",
                                width: "100%",
                              }}
                            />
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={opt.price}
                              onChange={(e) => {
                                const updated = [...newOptionsWithPrices];
                                updated[idx] = { ...updated[idx], price: e.target.value };
                                setNewOptionsWithPrices(updated);
                              }}
                              placeholder="₹ Price"
                              style={{
                                padding: "0.5rem 0.75rem",
                                background: "var(--bg)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-md)",
                                color: "var(--text-primary)",
                                width: "100%",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setNewOptionsWithPrices((prev) => prev.filter((_, i) => i !== idx))}
                              className="btn btn-sm btn-outline"
                              style={{ color: "var(--danger)", borderColor: "rgba(239,68,68,0.3)", padding: "0.4rem" }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setNewOptionsWithPrices((prev) => [...prev, { label: "", price: "" }])}
                          className="btn btn-sm btn-outline"
                          style={{ alignSelf: "flex-start" }}
                        >
                          + Add Option
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Placeholder Text
                    </label>
                    <input
                      type="text"
                      value={newPlaceholder}
                      onChange={(e) => setNewPlaceholder(e.target.value)}
                      placeholder="e.g. Select your size..."
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Layout Width
                    </label>
                    <select
                      value={newSpan}
                      onChange={(e) => setNewSpan(Number(e.target.value) as 1 | 2)}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    >
                      <option value={1}>Half Width (1 Column)</option>
                      <option value={2}>Full Width (2 Columns)</option>
                    </select>
                  </div>
                </div>

                {/* Conditional Visibility Option */}
                {formSchema.filter((f) => f.type === "select" || f.type === "radio").length > 0 && (
                  <div
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={newEnableCondition}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNewEnableCondition(checked);
                          if (checked && !newConditionFieldId) {
                            const parents = formSchema.filter((f) => f.type === "select" || f.type === "radio");
                            if (parents.length > 0) {
                              setNewConditionFieldId(parents[0].id);
                              if (parents[0].options && parents[0].options.length > 0) {
                                setNewConditionValue(parents[0].options[0].value);
                              }
                            }
                          }
                        }}
                      />
                      Conditional Visibility: reveal this field only when a specific option is chosen (e.g. Duo)
                    </label>

                    {newEnableCondition && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.25rem" }}>
                        <div>
                          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                            Triggering Field
                          </label>
                          <select
                            value={newConditionFieldId}
                            onChange={(e) => {
                              const newFid = e.target.value;
                              setNewConditionFieldId(newFid);
                              const p = formSchema.find((f) => f.id === newFid);
                              if (p?.options && p.options.length > 0) {
                                setNewConditionValue(p.options[0].value);
                              }
                            }}
                            style={{
                              width: "100%",
                              padding: "0.45rem 0.65rem",
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                              color: "var(--text-primary)",
                              fontSize: "0.875rem",
                            }}
                          >
                            {formSchema
                              .filter((f) => f.type === "select" || f.type === "radio")
                              .map((pf) => (
                                <option key={pf.id} value={pf.id}>
                                  {pf.label} ({pf.id})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                            Reveal when value equals:
                          </label>
                          {(() => {
                            const selectedParent = formSchema.find((pf) => pf.id === newConditionFieldId);
                            if (selectedParent?.options && selectedParent.options.length > 0) {
                              return (
                                <select
                                  value={newConditionValue}
                                  onChange={(e) => setNewConditionValue(e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "0.45rem 0.65rem",
                                    background: "var(--surface)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--radius-sm)",
                                    color: "var(--text-primary)",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  {selectedParent.options.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label} ({opt.value})
                                    </option>
                                  ))}
                                </select>
                              );
                            }
                            return (
                              <input
                                type="text"
                                value={newConditionValue}
                                onChange={(e) => setNewConditionValue(e.target.value)}
                                placeholder="e.g. duo"
                                style={{
                                  width: "100%",
                                  padding: "0.45rem 0.65rem",
                                  background: "var(--surface)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "var(--radius-sm)",
                                  color: "var(--text-primary)",
                                  fontSize: "0.875rem",
                                }}
                              />
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newRequired}
                      onChange={(e) => setNewRequired(e.target.checked)}
                    />
                    Field is Required
                  </label>
                  
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newPanelVisible}
                      onChange={(e) => setNewPanelVisible(e.target.checked)}
                    />
                    Show in Panel View
                  </label>
                </div>

                <div>
                  <button type="submit" className="btn btn-outline" style={{ marginTop: "0.5rem" }}>
                    + Add Field to Schema
                  </button>
                </div>
              </form>
            </section>
          </>
        )}

        {/* PREVIEW TAB */}
        {activeTab === "preview" && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Live Form Candidate Preview</h2>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "2rem",
                maxWidth: "680px",
                margin: "1rem auto 0",
              }}
            >
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                {event.name}
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "2rem" }}>
                {event.description || "Fill out the registration form below."}
              </p>

              <DynamicFormRenderer
                schema={formSchema}
                formData={previewData}
                errors={{}}
                onChange={(fieldId, val) =>
                  setPreviewData((prev) => ({ ...prev, [fieldId]: val }))
                }
              />

              <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                <button type="button" className="btn btn-primary" style={{ width: "100%" }}>
                  Submit Registration (Preview Only)
                </button>
              </div>
            </div>
          </section>
        )}

        {/* EDIT FIELD MODAL */}
        {editingFieldId && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(6px)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
            onClick={() => setEditingFieldId(null)}
          >
            <div
              style={{
                background: "var(--surface)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "1.75rem",
                width: "100%",
                maxWidth: "680px",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Edit Field: {editLabel || editingFieldId}
                  </h3>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                    Field ID: <code>{editingFieldId}</code> (Immutable ID ensures existing registrations stay intact)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingFieldId(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    fontSize: "1.5rem",
                    cursor: "pointer",
                    padding: "0.25rem",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Field Label *
                    </label>
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Field Type
                    </label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as any)}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(editType === "select" || editType === "radio") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                        Options
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={editUsePricedOptions}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setEditUsePricedOptions(checked);
                            if (checked && editOptionsWithPrices.length === 0 && editOptionsText.trim()) {
                              setEditOptionsWithPrices(
                                editOptionsText
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean)
                                  .map((s) => ({ label: s, price: "" }))
                              );
                            }
                          }}
                        />
                        Set price per option (for dynamic pricing)
                      </label>
                    </div>

                    {!editUsePricedOptions ? (
                      <input
                        type="text"
                        value={editOptionsText}
                        onChange={(e) => setEditOptionsText(e.target.value)}
                        placeholder="e.g. Small, Medium, Large, XL"
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.75rem",
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          color: "var(--text-primary)",
                        }}
                      />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {editOptionsWithPrices.map((opt, idx) => (
                          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 120px 32px", gap: "0.5rem", alignItems: "center" }}>
                            <input
                              type="text"
                              value={opt.label}
                              onChange={(e) => {
                                const updated = [...editOptionsWithPrices];
                                updated[idx] = { ...updated[idx], label: e.target.value };
                                setEditOptionsWithPrices(updated);
                              }}
                              placeholder="Option label (e.g. Single, Duo)"
                              style={{
                                padding: "0.5rem 0.75rem",
                                background: "var(--bg)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-md)",
                                color: "var(--text-primary)",
                                width: "100%",
                              }}
                            />
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={opt.price}
                              onChange={(e) => {
                                const updated = [...editOptionsWithPrices];
                                updated[idx] = { ...updated[idx], price: e.target.value };
                                setEditOptionsWithPrices(updated);
                              }}
                              placeholder="₹ Price"
                              style={{
                                padding: "0.5rem 0.75rem",
                                background: "var(--bg)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-md)",
                                color: "var(--text-primary)",
                                width: "100%",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setEditOptionsWithPrices((prev) => prev.filter((_, i) => i !== idx))}
                              className="btn btn-sm btn-outline"
                              style={{ color: "var(--danger)", borderColor: "rgba(239,68,68,0.3)", padding: "0.4rem" }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditOptionsWithPrices((prev) => [...prev, { label: "", price: "" }])}
                          className="btn btn-sm btn-outline"
                          style={{ alignSelf: "flex-start" }}
                        >
                          + Add Option
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Placeholder Text
                    </label>
                    <input
                      type="text"
                      value={editPlaceholder}
                      onChange={(e) => setEditPlaceholder(e.target.value)}
                      placeholder="e.g. Select your size..."
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Layout Width
                    </label>
                    <select
                      value={editSpan}
                      onChange={(e) => setEditSpan(Number(e.target.value) as 1 | 2)}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    >
                      <option value={1}>Half Width (1 Column)</option>
                      <option value={2}>Full Width (2 Columns)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Hint Text (optional)
                  </label>
                  <input
                    type="text"
                    value={editHint}
                    onChange={(e) => setEditHint(e.target.value)}
                    placeholder="e.g. Please provide a clear and active email"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--text-primary)",
                      marginTop: "0.25rem",
                    }}
                  />
                </div>

                {/* Conditional Visibility Option for Editing */}
                {formSchema.filter((f) => f.id !== editingFieldId && (f.type === "select" || f.type === "radio")).length > 0 && (
                  <div
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={editEnableCondition}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditEnableCondition(checked);
                          if (checked && !editConditionFieldId) {
                            const parents = formSchema.filter((f) => f.id !== editingFieldId && (f.type === "select" || f.type === "radio"));
                            if (parents.length > 0) {
                              setEditConditionFieldId(parents[0].id);
                              if (parents[0].options && parents[0].options.length > 0) {
                                setEditConditionValue(parents[0].options[0].value);
                              }
                            }
                          }
                        }}
                      />
                      Conditional Visibility: reveal this field only when a specific option is chosen (e.g. Duo)
                    </label>

                    {editEnableCondition && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.25rem" }}>
                        <div>
                          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                            Triggering Field
                          </label>
                          <select
                            value={editConditionFieldId}
                            onChange={(e) => {
                              const newFid = e.target.value;
                              setEditConditionFieldId(newFid);
                              const p = formSchema.find((f) => f.id === newFid);
                              if (p?.options && p.options.length > 0) {
                                setEditConditionValue(p.options[0].value);
                              }
                            }}
                            style={{
                              width: "100%",
                              padding: "0.45rem 0.65rem",
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                              color: "var(--text-primary)",
                              fontSize: "0.875rem",
                            }}
                          >
                            {formSchema
                              .filter((f) => f.id !== editingFieldId && (f.type === "select" || f.type === "radio"))
                              .map((pf) => (
                                <option key={pf.id} value={pf.id}>
                                  {pf.label} ({pf.id})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                            Reveal when value equals:
                          </label>
                          {(() => {
                            const selectedParent = formSchema.find((pf) => pf.id === editConditionFieldId);
                            if (selectedParent?.options && selectedParent.options.length > 0) {
                              return (
                                <select
                                  value={editConditionValue}
                                  onChange={(e) => setEditConditionValue(e.target.value)}
                                  style={{
                                    width: "100%",
                                    padding: "0.45rem 0.65rem",
                                    background: "var(--surface)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--radius-sm)",
                                    color: "var(--text-primary)",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  {selectedParent.options.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label} ({opt.value})
                                    </option>
                                  ))}
                                </select>
                              );
                            }
                            return (
                              <input
                                type="text"
                                value={editConditionValue}
                                onChange={(e) => setEditConditionValue(e.target.value)}
                                placeholder="e.g. duo"
                                style={{
                                  width: "100%",
                                  padding: "0.45rem 0.65rem",
                                  background: "var(--surface)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "var(--radius-sm)",
                                  color: "var(--text-primary)",
                                  fontSize: "0.875rem",
                                }}
                              />
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editRequired}
                      onChange={(e) => setEditRequired(e.target.checked)}
                    />
                    Field is Required
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editPanelVisible}
                      onChange={(e) => setEditPanelVisible(e.target.checked)}
                    />
                    Show in Panel View
                  </label>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => setEditingFieldId(null)}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

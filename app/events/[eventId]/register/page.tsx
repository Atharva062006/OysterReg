"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getEventById,
  submitEventRegistration,
  Event,
} from "@/lib/firebase";
import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import styles from "@/app/register/register.module.css";

interface EventRegisterPageProps {
  params: Promise<{ eventId: string }>;
}

export default function EventRegisterPage({ params }: EventRegisterPageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    try {
      const ev = await getEventById(eventId);
      setEvent(ev);
    } catch {
      setSubmitError("Failed to load event registration form.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  function handleChange(fieldId: string, value: any) {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => ({ ...prev, [fieldId]: undefined }));
  }

  function validate(): Record<string, string> {
    if (!event) return {};
    const e: Record<string, string> = {};

    event.formSchema.forEach((field) => {
      const val = formData[field.id];
      if (field.required) {
        if (val === undefined || val === null || String(val).trim() === "") {
          e[field.id] = `${field.label} is required.`;
        }
      }
      if (field.type === "email" && val) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
          e[field.id] = "Enter a valid email address.";
        }
      }
      if (field.type === "tel" && val) {
        if (!/^\d{10}$/.test(String(val).replace(/\s/g, ""))) {
          e[field.id] = "Enter a valid 10-digit phone number.";
        }
      }
    });

    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      await submitEventRegistration(eventId, formData);
      router.push("/success");
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit registration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.main}>
        <div className={styles.container} style={{ textAlign: "center", padding: "4rem 0" }}>
          <p style={{ color: "var(--text-secondary)" }}>Loading registration form…</p>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className={styles.main}>
        <div className={styles.container} style={{ textAlign: "center", padding: "4rem 0" }}>
          <h1 className={styles.title}>Event Not Found</h1>
          <p className={styles.subtitle}>The requested event registration form does not exist or has been removed.</p>
        </div>
      </main>
    );
  }

  // Registrations Closed Gate
  if (!event.registrationOpen) {
    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.logoRow}>
              <Image src="/logo4.png" alt="Oyster Kode Club" width={40} height={40} />
              <div className={styles.clubTag}>Oyster Kode Club</div>
            </div>
            <h1 className={styles.title}>{event.name}</h1>
          </header>
          <div
            style={{
              background: "var(--surface)",
              border: "1.5px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "3rem 2rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔒</div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text-primary)" }}>
              Registrations Closed
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", maxWidth: "460px", margin: "0 auto 1.5rem" }}>
              {event.closedMessage || "Registrations for this event are currently closed. Please reach out to Oyster Kode Club for details."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.logoRow}>
            <Image src="/logo4.png" alt="Oyster Kode Club" width={40} height={40} />
            <div className={styles.clubTag}>Oyster Kode Club</div>
          </div>
          <h1 className={styles.title}>{event.name}</h1>
          <p className={styles.subtitle}>
            {event.description || "Fill out the form below to apply. We look forward to seeing your submission."}
          </p>
        </header>

        {/* Dynamic Form */}
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <DynamicFormRenderer
            schema={event.formSchema}
            formData={formData}
            errors={errors}
            onChange={handleChange}
          />

          {submitError && (
            <div className={styles.submitError} role="alert">
              {submitError}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="submit"
              id="submit-btn"
              disabled={submitting}
              className={`btn btn-primary ${styles.submitBtn}`}
            >
              {submitting ? "Submitting Application..." : "Submit Application"}
            </button>
            <p className={styles.disclaimer}>
              Your information will only be used for {event.name} selection & organization purposes.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}

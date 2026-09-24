"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getActiveEvent,
  submitEventRegistration,
  checkRegistrationExists,
  Event,
  isFieldVisible,
} from "@/lib/firebase";
import { loadRazorpayScript } from "@/lib/razorpay";
import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import styles from "./register.module.css";

export default function RegistrationPage() {
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadActiveEvent = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const active = await getActiveEvent();
      setEvent(active);
    } catch (err) {
      console.error(err);
      setLoadError("Unable to load the registration form. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActiveEvent();
  }, [loadActiveEvent]);

  // Compute the currently applicable registration fee based on the selected option.
  const currentFee = useMemo(() => {
    if (!event?.razorpayEnabled) return 0;
    if (event.pricingType === "dynamic" && event.pricingFieldId) {
      const field = event.formSchema?.find((f) => f.id === event.pricingFieldId);
      const opt = field?.options?.find((o) => o.value === formData[event.pricingFieldId!]);
      return opt?.price ?? 0;
    }
    return event.registrationFee ?? 0;
  }, [event, formData]);

  const isPaidEvent = !!event?.razorpayEnabled && (
    event.pricingType === "dynamic" ? !!event.pricingFieldId : (event.registrationFee ?? 0) > 0
  );

  function handleChange(fieldId: string, value: any) {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => ({ ...prev, [fieldId]: undefined }));
  }

  function validate(): Record<string, string> {
    if (!event) return {};
    const e: Record<string, string> = {};

    event.formSchema.forEach((field) => {
      if (!isFieldVisible(field, formData)) return;
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
      const firstErrorField = document.querySelector("[aria-invalid], [role='alert']");
      firstErrorField?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!event) return;
    setSubmitting(true);
    setSubmitError("");

    const isPaidEvent = !!event.razorpayEnabled && (event.registrationFee || 0) > 0 || (event.pricingType === "dynamic" && !!event.pricingFieldId);

    // For dynamic pricing, validate the pricing field selection has a configured price
    if (event.razorpayEnabled && event.pricingType === "dynamic" && event.pricingFieldId) {
      const pricingField = event.formSchema?.find((f) => f.id === event.pricingFieldId);
      const selectedValue = formData[event.pricingFieldId!];
      const selectedOpt = pricingField?.options?.find((o) => o.value === selectedValue);
      if (!selectedOpt || typeof selectedOpt.price !== "number" || selectedOpt.price <= 0) {
        setSubmitError(`Please select a valid option for "${pricingField?.label ?? event.pricingFieldId}" before proceeding.`);
        setSubmitting(false);
        return;
      }
    }

    // Free event path: proceed straight to submission
    if (!isPaidEvent) {
      try {
        await submitEventRegistration(event.id, formData);
        if (event.whatsappGroupLink) {
          router.push(`/success?whatsapp=${encodeURIComponent(event.whatsappGroupLink)}`);
        } else {
          router.push("/success");
        }
      } catch (err: any) {
        setSubmitError(err.message || "Something went wrong. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Paid event path: Create Razorpay order, open modal, verify, then submit
    try {
      // ── Pre-payment duplicate check ──────────────────────────────────────
      // Check BEFORE charging the card so money is never taken from someone
      // who is already registered (same roll number / email).
      const alreadyRegistered = await checkRegistrationExists(event.id, formData);
      if (alreadyRegistered) {
        const identifier = formData.rollNumber || formData.email || "your identifier";
        setSubmitError(
          `A registration already exists for "${identifier}" in this event. ` +
          `If you believe this is a mistake, please contact the organizers.`
        );
        setSubmitting(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load Razorpay payment gateway. Please check your internet connection.");
      }

      // Step 1: Create Order on server
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          // Pass selected option so server can resolve the correct price
          selectedOption: event.pricingFieldId ? formData[event.pricingFieldId] : undefined,
          receipt: `rcpt_${event.id.slice(0, 8)}_${(formData.rollNumber || formData.email || Date.now()).toString().replace(/[^a-zA-Z0-9]/g, "_")}`,
          notes: {
            name: formData.name || "",
            email: formData.email || "",
            phone: formData.phone || "",
          },
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || "Failed to initialize payment.");
      }

      // Step 2: Open Razorpay Checkout modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Oyster Kode Club",
        description: `Registration for ${event.name}`,
        image: "/logo4.png",
        order_id: orderData.orderId,
        prefill: {
          name: formData.name || "",
          email: formData.email || "",
          contact: formData.phone || "",
        },
        theme: {
          color: "#f5a623",
        },
        handler: async function (response: any) {
          try {
            // Step 3: Verify payment signature on server
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.verified) {
              throw new Error(verifyData.error || "Payment verification failed. Please contact admin if amount was deducted.");
            }

            // Step 4: Record registration in Firestore with payment details
            await submitEventRegistration(event.id, formData, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              // Use the server-resolved fee (not a client-supplied value)
              paymentAmount: orderData.resolvedFee ?? event.registrationFee,
              paymentStatus: "paid",
            });

            // Step 5: Redirect to success with WhatsApp group link
            if (event.whatsappGroupLink) {
              router.push(`/success?whatsapp=${encodeURIComponent(event.whatsappGroupLink)}`);
            } else {
              router.push("/success");
            }
          } catch (err: any) {
            console.error(err);
            setSubmitError(err.message || "Payment verified but registration could not be saved. Please contact support.");
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
            setSubmitError("Payment process was cancelled. You can try again when ready.");
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setSubmitting(false);
        setSubmitError(`Payment failed: ${response.error?.description || "Unknown error"}. Please try again.`);
      });
      rzp.open();
    } catch (err: any) {
      setSubmitting(false);
      setSubmitError(err.message || "Failed to proceed to payment.");
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

  if (loadError) {
    return (
      <main className={styles.main}>
        <div className={styles.container} style={{ textAlign: "center", padding: "4rem 0" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
          <h1 className={styles.title}>Connection Issue</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", maxWidth: "460px", margin: "0 auto 1.5rem" }}>
            {loadError}
          </p>
          <button onClick={loadActiveEvent} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className={styles.main}>
        <div className={styles.container} style={{ textAlign: "center", padding: "4rem 0" }}>
          <h1 className={styles.title}>No Active Registration</h1>
          <p className={styles.subtitle}>There are currently no active registrations open.</p>
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
              {event.closedMessage || "Registrations for this event are currently closed. We will reach out when new opportunities open!"}
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
            {event.description || "Fill out the form below to apply. We will reach out to shortlisted candidates with details."}
          </p>
          {event.razorpayEnabled && (
            <div className={styles.feeBadge}>
              <span>💳</span>
              <span>
                {isPaidEvent && currentFee > 0
                  ? `Registration Fee: ₹${currentFee}`
                  : event.pricingType === "dynamic"
                  ? "Select your entry type to see the fee"
                  : "Registration Fee: ₹" + (event.registrationFee ?? 0)}
              </span>
            </div>
          )}
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
              {submitting
                ? isPaidEvent && currentFee > 0
                  ? "Processing Payment..."
                  : "Submitting Application..."
                : isPaidEvent && currentFee > 0
                ? `Pay ₹${currentFee} & Register`
                : isPaidEvent && currentFee === 0 && event?.pricingType === "dynamic"
                ? "Select entry type to pay & register"
                : "Submit Application"}
            </button>
            <p className={styles.disclaimer}>
              Your information will only be used for selection & organization purposes.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}

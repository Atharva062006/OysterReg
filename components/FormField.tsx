"use client";

import { useState } from "react";
import styles from "./FormField.module.css";

interface Option {
  value: string;
  label: string;
}

interface FormFieldProps {
  id: string;
  label: string;
  type?: "text" | "number" | "email" | "tel" | "url" | "textarea" | "select" | "radio" | "checkbox" | "file";
  options?: Option[];
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}

export default function FormField({
  id,
  label,
  type = "text",
  options = [],
  required = false,
  placeholder,
  value,
  onChange,
  error,
  hint,
}: FormFieldProps) {
  const inputId = `field-${id}`;
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError("Please upload a valid PDF file.");
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) { // 2MB
      setUploadError("File size must be less than 2MB.");
      return;
    }

    setUploading(true);
    setUploadError("");
    
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      setUploadError("Cloudinary configuration missing. Check .env.local");
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/upload`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          onChange(response.secure_url);
        } else {
          setUploadError("Upload failed. Please try again.");
        }
        setUploading(false);
      };

      xhr.onerror = () => {
        setUploadError("Network error occurred during upload.");
        setUploading(false);
      };

      xhr.send(formData);
    } catch (err) {
      console.error(err);
      setUploadError("An error occurred during upload.");
      setUploading(false);
    }
  };

  return (
    <div className={styles.field}>
      <label htmlFor={type !== "radio" ? inputId : undefined} className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>

      {hint && <p className={styles.hint}>{hint}</p>}

      {type === "textarea" && (
        <textarea
          id={inputId}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={error ? styles.inputError : ""}
        />
      )}

      {type === "select" && (
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={error ? styles.inputError : ""}
        >
          <option value="">Select an option</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {type === "radio" && (
        <div className={styles.radioGroup} role="radiogroup" aria-labelledby={`${inputId}-legend`}>
          <span id={`${inputId}-legend`} className="visually-hidden">{label}</span>
          {options.map((opt) => (
            <label key={opt.value} className={styles.radioLabel}>
              <input
                type="radio"
                name={id}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className={styles.radioInput}
              />
              <span className={styles.radioMark} />
              {opt.label}
            </label>
          ))}
        </div>
      )}

      {type === "file" && (
        <div className={styles.fileUploadContainer}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <label 
              htmlFor={inputId}
              className="btn btn-outline"
              style={{ cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              {uploading ? "Uploading..." : "Select PDF File"}
            </label>
            {value && !uploading && (
              <span style={{ fontSize: "0.875rem", color: "#22c55e", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                ✓ Uploaded
              </span>
            )}
          </div>
          <input
            id={inputId}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: "none" }}
            aria-describedby={error || uploadError ? `${inputId}-error` : undefined}
          />
          {uploading && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }} />
              <span className={styles.progressText}>Uploading... {uploadProgress}%</span>
            </div>
          )}
          {value && !uploading && (
            <div className={styles.fileSuccess}>
              <a href={value} target="_blank" rel="noopener noreferrer">View Uploaded PDF</a>
            </div>
          )}
        </div>
      )}

      {type !== "textarea" && type !== "select" && type !== "radio" && type !== "file" && (
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={error ? styles.inputError : ""}
        />
      )}

      {(error || uploadError) && (
        <p id={`${inputId}-error`} className={styles.error} role="alert">
          {error || uploadError}
        </p>
      )}
    </div>
  );
}

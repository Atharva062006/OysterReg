"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AdminNav.module.css";

interface EventAdminNavProps {
  eventId: string;
  eventName?: string;
}

export default function EventAdminNav({ eventId, eventName }: EventAdminNavProps) {
  const pathname = usePathname();

  // Group 1: Day-to-Day Operations & Candidate Pipeline (Dedicated pages)
  const operationItems = [
    { href: `/admin/events/${eventId}`, label: "Overview", isExact: true },
    { href: `/admin/events/${eventId}/aptitude`, label: "Aptitude Review" },
    { href: `/admin/events/${eventId}/interview`, label: "Interview & Panels" },
    { href: `/admin/events/${eventId}/selected`, label: "Selected Candidates" },
    { href: `/admin/events/${eventId}/candidates`, label: "All Applicants", isExact: true },
  ];

  // Group 2: Event Building, Schema & Settings
  const builderItems = [
    { href: `/admin/events/${eventId}/form`, label: "Form Builder" },
    { href: `/admin/events/${eventId}/stages`, label: "Stage Pipeline Builder" },
    { href: `/admin/events/${eventId}/panels`, label: "Interviewer Panels Setup" },
    { href: `/admin/events/${eventId}/settings`, label: "Event Settings & Controls" },
  ];

  return (
    <div className={styles.navContainer}>
      {/* Tier 1: Candidate Process & Management */}
      <div className={styles.navGroup}>
        <Link href="/admin" className={styles.link} style={{ opacity: 0.8, marginRight: "0.5rem" }}>
          ← All Events
        </Link>

        <span className={styles.groupTag}>Process</span>

        {operationItems.map(({ href, label, isExact }) => {
          const isActive = isExact ? pathname === href : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`${styles.link} ${isActive ? styles.active : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Tier 2: Event Builder & Configuration */}
      <div className={`${styles.navGroup} ${styles.navGroupSub}`}>
        <span className={`${styles.groupTag} ${styles.groupTagSetup}`}>Event Builder</span>

        {builderItems.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`${styles.link} ${isActive ? styles.active : ""}`}
              aria-current={isActive ? "page" : undefined}
              style={{ fontSize: "0.8125rem" }}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

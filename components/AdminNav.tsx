"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AdminNav.module.css";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/aptitude", label: "Aptitude" },
  { href: "/admin/interview", label: "Interview" },
  { href: "/admin/selected", label: "Selected" },
  { href: "/admin/panels", label: "Panels" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Admin pipeline navigation">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive =
          href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`${styles.link} ${isActive ? styles.active : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {label}
            {isActive && <span className={styles.indicator} />}
          </Link>
        );
      })}
    </nav>
  );
}

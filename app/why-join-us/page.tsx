"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./why-join-us.module.css";
import { ImageGallery, GalleryItem } from "@/components/ui/image-gallery";
import { CircularTestimonials, PlacementTestimonial } from "@/components/ui/circular-testimonials";

// Slow & smooth scroll-reveal wrapper component
function ScrollRevealSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.08 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`${className} transition-all duration-1000 ease-out ${
        isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-[0.98]"
      }`}
    >
      {children}
    </div>
  );
}

// SVG Icon components
function TerminalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="4 17 10 11 4 5"></polyline>
      <line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>
  );
}

function CodeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
  );
}

function CompassIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"></circle>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
    </svg>
  );
}

function AwardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="7"></circle>
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
    </svg>
  );
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
    </svg>
  );
}

function RocketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-3.05 11a22.35 22.35 0 0 1-3.95 2z"></path>
    </svg>
  );
}

interface ClubEvent {
  id: string;
  isHero?: boolean;
  title: string;
  category: string;
  stat?: string;
  icon: React.ElementType;
  description: string;
  image: string;
}

const EVENTS: ClubEvent[] = [
  {
    id: "code-404",
    isHero: true,
    title: "Code 404",
    category: "Flagship Tech Hunt",
    stat: "Logic & Debugging",
    icon: TerminalIcon,
    description:
      "Code 404 was an intense tech hunt & problem-solving challenge organized by Oyster Kode Club, testing logical reasoning, debugging precision, and rapid coding skills in an exhilarating timed format.",
    image: "/photos/Code_404.jpg",
  },
  {
    id: "c-marathon",
    title: "C Marathon",
    category: "Bootcamp Series",
    stat: "160+ Participants",
    icon: CodeIcon,
    description:
      "C Marathon is Oyster Kode Club's beginner-friendly C programming bootcamp for first-year students of RIT. With 160+ participants, it offered hands-on coding sessions to build a strong foundation in C programming and problem-solving.",
    image: "/photos/C_marathon_1.jpg",
  },
  {
    id: "domainophile",
    title: "Domainophile",
    category: "Domain Exploration",
    stat: "140+ Participants",
    icon: CompassIcon,
    description:
      "Domainophile is Oyster Kode Club's domain exploration event for RIT students, helping them explore various technical fields through expert guidance and interactive sessions. The event witnessed 140+ participants.",
    image: "/photos/Domainophile.jpg",
  },
  {
    id: "codechef-collab",
    title: "CodeChef Collaboration",
    category: "Competitive Programming",
    stat: "Global Exposure",
    icon: AwardIcon,
    description:
      "CodeChef Collaboration: Oyster Kode Club proudly collaborated with CodeChef to organize coding events and promote competitive programming. This partnership provided students with industry-recognized exposure, challenging contests, and valuable learning opportunities.",
    image: "/photos/CodeChef_Collaboration.jpg",
  },
  {
    id: "panel-discussion",
    title: "Panel Discussion",
    category: "Mentorship & Guidance",
    stat: "Placed Senior Students",
    icon: UsersIcon,
    description:
      "Panel Discussion: An interactive discussion session with our placed senior students, sharing career roadmaps, interview preparation strategies, placement insights, and real-world software engineering guidance.",
    image: "/photos/Panel_Discussion.jpg",
  },
];

const HIGHLIGHT_ITEMS: GalleryItem[] = [
  {
    id: "h-1",
    src: "/photos/1.jpg",
    aspectRatio: 16 / 10,
    alt: "Event Highlight 1",
  },
  {
    id: "h-2",
    src: "/photos/2.jpg",
    aspectRatio: 16 / 10,
    alt: "Event Highlight 2",
  },
  {
    id: "h-3",
    src: "/photos/3.jpg",
    aspectRatio: 16 / 10,
    alt: "Event Highlight 3",
  },
  {
    id: "h-4",
    src: "/photos/4.jpg",
    aspectRatio: 16 / 10,
    alt: "Event Highlight 4",
  },
  {
    id: "h-5",
    src: "/photos/5.jpg",
    aspectRatio: 16 / 10,
    alt: "Event Highlight 5",
  },
  {
    id: "h-6",
    src: "/photos/6.png",
    aspectRatio: 16 / 10,
    alt: "Event Highlight 6",
  },
];

const PLACED_STUDENTS: PlacementTestimonial[] = [
  {
    name: "Shubham Ugalmogale",
    companyName: "Cognizant",
    src: "/photos/Shubham_Ugalmogale.jpeg",
  },
  {
    name: "Jaid Mulla",
    companyName: "Bridgenext",
    src: "/photos/Javed_Mulla.jpeg",
  },
  {
    name: "Aryan Sutar",
    companyName: "Zensar",
    src: "/photos/Aryan_Sutar.jpeg",
  },
  {
    name: "Vinayak Patil",
    companyName: "Cognizant",
    src: "/photos/Vinayak_Patil.jpeg",
  },
  {
    name: "Aryan Mali",
    companyName: "Cognizant",
    src: "/photos/Aryan_Mali.jpeg",
  },
  {
    name: "Pranav Desai",
    companyName: "Xperate",
    src: "/photos/Pranav_Desai.jpeg",
  },
  {
    name: "Harshal Kumbhar",
    companyName: "Rsquaresoft",
    src: "/photos/Harshal.jpeg",
  },
  {
    name: "Meet Bhandari",
    companyName: "Rsquaresoft",
    src: "/photos/Meet_Bhandari.jpeg",
  },
  {
    name: "Chaitanya Nikam",
    companyName: "Rsquaresoft",
    src: "/photos/Chaitanya_Nikam.jpeg",
  },
  {
    name: "Tanaya Shinde",
    companyName: "Atlas Copco",
    src: "/photos/Tanaya_Shinde.jpeg",
  },
];

const REASONS = [
  {
    icon: "💻",
    title: "Build Real Projects",
    description:
      "Work on production-grade apps and open-source tools that solve real problems — not just academic exercises.",
  },
  {
    icon: "🤝",
    title: "Collaborate & Grow",
    description:
      "Pair-program with talented peers, get code reviews, and level up your skills through hands-on collaboration.",
  },
  {
    icon: "🏆",
    title: "Win Hackathons",
    description:
      "We compete in national and international hackathons. Oyster members have consistently ranked on podiums.",
  },
  {
    icon: "🚀",
    title: "Mentorship Network",
    description:
      "Get guidance from alumni who are now at top companies and startups — your network starts here.",
  },
];

export default function WhyJoinUsPage() {
  return (
    <main className={styles.main}>
      <div className={styles.glowOverlay} aria-hidden="true" />

      <div className={styles.inner}>
        {/* Back link */}
        <Link href="/" className={styles.backLink} id="back-home">
          ← Back to home
        </Link>

        {/* Header (Preserved exactly as requested) */}
        <header className={styles.header}>
          <div className={styles.logoRow}>
            <Image src="/logo4.png" alt="Oyster Kode Club" width={40} height={40} />
            <span className={styles.clubLabel}>Oyster Kode Club</span>
          </div>
          <h1 className={styles.headline}>
            Why join{" "}
            <span className={styles.headlineGradient}>Oyster?</span>
          </h1>
          <p className={styles.subtitle}>
            We are more than a coding club — we are a launchpad for the next generation of builders.
          </p>
        </header>

        {/* Major Events Bento Spotlight Grid (Non-interactive display) */}
        <section className="flex flex-col gap-6" aria-label="Our Achievements and Major Events">
          <ScrollRevealSection>
            <div className={styles.sectionHeader}>
              <div className="inline-flex items-center text-xs font-extrabold uppercase tracking-wider text-amber-400">
                Club Milestones
              </div>
              <h2 className={styles.sectionTitle}>Major Events & Achievements</h2>
              <p className={styles.sectionDesc}>
                Explore our flagship hackathons, programming bootcamps, domain workshops, and industry collaborations.
              </p>
            </div>
          </ScrollRevealSection>

          <div className={styles.bentoGrid}>
            {EVENTS.map((evt, idx) => {
              return (
                <ScrollRevealSection key={evt.id} delay={idx * 120} className={evt.isHero ? styles.bentoHeroCard : ""}>
                  <div className={styles.eventBentoCard}>
                    <div className={styles.imageBanner}>
                      <img
                        src={evt.image}
                        alt={evt.title}
                        className={styles.eventImage}
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://placehold.co/1200x800/18181b/ffffff?text=${encodeURIComponent(evt.title)}`;
                        }}
                      />
                    </div>

                    <div className={styles.cardContent}>
                      <div className={styles.cardTitleRow}>
                        <h3 className={styles.cardTitle}>{evt.title}</h3>
                      </div>
                      <p className={styles.cardDesc}>{evt.description}</p>
                    </div>
                  </div>
                </ScrollRevealSection>
              );
            })}
          </div>
        </section>

        {/* Event Highlights Photo Showcase (Non-interactive clean gallery) */}
        <ScrollRevealSection delay={200}>
          <section className="flex flex-col gap-4" aria-label="Event Highlights Photo Gallery">
            <div className={styles.sectionHeader}>
              <div className="inline-flex items-center text-xs font-extrabold uppercase tracking-wider text-rose-400">
                Photo Showcase
              </div>
              <h2 className={styles.sectionTitle}>Event Highlights</h2>
              <p className={styles.sectionDesc}>
                Past event photos and tech session highlights.
              </p>
            </div>

            <div className={styles.marqueeBox}>
              <ImageGallery items={HIGHLIGHT_ITEMS} />
            </div>
          </section>
        </ScrollRevealSection>

        {/* Proud Placements Student Showcase */}
        <ScrollRevealSection delay={200}>
          <section className="flex flex-col gap-4" aria-label="Proud Placements Showcase">
            <div className={styles.sectionHeader}>
              <div className="inline-flex items-center text-xs font-extrabold uppercase tracking-wider text-amber-400">
                Success Stories
              </div>
              <h2 className={styles.sectionTitle}>Proud Placements</h2>
              <p className={styles.sectionDesc}>
                Celebrating our talented Oyster Kode Club members placed in leading tech companies and global engineering teams.
              </p>
            </div>

            <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-4 md:p-8 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CircularTestimonials
                testimonials={PLACED_STUDENTS}
                autoplay={true}
                colors={{
                  name: "#ffffff",
                  company: "#f5a623",
                  arrowBackground: "#18181b",
                  arrowForeground: "#ffffff",
                  arrowHoverBackground: "#f5a623",
                }}
              />
            </div>
          </section>
        </ScrollRevealSection>

        {/* Core Pillars / Reasons */}
        <ScrollRevealSection delay={150}>
          <section className="flex flex-col gap-4" aria-label="Reasons to join">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>What You Get</h2>
            </div>
            <div className={styles.reasonsGrid}>
              {REASONS.map((r) => (
                <div key={r.title} className={styles.reasonCard}>
                  <span className={r.icon} aria-hidden="true">
                    {r.icon}
                  </span>
                  <h3 className={r.title}>{r.title}</h3>
                  <p className={r.description}>{r.description}</p>
                </div>
              ))}
            </div>
          </section>
        </ScrollRevealSection>

        {/* CTA (Only interactive action button) */}
        <ScrollRevealSection delay={200}>
          <div className={styles.cta}>
            <p className={styles.ctaText}>Ready to be part of something great?</p>
            <Link href="/register" id="wju-register-cta" className={styles.ctaBtn}>
              Apply Now →
            </Link>
          </div>
        </ScrollRevealSection>
      </div>
    </main>
  );
}

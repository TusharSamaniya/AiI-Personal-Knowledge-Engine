import { useRef } from "react";
import { motion, useInView } from "framer-motion";

/* ------------------------------------------------------------------ *
 *  CONTENT – edit links / text here
 * ------------------------------------------------------------------ */
const BRAND = "AI Personal Knowledge Engine";
const TAGLINE = "Your knowledge. Always available.";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Chat", href: "#how-it-works" },
      { label: "Upload", href: "#integrations" },
      { label: "Integrations", href: "#integrations" },
      { label: "Quiz & Flashcards", href: "#features" },
      { label: "Analytics", href: "#features" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "For Students", href: "#solutions" },
      { label: "For Teachers", href: "#solutions" },
      { label: "For HR Teams", href: "#solutions" },
      { label: "For Dev Teams", href: "#solutions" },
      { label: "For Organisations", href: "#solutions" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "Contact Us", href: "#connect" },
      { label: "Support", href: "#" },
      { label: "Documentation", href: "#" },
      { label: "Status Page", href: "#" },
    ],
  },
];

const SOCIALS = [
  {
    label: "LinkedIn",
    href: "#",
    paths: [
      "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z",
      "M2 9h4v12H2z",
      "M4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
    ],
  },
  {
    label: "Twitter / X",
    href: "#",
    paths: ["M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"],
  },
  {
    label: "GitHub",
    href: "#",
    paths: [
      "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4",
      "M9 18c-4.51 2-5-2-7-2",
    ],
  },
  {
    label: "YouTube",
    href: "#",
    paths: [
      "M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17",
      "m10 15 5-3-5-3z",
    ],
  },
];

/* ---------- animation variants ---------- */
const footerVariants = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};
const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};
const colVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

function Marquee({ playing }) {
  // one "group" = the brand repeated; two identical groups => seamless infinite loop
  const group = (hidden) => (
    <div className="ft__marquee-group" aria-hidden={hidden || undefined}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="ft__marquee-item">
          {BRAND}
          <span className="ft__marquee-sep">✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="ft__marquee" role="presentation">
      <div className={`ft__marquee-track ${playing ? "" : "is-paused"}`}>
        {group(false)}
        {group(true)}
      </div>
    </div>
  );
}

function Social({ s }) {
  return (
    <motion.a
      href={s.href}
      aria-label={s.label}
      className="ft__social"
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {s.paths.map((d, i) => <path key={i} d={d} />)}
      </svg>
    </motion.a>
  );
}

export default function Footer() {
  const footerRef = useRef(null);
  const inView = useInView(footerRef, { amount: 0.05 }); // marquee only runs while the footer is on screen


  return (
    <motion.footer
      id="connect"
      ref={footerRef}
      className="ft"
      variants={footerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
    >
      <div className="ft__glow" aria-hidden="true" />

      {/* ---------- top zone: giant scrolling brand text ---------- */}
      <div className="ft__top">
        <Marquee playing={inView} />
      </div>

      {/* ---------- bottom zone: links ---------- */}
      <div className="ft__inner">
        <motion.div
          className="ft__grid"
          variants={gridVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.div className="ft__brand" variants={colVariants}>
            <a href="#home" className="ft__logo">
              <span className="ft__logo-mark" aria-hidden="true" />
              AIPKE
            </a>
            <p className="ft__tagline">{TAGLINE}</p>
            <div className="ft__socials">
              {SOCIALS.map((s) => <Social key={s.label} s={s} />)}
            </div>
          </motion.div>

          {COLUMNS.map((col) => (
            <motion.nav key={col.title} className="ft__col" variants={colVariants} aria-label={col.title}>
              <h4 className="ft__heading">{col.title}</h4>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <motion.a
                      href={l.href}
                      className="ft__link"
                      whileHover={{ x: 5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      {l.label}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </motion.nav>
          ))}
        </motion.div>

        {/* ---------- bottom bar ---------- */}
        <div className="ft__bar">
          <p>© {new Date().getFullYear()} {BRAND}. All rights reserved.</p>
          <p>Made with <span className="ft__heart" aria-label="love">❤️</span> in India by Tushar Samaniya</p>
        </div>
      </div>
    </motion.footer>
  );
}

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

/* ================================================================== *
 *  CONTENT – edit your details / image here
 * ================================================================== */
const HERO_IMG =
  "https://i.pinimg.com/1200x/60/f1/32/60f13232dc383a500edc795d9f06b4b3.jpg";

const EMAIL = "tusharsamaniya.me@gmail.com";
const PHONE = "+91 8882418916";
const LINKEDIN = "https://www.linkedin.com/in/tushar-samaniya-4b69b1290/";
const GITHUB = "https://github.com/TusharSamaniya";

// Optional: set VITE_CONTACT_ENDPOINT (e.g. a Formspree URL) to POST the form as JSON.
// If it is empty, "Send Message" opens the visitor's mail app addressed to EMAIL.
const ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT || "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- small helpers ---------- */
function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -80px 0px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

// Hash links drive the page switch, so in-page jumps scroll instead of changing the hash.
const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy method */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const Icon = ({ children }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const MailIcon = () => (
  <Icon>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 6L2 7" />
  </Icon>
);
const PhoneIcon = () => (
  <Icon>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </Icon>
);
const LinkedInIcon = () => (
  <Icon>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <path d="M2 9h4v12H2z" />
    <path d="M4 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
  </Icon>
);
const GitHubIcon = () => (
  <Icon>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </Icon>
);

/* ---------- HERO ---------- */
function HeroImage() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="ct-hero__frame">
      {failed ? (
        <div className="ct-ph">Contact illustration</div>
      ) : (
        <img
          src={HERO_IMG}
          alt="Get in touch"
          loading="eager"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function Hero() {
  return (
    <section className="ct-hero">
      <div className="ct-hero__glow" />
      <div className="ct-wrap ct-hero__grid">
        <motion.div
          className="ct-hero__text"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="ct-eyebrow">CONTACT US</p>
          <h1 className="ct-h1">
            Let’s talk about
            <br /> your knowledge goals.
          </h1>
          <p className="ct-hero__sub">
            Have a question, an idea or want to work together? Send a message below or reach out
            directly — I read every message and reply as soon as I can.
          </p>
          <div className="ct-hero__btns">
            <button type="button" className="ct-btn ct-btn--primary" onClick={() => scrollToId("contact-me")}>
              Send a message
            </button>
            <button type="button" className="ct-btn ct-btn--ghost" onClick={() => scrollToId("get-in-touch")}>
              Get in touch
            </button>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
        >
          <HeroImage />
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- CONTACT ME (form) ---------- */
function ContactMe() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(null); // { type: "ok" | "err", text }
  const [sending, setSending] = useState(false);

  const hasText = email || subject || message;

  const onDelete = () => {
    setEmail("");
    setSubject("");
    setMessage("");
    setStatus(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const em = email.trim();
    const sub = subject.trim();
    const msg = message.trim();

    if (!EMAIL_RE.test(em)) return setStatus({ type: "err", text: "Please enter a valid email address." });
    if (!sub) return setStatus({ type: "err", text: "Please add a subject." });
    if (!msg) return setStatus({ type: "err", text: "Please write a message." });

    if (ENDPOINT) {
      setSending(true);
      setStatus(null);
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email: em, subject: sub, message: msg }),
        });
        if (!res.ok) throw new Error("Request failed");
        setStatus({ type: "ok", text: "Thanks! Your message has been sent." });
        setEmail("");
        setSubject("");
        setMessage("");
      } catch {
        setStatus({ type: "err", text: "Sorry, the message could not be sent. Please try again." });
      } finally {
        setSending(false);
      }
      return;
    }

    // No backend configured: open the visitor's mail app with everything filled in.
    const body = `${msg}\n\n— From: ${em}`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`;
    setStatus({ type: "ok", text: "Opening your email app to send the message…" });
  };

  return (
    <section className="ct-section" id="contact-me">
      <div className="ct-wrap">
        <Reveal className="ct-head">
          <p className="ct-eyebrow ct-center">SEND AN EMAIL</p>
          <h2 className="ct-h2">Contact Me</h2>
        </Reveal>

        <Reveal className="ct-formcard" delay={0.05}>
          <form onSubmit={onSubmit} noValidate>
            <label className="ct-field">
              <span>Enter Your Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <label className="ct-field">
              <span>Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What is this about?"
              />
            </label>
            <label className="ct-field">
              <span>Message</span>
              <textarea
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message here…"
              />
            </label>

            <div className="ct-actions">
              <button type="submit" className="ct-btn ct-btn--primary" disabled={sending}>
                {sending ? "Sending…" : "Send Message"}
              </button>
              <button type="button" className="ct-btn ct-btn--danger" onClick={onDelete} disabled={!hasText}>
                Delete
              </button>
            </div>

            <p className={`ct-status ${status ? `is-${status.type}` : ""}`} role="status" aria-live="polite">
              {status?.text}
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- GET IN TOUCH ---------- */
function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };
  return (
    <button
      type="button"
      className={`ct-copy ${copied ? "is-done" : ""}`}
      onClick={onClick}
      aria-label={`Copy ${label}`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function InfoRow({ icon, label, value, href }) {
  return (
    <div className="ct-row">
      <span className="ct-row__icon">{icon}</span>
      <div className="ct-row__text">
        <span className="ct-row__label">{label}</span>
        <a className="ct-row__value" href={href}>
          {value}
        </a>
      </div>
      <CopyButton value={value} label={label} />
    </div>
  );
}

function GetInTouch() {
  return (
    <section className="ct-section ct-section--alt" id="get-in-touch">
      <div className="ct-wrap ct-narrow">
        <Reveal className="ct-head">
          <p className="ct-eyebrow ct-center">REACH OUT</p>
          <h2 className="ct-h2">Get In Touch</h2>
        </Reveal>

        <Reveal delay={0.05}>
          <InfoRow icon={<MailIcon />} label="Email" value={EMAIL} href={`mailto:${EMAIL}`} />
          <InfoRow icon={<PhoneIcon />} label="Phone" value={PHONE} href={`tel:${PHONE.replace(/\s/g, "")}`} />

          <div className="ct-social">
            <a className="ct-social__btn" href={LINKEDIN} target="_blank" rel="noopener noreferrer">
              <span className="ct-row__icon">
                <LinkedInIcon />
              </span>
              <span className="ct-row__text">
                <span className="ct-row__label">LinkedIn</span>
                <span className="ct-row__value">tushar-samaniya</span>
              </span>
            </a>
            <a className="ct-social__btn" href={GITHUB} target="_blank" rel="noopener noreferrer">
              <span className="ct-row__icon">
                <GitHubIcon />
              </span>
              <span className="ct-row__text">
                <span className="ct-row__label">GitHub</span>
                <span className="ct-row__value">TusharSamaniya</span>
              </span>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== *
 *  PAGE
 * ================================================================== */
export default function ContactPage() {
  return (
    <div className="ct">
      <style>{CSS}</style>
      <Hero />
      <ContactMe />
      <GetInTouch />
    </div>
  );
}

/* ================================================================== *
 *  STYLES (white theme, scoped to .ct)
 * ================================================================== */
const CSS = `
.ct { --indigo:#6366F1; --indigo-d:#4f46e5; --ink:#0b0d12; --grey:#5b6478; --card:#f6f7fb; --alt:#f3f4fa;
  --line:rgba(11,13,18,.12); background:#fff; color:var(--ink); font-family:Inter,system-ui,sans-serif; overflow-x:hidden; }
.ct *, .ct *::before, .ct *::after { box-sizing:border-box; }
.ct-wrap { max-width:1200px; margin:0 auto; padding:0 28px; }
.ct-narrow { max-width:820px; }
.ct-center { text-align:center; }
.ct-eyebrow { color:var(--indigo); font:600 13px Inter,sans-serif; letter-spacing:.16em; text-transform:uppercase; margin-bottom:16px; }
.ct-h1 { font-size:clamp(34px,4.6vw,58px); line-height:1.1; font-weight:700; margin:0 0 24px; }
.ct-h2 { font-size:clamp(30px,3.6vw,46px); line-height:1.15; font-weight:700; margin:0; text-align:center; }

.ct-btn { display:inline-block; font:600 15px Inter,sans-serif; border-radius:999px; padding:13px 26px; cursor:pointer;
  border:1px solid transparent; text-decoration:none; text-align:center; transition:transform .2s, background .2s, border-color .2s, box-shadow .2s, opacity .2s; }
.ct-btn:hover:not(:disabled) { transform:translateY(-2px); }
.ct-btn:disabled { opacity:.45; cursor:not-allowed; }
.ct-btn--primary { background:var(--indigo); color:#fff; }
.ct-btn--primary:hover:not(:disabled) { background:var(--indigo-d); box-shadow:0 10px 26px -8px rgba(99,102,241,.55); }
.ct-btn--ghost { background:transparent; color:var(--ink); border-color:rgba(11,13,18,.35); }
.ct-btn--ghost:hover { border-color:var(--ink); background:rgba(11,13,18,.05); }
.ct-btn--danger { background:#fff; color:#dc2626; border-color:rgba(220,38,38,.45); }
.ct-btn--danger:hover:not(:disabled) { background:#fef2f2; border-color:#dc2626; }

/* hero */
.ct-hero { position:relative; padding:140px 0 70px; }
.ct-hero__glow { position:absolute; inset:0 0 auto 0; height:520px; pointer-events:none;
  background:radial-gradient(60% 70% at 70% 0%, rgba(99,102,241,.10), transparent 70%); }
.ct-hero__grid { position:relative; display:grid; grid-template-columns:1.05fr 1fr; gap:56px; align-items:center; }
.ct-hero__sub { color:var(--grey); font-size:18px; line-height:1.65; max-width:520px; margin:0 0 32px; }
.ct-hero__btns { display:flex; gap:14px; flex-wrap:wrap; }
.ct-hero__frame { border:1px solid var(--line); border-radius:20px; padding:12px; background:#fff;
  box-shadow:0 30px 80px -30px rgba(99,102,241,.30); }
.ct-hero__frame img { display:block; width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:12px; background:#eceef5; }
.ct-ph { aspect-ratio:4/3; border-radius:12px; display:flex; align-items:center; justify-content:center; color:var(--grey);
  background:linear-gradient(135deg,#eef0f8,#e1e5f2); font-size:14px; }

/* sections */
.ct-section { padding:80px 0; }
.ct-section--alt { background:var(--alt); }
.ct-head { margin-bottom:44px; }

/* form */
.ct-formcard { max-width:640px; margin:0 auto; background:#fff; border:1px solid var(--line); border-radius:20px; padding:32px;
  box-shadow:0 24px 60px -30px rgba(11,13,18,.18); }
.ct-field { display:block; margin-bottom:20px; }
.ct-field > span { display:block; font:600 14px Inter,sans-serif; margin-bottom:8px; }
.ct-field input, .ct-field textarea { width:100%; font:400 16px Inter,sans-serif; color:var(--ink); background:var(--card);
  border:1px solid var(--line); border-radius:12px; padding:13px 16px; outline:none; resize:vertical; transition:border-color .2s, box-shadow .2s, background .2s; }
.ct-field input::placeholder, .ct-field textarea::placeholder { color:#98a0b3; }
.ct-field input:focus, .ct-field textarea:focus { border-color:var(--indigo); background:#fff; box-shadow:0 0 0 4px rgba(99,102,241,.14); }
.ct-actions { display:flex; gap:14px; flex-wrap:wrap; margin-top:8px; }
.ct-actions .ct-btn { flex:1 1 160px; }
.ct-status { min-height:22px; margin:16px 0 0; font-size:14px; }
.ct-status.is-ok { color:#15803d; }
.ct-status.is-err { color:#dc2626; }

/* get in touch rows */
.ct-row { display:flex; align-items:center; gap:18px; background:#fff; border:1px solid var(--line); border-radius:16px;
  padding:20px 24px; margin-bottom:18px; box-shadow:0 6px 20px rgba(11,13,18,.05); }
.ct-row__icon { flex:none; width:54px; height:54px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  color:#fff; background:linear-gradient(135deg,#6366F1,#9333ea); }
.ct-row__text { display:flex; flex-direction:column; min-width:0; flex:1; }
.ct-row__label { color:var(--grey); font-size:14px; margin-bottom:2px; }
.ct-row__value { color:var(--ink); font-weight:700; font-size:18px; text-decoration:none; overflow-wrap:anywhere; }
a.ct-row__value:hover { color:var(--indigo-d); }
.ct-copy { flex:none; font:600 14px Inter,sans-serif; color:#fff; background:var(--indigo); border:0; border-radius:10px;
  padding:10px 20px; min-width:84px; cursor:pointer; transition:background .2s, transform .2s; }
.ct-copy:hover { background:var(--indigo-d); transform:translateY(-1px); }
.ct-copy.is-done { background:#16a34a; }

.ct-social { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
.ct-social__btn { display:flex; align-items:center; gap:16px; background:#fff; border:1px solid var(--line); border-radius:16px;
  padding:20px 24px; text-decoration:none; color:inherit; box-shadow:0 6px 20px rgba(11,13,18,.05); transition:transform .2s, box-shadow .2s, border-color .2s; }
.ct-social__btn:hover { transform:translateY(-3px); border-color:rgba(99,102,241,.55); box-shadow:0 18px 40px rgba(11,13,18,.12); }

@media (max-width:900px) {
  .ct-hero { padding-top:110px; }
  .ct-hero__grid { grid-template-columns:1fr; gap:36px; }
  .ct-section { padding:60px 0; }
}
@media (max-width:620px) {
  .ct-formcard { padding:22px; }
  .ct-social { grid-template-columns:1fr; }
  .ct-row { padding:16px; gap:14px; flex-wrap:wrap; }
  .ct-row__text { flex:1 1 60%; }
  .ct-copy { margin-left:68px; }
}
@media (prefers-reduced-motion:reduce) { .ct-btn, .ct-social__btn, .ct-copy { transition:none; } }
`;

import { useRef, useState, useEffect } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useScroll,
  useTransform,
} from "framer-motion";
import { useAuth } from "../context/AuthContext.jsx";

/* ================================================================== *
 *  IMAGES  – replace the URLs here whenever you like.
 *  If a URL fails to load, a labelled placeholder is shown instead.
 * ================================================================== */
const HERO_IMG = {
  students: { src: "https://i.pinimg.com/736x/a8/66/28/a866286ae426acaa0ccea1edaa99f593.jpg", label: "student studying laptop dark" },
  teachers: { src: "https://i.pinimg.com/1200x/23/79/4b/23794b1358a4876be9e9b8c70cd5cd8f.jpg", label: "teacher classroom modern" },
  orgs: { src: "https://i.pinimg.com/1200x/03/76/1b/03761bc4132e9de0eda6d16754a72039.jpg", label: "team office collaboration" },
};

// One image per block (shared by all three tabs, as provided). Labels differ per tab for the fallback.
const BLOCK_IMG = [
  "https://i.pinimg.com/736x/5a/6f/41/5a6f414206e6450d435afb6318667fd1.jpg",
  "https://i.pinimg.com/736x/38/5c/3f/385c3f4ddfe02ead4e581dd0a90886d3.jpg",
  "https://i.pinimg.com/736x/d8/da/2e/d8da2eb2fb079c0e044ee02380c218da.jpg",
  "https://i.pinimg.com/1200x/ef/25/29/ef2529628184bc31031c3957b19660b6.jpg",
];

/* ================================================================== *
 *  CONTENT
 * ================================================================== */
const TABS = [
  { key: "students", label: "Students", emoji: "🎓" },
  { key: "teachers", label: "Teachers", emoji: "👨‍🏫" },
  { key: "orgs", label: "Organisations", emoji: "🏢" },
];

const CONTENT = {
  students: {
    story: {
      icon: "cap",
      title: "Priya increased her exam score by 32% in just 3 weeks using AIPKE.",
      meta: "📍 Engineering Student · Mumbai, India",
      challenge:
        "Priya was uploading the same PDF to ChatGPT every single day before exams. She had no way to track which topics she was weak in or where to focus.",
      metrics: [
        { value: "32%", label: "score improvement" },
        { value: "3x", label: "faster revision" },
      ],
    },
    benefitsTitle: "Upload once. Study smarter. Score higher.",
    benefits: [
      { icon: "📚", title: "All your notes in one place", body: "Upload PDFs, paste YouTube links, add website URLs — every piece of your study material lives in one permanent project. No re-uploading ever again." },
      { icon: "🧠", title: "AI that actually knows your syllabus", body: "Ask questions in plain English and get answers cited from your exact notes — page numbers, YouTube timestamps, and all. Zero hallucination guaranteed." },
      { icon: "📊", title: "Know exactly where to focus", body: "Auto-generated quizzes track your score per topic. The Weakness Tracker tells you which chapters need more time so you study smart, not just hard." },
    ],
    benefitsCta: "Start Studying Free →",
    blocks: [
      { label: "UPLOAD & ORGANIZE", title: "All your study material. One project.", body: "Stop juggling between different apps and losing your files. Upload every PDF, paste every YouTube lecture link, and add every website URL into one permanent Physics project or Chemistry project. Your knowledge base grows with you throughout the semester.", alt: "file upload dashboard dark theme" },
      { label: "ASK ANYTHING", title: "Your AI tutor that read all your notes.", body: "Ask the AI to explain a concept, compare two theories, or help you understand something your professor explained unclearly. Every answer comes with the exact source — file name, page number, and YouTube timestamp — so you always know where the information came from.", alt: "AI chat dark interface streaming answer" },
      { label: "QUIZ & FLASHCARDS", title: "Test yourself. Know where you stand.", body: "Generate a full quiz from your uploaded notes with one click. Take it, see your score per topic, and let the Weakness Tracker show you exactly which chapters need more attention. Smart flashcards with spaced repetition make sure you remember what you study long after the session ends.", alt: "quiz app dark theme multiple choice" },
      { label: "STUDY PLAN", title: "A personalized plan for your exam.", body: "Tell the AI your exam date and it builds a day-by-day study plan based on your weak topics and how much time you have left. Focus on what matters most, skip what you already know, and walk into the exam fully prepared.", alt: "study planner dashboard analytics dark" },
    ],
    explore: {
      title: "Explore everything AIPKE can do for your studies",
      body: "From PDF chat and quiz generation to flashcards and study plans — every feature is designed to help you study smarter and score higher.",
      cta: "Start For Free →",
    },
    final: {
      title: "Your notes are waiting to talk back to you. 🧠",
      sub: "Start free. Upload your first PDF. Ask your first question. See the difference in 5 minutes.",
      cta: "Start Studying Free →",
    },
  },

  teachers: {
    story: {
      icon: "teacher",
      title: "Prof. Sharma eliminated 90% of repetitive student doubts using AIPKE.",
      meta: "📍 Computer Science Professor · Delhi",
      challenge:
        "Students kept asking the same questions on WhatsApp at midnight. Course material was scattered across 6 Drive folders with no way to query it intelligently.",
      metrics: [
        { value: "90%", label: "fewer repeated doubts" },
        { value: "2hrs", label: "saved per day" },
      ],
    },
    benefitsTitle: "Teach once. Your AI teaches forever.",
    benefits: [
      { icon: "🏫", title: "Build your course knowledge base", body: "Upload your lecture slides, recorded videos, textbooks, and reference PDFs. Your entire course lives in one AI-powered project your students can query anytime." },
      { icon: "🤖", title: "Your AI teaching assistant", body: "Students ask questions and the AI answers using only your course material. Your voice, your content, your standards — available 24 hours a day, 7 days a week." },
      { icon: "👥", title: "Invite your entire class", body: "Share your project with all your students in one click. Every student gets access to the same AI tutor powered by your course content. No extra setup needed." },
    ],
    benefitsCta: "Set Up Your Classroom →",
    blocks: [
      { label: "BUILD YOUR KNOWLEDGE BASE", title: "Upload your entire course once.", body: "Upload your lecture slides, recorded class videos, textbook PDFs, and reference materials into one project. Your students get a 24/7 AI tutor powered exclusively by your course content — not random internet information.", alt: "teacher course materials dashboard" },
      { label: "SHARE WITH YOUR CLASS", title: "Invite 100 students in 30 seconds.", body: "Share your project with your entire class by sending them an invite link. Every student immediately gets access to the same AI tutor. You see all team members in the Team panel and can add or remove them anytime.", alt: "team members dashboard invite users" },
      { label: "ELIMINATE REPETITIVE DOUBTS", title: "Students get answers. You get your time back.", body: "Every question a student asks is answered from your uploaded material with a cited source. Students stop messaging you on WhatsApp at midnight. You stop answering the same question for the 50th time. The AI does that work.", alt: "AI question answer education interface" },
      { label: "QUIZ YOUR STUDENTS", title: "Auto-generate assessments from your content.", body: "Generate quizzes directly from your uploaded lecture material. Students take the quiz and you see their scores and weak areas. Use it for practice tests, revision sessions, or assignment preparation — all from content you already uploaded.", alt: "quiz results analytics chart dark theme" },
    ],
    explore: {
      title: "Everything you need to run a smarter classroom",
      body: "Upload your course, share with your class, auto-generate quizzes, and let AI handle repetitive doubts so you can focus on teaching.",
      cta: "Set Up Your Class →",
    },
    final: {
      title: "Your students need an AI tutor you built. 👨‍🏫",
      sub: "Create your course project, upload your material, and invite your first student — all in under 10 minutes.",
      cta: "Set Up My Classroom →",
    },
  },

  orgs: {
    story: {
      icon: "building",
      title: "A 50-person startup cut onboarding time by 60% using AIPKE.",
      meta: "📍 Tech Startup · Bangalore, India",
      challenge:
        "New employees spent their entire first week just finding the right documents. Critical knowledge lived only inside one person's head.",
      metrics: [
        { value: "60%", label: "faster onboarding" },
        { value: "4x", label: "team productivity" },
      ],
    },
    benefitsTitle: "Connect once. Your team knows everything.",
    benefits: [
      { icon: "🔗", title: "Connect all your existing tools", body: "Google Drive, Slack, Notion, and Jira connect with one click. Your entire organisation's knowledge becomes instantly searchable without moving a single file." },
      { icon: "💬", title: "Ask questions across every platform", body: "One chat interface queries across Slack messages, Jira tickets, Notion pages, and Drive documents simultaneously. Find anything in seconds with cited answers." },
      { icon: "🏢", title: "Built for teams of all sizes", body: "Invite team members to shared projects. HR, engineering, sales — each team gets their own isolated knowledge base with team-level access control and shared chat history." },
    ],
    benefitsCta: "Start Team Workspace →",
    blocks: [
      { label: "CONNECT YOUR TOOLS", title: "One click. All your knowledge connected.", body: "Connect Google Drive, Slack, Notion, and Jira with a single OAuth click per platform. Every file, message, page, and ticket is indexed automatically. No manual uploading, no copying, no migrations. Your existing tools stay exactly where they are.", alt: "integrations dashboard connected platforms" },
      { label: "INSTANT ANSWERS", title: "Ask anything. Get answers in seconds.", body: "Any team member types a question in plain English — about a company policy, a technical decision, a Jira ticket, or a Slack conversation from 3 months ago — and gets an accurate, cited answer instantly. No more digging through old threads or bothering colleagues.", alt: "enterprise chat search dark interface" },
      { label: "FASTER ONBOARDING", title: "New team members productive from day one.", body: "Upload your company handbook, policies, processes, and SOPs. Every new joiner can ask questions and get accurate answers from day one — without scheduling onboarding calls or waiting for a colleague to be available. Onboarding time cut by more than half.", alt: "onboarding HR dashboard knowledge base" },
      { label: "TEAM COLLABORATION", title: "Your entire team. One shared knowledge base.", body: "Create separate projects for HR, engineering, sales, and support. Each team has its own isolated knowledge base. Team members can upload new content, ask questions, and see each other's queries in shared chat history — building collective intelligence over time.", alt: "team workspace projects dashboard" },
    ],
    explore: {
      title: "All the tools your team needs in one knowledge platform",
      body: "Connect Drive, Slack, Notion, and Jira. Build team knowledge bases. Let every team member find any answer in seconds.",
      cta: "Start Team Workspace →",
    },
    final: {
      title: "Your team's knowledge is ready to be unlocked. 🏢",
      sub: "Connect your first platform, create your team project, and get your first cited answer in under 10 minutes.",
      cta: "Start Team Workspace →",
    },
  },
};

const ICONS = [
  ["📄", "PDF Document"], ["▶️", "YouTube"], ["🌐", "Website"], ["📁", "Google Drive"], ["💬", "Slack"],
  ["📝", "Notion"], ["🎫", "Jira"], ["🤖", "AI Chat"], ["🧠", "Quiz"], ["🃏", "Flashcards"],
  ["📊", "Analytics"], ["👥", "Team"], ["🔍", "Search"], ["📈", "Performance"], ["💡", "Summary"],
  ["🗂️", "Projects"], ["🔐", "Auth"], ["☁️", "Cloud"], ["⚡", "Fast"], ["✅", "Verified"],
];
const rotate = (arr, n) => [...arr.slice(n), ...arr.slice(0, n)];
// each column: a different order, repeated twice so one "set" is taller than two screens
const COLUMNS = [
  { items: rotate(ICONS, 0), dir: "up", secs: 35 },
  { items: rotate([...ICONS].reverse(), 7), dir: "down", secs: 40 },
  { items: rotate(ICONS.filter((_, i) => i % 2 === 0).concat(ICONS.filter((_, i) => i % 2 === 1)), 11), dir: "up", secs: 35 },
];

/* ================================================================== *
 *  SMALL PIECES
 * ================================================================== */
const Reveal = ({ children, delay = 0, className = "", style }) => (
  <motion.div
    className={className}
    style={style}
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.6, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

function Img({ src, label, className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed) {
    return (
      <div className={`sol-ph ${className}`}>
        <span>{label}</span>
      </div>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt={label}
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable="false"
      onError={() => setFailed(true)}
    />
  );
}

function Counter({ value }) {
  const m = /^(\d+)(.*)$/.exec(value);
  const target = m ? Number(m[1]) : 0;
  const suffix = m ? m[2] : value;
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    const c = animate(0, target, { duration: 1.6, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, target]);
  return (
    <span ref={ref}>
      {n}
      {suffix}
    </span>
  );
}

const SVG_PROPS = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
function StoryIcon({ kind }) {
  return (
    <svg className="sol-story__icon" {...SVG_PROPS}>
      {kind === "cap" && (<><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" /><path d="M22 10v6" /><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" /></>)}
      {kind === "teacher" && (<><path d="M2 3h20" /><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" /><path d="m7 21 5-5 5 5" /></>)}
      {kind === "building" && (<><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4M10 10h4M10 14h4M10 18h4" /></>)}
    </svg>
  );
}

/* ================================================================== *
 *  SECTION 3 – STORY / STATS CARD
 * ================================================================== */
function StatsCard({ data, onCta }) {
  const s = data.story;
  return (
    <section className="sol-sec sol-story-sec">
      <Reveal>
        <div className="sol-story">
          <div className="sol-story__col sol-story__col--a">
            <StoryIcon kind={s.icon} />
            <h3 className="sol-story__title">{s.title}</h3>
            <p className="sol-story__meta">{s.meta}</p>
          </div>
          <div className="sol-story__col sol-story__col--b">
            <h4 className="sol-story__h">The challenge:</h4>
            <p className="sol-story__p">{s.challenge}</p>
          </div>
          <div className="sol-story__col sol-story__col--c">
            <h4 className="sol-story__h">The results:</h4>
            <div className="sol-metrics">
              {s.metrics.map((m) => (
                <div key={m.label}>
                  <div className="sol-metric__num"><Counter value={m.value} /></div>
                  <div className="sol-metric__lbl">{m.label}</div>
                </div>
              ))}
            </div>
            <div className="sol-story__actions">
              <button className="sol-btn sol-btn--primary" onClick={onCta}>See How It Works →</button>
              <a className="sol-link" href="#solutions" onClick={(e) => e.preventDefault()}>Read more stories »</a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ================================================================== *
 *  SECTION 4 – THREE BENEFIT CARDS
 * ================================================================== */
function Benefits({ data, onCta }) {
  return (
    <section className="sol-sec sol-dots">
      <div className="sol-wrap">
        <Reveal><h2 className="sol-h2 sol-center">{data.benefitsTitle}</h2></Reveal>
        <div className="sol-cards">
          {data.benefits.map((b, i) => (
            <motion.article
              key={b.title}
              className="sol-card"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.15, ease: "easeOut" }}
            >
              <div className="sol-card__icon">{b.icon}</div>
              <h3 className="sol-card__title">{b.title}</h3>
              <p className="sol-card__body">{b.body}</p>
            </motion.article>
          ))}
        </div>
        <Reveal className="sol-center sol-mt">
          <button className="sol-btn sol-btn--primary sol-btn--lg" onClick={onCta}>{data.benefitsCta}</button>
        </Reveal>
      </div>
    </section>
  );
}

/* ================================================================== *
 *  SECTION 5 – STICKY SCROLL SHOWCASE
 * ================================================================== */
function ShowcaseImage({ index, total, progress, src, label }) {
  // block i is centred in the viewport when progress === i / (total - 1)
  const step = 1 / (total - 1);
  const lo = (index - 0.5) * step;
  const hi = (index + 0.5) * step;
  const w = 0.04;
  let input, output;
  if (index === 0) { input = [0, hi - w, hi + w]; output = [1, 1, 0]; }
  else if (index === total - 1) { input = [lo - w, lo + w, 1]; output = [0, 1, 1]; }
  else { input = [lo - w, lo + w, hi - w, hi + w]; output = [0, 1, 1, 0]; }
  const opacity = useTransform(progress, input, output);
  return (
    <motion.div className="sol-shot" style={{ opacity }}>
      <Img src={src} label={label} />
    </motion.div>
  );
}

function Showcase({ data }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const n = data.blocks.length;
  return (
    <section className="sol-sec sol-showcase" id="sol-showcase">
      <div className="sol-wrap sol-showcase__grid" ref={ref}>
        <div className="sol-showcase__left">
          {data.blocks.map((b, i) => (
            <div className="sol-block" key={b.label}>
              {/* mobile only: image above text */}
              <div className="sol-frame sol-frame--mobile">
                <div className="sol-frame__in"><Img src={BLOCK_IMG[i]} label={b.alt} /></div>
              </div>
              <Reveal>
                <p className="sol-eyebrow">{b.label}</p>
                <h3 className="sol-h3">{b.title}</h3>
                <p className="sol-p">{b.body}</p>
              </Reveal>
            </div>
          ))}
        </div>
        <div className="sol-showcase__right">
          <div className="sol-frame sol-frame--sticky">
            <div className="sol-frame__in">
              {data.blocks.map((b, i) => (
                <ShowcaseImage key={b.label} index={i} total={n} progress={scrollYProgress} src={BLOCK_IMG[i]} label={b.alt} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================== *
 *  SECTION 6 – ANIMATED ICON COLUMNS
 * ================================================================== */
function Explore({ data, onCta }) {
  const e = data.explore;
  return (
    <section className="sol-explore">
      <div className="sol-cols" aria-hidden="true">
        {COLUMNS.map((c, ci) => {
          const set = [...c.items, ...c.items];
          return (
            <div className={`sol-col sol-col--${ci + 1}`} key={ci}>
              <div className={`sol-col__track sol-col__track--${c.dir}`} style={{ animationDuration: `${c.secs}s` }}>
                {[0, 1].map((rep) =>
                  set.map(([emoji, name], i) => (
                    <div className="sol-tile" key={`${rep}-${i}`} title={name}>{emoji}</div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Reveal className="sol-explore__card-wrap">
        <div className="sol-explore__card">
          <h2 className="sol-explore__title">{e.title}</h2>
          <div className="sol-explore__side">
            <p>{e.body}</p>
            <button className="sol-btn sol-btn--primary" onClick={onCta}>{e.cta}</button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ================================================================== *
 *  SECTION 7 – FINAL CTA
 * ================================================================== */
function FinalCta({ data, onCta, onDemo }) {
  const f = data.final;
  return (
    <section className="sol-final">
      <Reveal className="sol-final__in">
        <p className="sol-eyebrow sol-center">GET STARTED TODAY</p>
        <h2 className="sol-final__title">{f.title}</h2>
        <p className="sol-final__sub">{f.sub}</p>
        <div className="sol-final__btns">
          <button className="sol-btn sol-btn--primary sol-btn--lg" onClick={onCta}>{f.cta}</button>
          <button className="sol-btn sol-btn--ghost sol-btn--lg" onClick={onDemo}>See Full Demo</button>
        </div>
        <ul className="sol-trust">
          <li>✅ No credit card required</li>
          <li>✅ Free plan available</li>
          <li>✅ Setup in under 10 minutes</li>
        </ul>
      </Reveal>
    </section>
  );
}

/* ================================================================== *
 *  PAGE
 * ================================================================== */
export default function SolutionsPage() {
  const { openAuth } = useAuth();
  const [tab, setTab] = useState("students");
  const data = CONTENT[tab];
  const hero = HERO_IMG[tab];

  const signup = () => openAuth("signup");
  const toShowcase = () => document.getElementById("sol-showcase")?.scrollIntoView({ behavior: "smooth" });
  const toDemo = () => { window.location.hash = "#how-it-works"; };

  return (
    <div className="sol">
      <style>{CSS}</style>

      {/* ---------- HERO ---------- */}
      <section className="sol-hero">
        <div className="sol-hero__glow" />
        <div className="sol-wrap sol-hero__grid">
          <div className="sol-hero__text">
            <p className="sol-eyebrow">SOLUTIONS</p>
            <h1 className="sol-h1">
              The right knowledge tool
              <br className="sol-br" /> for every kind of learner
              <br className="sol-br" /> and team.
            </h1>
            <p className="sol-hero__sub">
              Whether you are a student preparing for exams, a teacher building a smarter classroom, or an organisation
              connecting your internal tools — AIPKE is built specifically for your workflow.
            </p>

            <div className="sol-tabs" role="tablist" aria-label="Choose your solution">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`sol-tab ${tab === t.key ? "is-active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  <span aria-hidden="true">{t.emoji}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sol-hero__media">
            <div className="sol-hero__card">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  className="sol-hero__imgwrap"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Img src={hero.src} label={hero.label} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="sol-divider" />
      </section>

      {/* ---------- SECTIONS 3-7 (swap with the tab) ---------- */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <StatsCard data={data} onCta={toShowcase} />
          <Benefits data={data} onCta={signup} />
          <Showcase data={data} />
          <Explore data={data} onCta={signup} />
          <FinalCta data={data} onCta={signup} onDemo={toDemo} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ================================================================== *
 *  STYLES (scoped with .sol-)
 * ================================================================== */
const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&display=swap");

.sol { --navy:#ffffff; --indigo:#6366F1; --white:#0b0d12; --grey:#5b6478; --card:#f6f7fb; --alt:#f3f4fa; --line:rgba(11,13,18,.12);
  background:var(--navy); color:var(--grey); font-family:Inter,system-ui,sans-serif; overflow-x:clip; }
.sol h1,.sol h2,.sol h3,.sol h4 { font-family:Sora,Inter,sans-serif; color:var(--white); }
.sol-wrap { max-width:1200px; margin:0 auto; padding:0 28px; }
.sol-center { text-align:center; }
.sol-mt { margin-top:48px; }
.sol-eyebrow { color:var(--indigo); font:600 13px Inter,sans-serif; letter-spacing:.16em; text-transform:uppercase; margin-bottom:16px; }
.sol-h2 { font-size:clamp(28px,4vw,44px); line-height:1.15; font-weight:700; }
.sol-h3 { font-size:clamp(26px,3vw,38px); line-height:1.2; font-weight:700; margin-bottom:18px; }
.sol-p { font-size:17px; line-height:1.75; }
.sol-sec { padding:96px 0; }
.sol-btn { font:600 15px Inter,sans-serif; border-radius:999px; padding:12px 24px; cursor:pointer; border:1px solid transparent; transition:transform .2s, background .2s, border-color .2s, box-shadow .2s; }
.sol-btn--lg { padding:15px 32px; font-size:16px; }
.sol-btn--primary { background:var(--indigo); color:#fff; }
.sol-btn--primary:hover { background:#4f46e5; transform:translateY(-2px); box-shadow:0 10px 30px -10px rgba(99,102,241,.7); }
.sol-btn--ghost { background:transparent; color:var(--white); border-color:rgba(11,13,18,.35); }
.sol-btn--ghost:hover { border-color:var(--white); background:rgba(11,13,18,.05); }
.sol-link { color:var(--grey); font-size:14px; transition:color .2s; }
.sol-link:hover { color:var(--white); }

/* hero */
.sol-hero { position:relative; padding:140px 0 0; }
.sol-hero__glow { position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse 55% 60% at 50% 40%, rgba(99,102,241,.10), transparent 70%); }
.sol-hero__grid { position:relative; display:grid; grid-template-columns:55fr 45fr; gap:48px; align-items:center; }
.sol-h1 { font-size:clamp(34px,4.6vw,58px); line-height:1.1; font-weight:700; margin-bottom:24px; }
.sol-hero__sub { font-size:18px; line-height:1.7; max-width:560px; margin-bottom:36px; }
.sol-tabs { display:flex; gap:12px; flex-wrap:wrap; }
.sol-tab { font:500 15px Inter,sans-serif; color:var(--grey); background:transparent; border:1px solid rgba(11,13,18,.2);
  padding:11px 20px; border-radius:999px; cursor:pointer; transition:all .2s; white-space:nowrap; }
.sol-tab:hover { border-color:var(--indigo); }
.sol-tab.is-active { background:var(--indigo); border-color:var(--indigo); color:#fff; }
.sol-hero__card { background:var(--card); border:1px solid var(--line); border-radius:20px; padding:12px;
  box-shadow:0 30px 80px -30px rgba(99,102,241,.30); }
.sol-hero__imgwrap { aspect-ratio:4/4.4; border-radius:12px; overflow:hidden; background:#eceef5; }
.sol-hero__imgwrap img, .sol-shot img { width:100%; height:100%; object-fit:cover; display:block; }
.sol-divider { height:1px; background:linear-gradient(90deg,transparent,rgba(11,13,18,.15),transparent); margin-top:72px; }

/* placeholder for failed images */
.sol-ph { width:100%; height:100%; display:flex; align-items:center; justify-content:center; text-align:center; padding:24px;
  background:linear-gradient(135deg,#eef0f8,#e1e5f2); color:var(--grey); font:500 15px Inter,sans-serif; }

/* stats card */
.sol-story-sec { padding-bottom:40px; }
.sol-story { width:85%; max-width:1180px; margin:0 auto; display:grid; grid-template-columns:35fr 35fr 30fr;
  background:var(--card); border:1px solid var(--line); border-radius:16px; overflow:hidden; }
.sol-story__col { padding:40px 36px; }
.sol-story__col--b { border-left:3px solid var(--indigo); border-right:1px solid var(--line); }
.sol-story__col--a { border-right:1px solid var(--line); }
.sol-story__icon { width:44px; height:44px; color:var(--indigo); margin-bottom:20px; }
.sol-story__title { font-size:22px; line-height:1.4; font-weight:700; margin-bottom:18px; }
.sol-story__meta { font-size:14px; }
.sol-story__h { font-size:18px; margin-bottom:14px; }
.sol-story__p { font-size:16px; line-height:1.75; }
.sol-metrics { display:flex; gap:36px; margin-bottom:28px; }
.sol-metric__num { font:700 44px Sora,sans-serif; color:var(--white); line-height:1; }
.sol-metric__lbl { font-size:13px; margin-top:8px; max-width:120px; }
.sol-story__actions { display:flex; align-items:center; gap:20px; flex-wrap:wrap; }

/* benefits */
.sol-dots { background-color:var(--navy);
  background-image:radial-gradient(rgba(11,13,18,.10) 1px, transparent 1px); background-size:26px 26px; }
.sol-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:28px; margin-top:56px; }
.sol-card { background:#fff; border-radius:12px; padding:32px 28px; border:1px solid var(--line); box-shadow:0 6px 20px rgba(11,13,18,.08);
  transition:transform .25s, box-shadow .25s; }
.sol-card:hover { transform:translateY(-4px) !important; box-shadow:0 18px 40px rgba(11,13,18,.16); }
.sol-card__icon { width:48px; height:48px; border-radius:12px; background:rgba(99,102,241,.12); display:flex; align-items:center; justify-content:center; font-size:24px; margin-bottom:20px; }
.sol-card .sol-card__title { color:#0f172a; font-size:20px; line-height:1.3; font-weight:700; margin-bottom:12px; }
.sol-card__body { color:#64748b; font-size:15.5px; line-height:1.7; }

/* showcase */
.sol-showcase { padding:40px 0 0; }
.sol-showcase__grid { display:grid; grid-template-columns:45fr 55fr; gap:56px; }
.sol-block { min-height:100vh; display:flex; flex-direction:column; justify-content:center; }
.sol-showcase__right { position:relative; }
.sol-frame { border-radius:16px; padding:2px; background:linear-gradient(135deg,#6366F1,#8B5CF6,#EC4899,#F59E0B,#10B981,#3B82F6); }
.sol-frame__in { position:relative; width:100%; height:100%; border-radius:14px; overflow:hidden; background:#eceef5; }
.sol-frame--sticky { position:sticky; top:14vh; height:72vh; }
.sol-frame--mobile { display:none; }
.sol-shot { position:absolute; inset:0; }

/* explore */
.sol-explore { position:relative; background:var(--alt); min-height:680px; overflow:hidden; display:flex; align-items:center; justify-content:center; padding:60px 20px; margin-top:60px; }
.sol-cols { position:absolute; inset:0; display:grid; grid-template-columns:repeat(3,1fr); gap:20px; padding:0 20px; opacity:.9; }
.sol-col { overflow:hidden; display:flex; justify-content:center; }
.sol-col__track { display:flex; flex-direction:column; gap:16px; will-change:transform; animation:linear infinite; }
.sol-col__track--up { animation-name:sol-up; }
.sol-col__track--down { animation-name:sol-down; }
.sol-tile { width:96px; height:96px; flex:none; border-radius:18px; background:rgba(255,255,255,.85); border:1px solid var(--line);
  display:flex; align-items:center; justify-content:center; font-size:38px; }
@keyframes sol-up { from { transform:translateY(0); } to { transform:translateY(-50%); } }
@keyframes sol-down { from { transform:translateY(-50%); } to { transform:translateY(0); } }
.sol-explore__card-wrap { position:relative; width:100%; max-width:860px; }
.sol-explore__card { background:#fff; border-radius:20px; padding:44px 48px; border:1px solid var(--line); box-shadow:0 30px 80px rgba(11,13,18,.14);
  display:grid; grid-template-columns:1fr 1fr; gap:40px; align-items:center; }
.sol-explore .sol-explore__title { color:#0f172a; font-size:clamp(24px,2.6vw,32px); line-height:1.25; font-weight:700; }
.sol-explore__side p { color:#64748b; font-size:16px; line-height:1.7; margin-bottom:22px; }

/* final */
.sol-final { position:relative; padding:120px 24px 130px; text-align:center; overflow:hidden;
  background:radial-gradient(ellipse 60% 70% at 50% 45%, rgba(99,102,241,.16), rgba(99,102,241,.05) 55%, transparent 75%), var(--navy); }
.sol-final__in { max-width:760px; margin:0 auto; }
.sol-final__title { font-size:clamp(32px,5vw,54px); line-height:1.15; font-weight:700; margin-bottom:20px; }
.sol-final__sub { font-size:18px; line-height:1.7; margin-bottom:36px; }
.sol-final__btns { display:flex; gap:16px; justify-content:center; flex-wrap:wrap; margin-bottom:36px; }
.sol-trust { display:flex; gap:26px; justify-content:center; flex-wrap:wrap; font-size:14px; }

/* ---------------- mobile ---------------- */
@media (max-width:1000px) {
  .sol-story { width:92%; }
  .sol-story__col { padding:32px 24px; }
}
@media (max-width:767px) {
  .sol-sec { padding:64px 0; }
  .sol-hero { padding-top:110px; }
  .sol-hero__grid { grid-template-columns:1fr; gap:36px; }
  .sol-br { display:none; }
  .sol-tabs { flex-wrap:nowrap; gap:8px; }
  .sol-tab { padding:9px 12px; font-size:13px; flex:1; text-align:center; }
  .sol-story { grid-template-columns:1fr; width:92%; }
  .sol-story__col--a, .sol-story__col--b { border-right:0; }
  .sol-story__col--b { border-left:3px solid var(--indigo); border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
  .sol-cards { grid-template-columns:1fr; }
  .sol-showcase__grid { grid-template-columns:1fr; gap:0; }
  .sol-showcase__right { display:none; }
  .sol-block { min-height:0; padding:36px 0; }
  .sol-frame--mobile { display:block; aspect-ratio:16/11; margin-bottom:26px; }
  .sol-cols { grid-template-columns:repeat(2,1fr); }
  .sol-col--3 { display:none; }
  .sol-explore__card { grid-template-columns:1fr; padding:32px 26px; gap:20px; }
  .sol-final { padding:90px 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .sol-col__track { animation:none; }
}
`;

import { useCallback, useEffect, useRef, useState } from "react";
import MuxVideo from "./MuxVideo.jsx";

/* ------------------------------------------------------------------ *
 *  CONTENT – edit text / media here
 * ------------------------------------------------------------------ */
const SLIDE1_IMAGE = "https://i.postimg.cc/GpWhfM6Z/Whats-App-Image-2026-10-10-at-6-34-18-PM.jpg";

const SLIDES = [
  {
    label: "CREATE YOUR PROJECT",
    tagline: "Organize knowledge the way you think",
    title: "Start with a project",
    body:
      "Everything in AI Personal Knowledge Engine is organized into projects. Create one project for each subject, team, or topic. Your Physics notes, your HR policies, your dev team docs — each lives in its own isolated knowledge base. Switch between projects instantly from your dashboard. Your AI only searches inside the active project, so answers are always focused and relevant.",
    media: { type: "image", src: SLIDE1_IMAGE, alt: "Project dashboard with a list of projects" },
  },
  {
    label: "UPLOAD YOUR CONTENT",
    tagline: "Every format. Every source. One place.",
    title: "Bring in knowledge from anywhere",
    body:
      "Drop in PDFs, Word documents, CSV files, and text notes directly from your computer. Paste a YouTube video link and the AI automatically extracts the full spoken transcript. Paste a website URL and the AI scrapes and indexes the entire page. Connect Google Drive, Slack, Notion, or Jira with one click and import files directly from those platforms. All content is processed automatically in the background using our Celery pipeline. You see a live status — Processing, then Indexed — for every single file.",
    media: { type: "video", id: "6yChQ77Yz02x9gBdkcm01DdgSy9PnOy6mm4QuA00mU6xVw", fit: "cover" },
  },
  {
    label: "CHAT WITH YOUR KNOWLEDGE",
    tagline: "Ask in plain English. Get cited answers.",
    title: "Your AI that actually knows your content",
    body:
      "Open the chat and ask anything — exactly the way you would ask a friend. The AI searches through all your uploaded content, finds the most relevant pieces, and generates a precise answer grounded entirely in your own material. It never makes things up. Every answer shows the exact source it came from — which file, which page, which YouTube timestamp. Answers stream word by word in real time, just like ChatGPT, so you see the response building live on screen.",
    // "contain" so no part of the chat UI is cropped. Change to "cover" to fill the frame.
    media: { type: "video", id: "TdYmsOhlp9f8KIE00KpWYWnXejP00Qg3uMGd4G9WLW7s8", fit: "contain" },
  },
  {
    label: "QUIZ YOURSELF",
    tagline: "Turn passive reading into active learning.",
    title: "Study smarter with AI-generated quizzes",
    body:
      "With one click, the AI reads all your uploaded content and automatically generates multiple choice questions that test your real understanding — not just memorization. Each quiz tracks your score per topic. The platform identifies which topics you score lowest on and flags them as your weak areas. Over time your Weakness Tracker dashboard shows you exactly where to focus your study time. Smart flashcards with spaced repetition help you retain difficult concepts long after the study session ends.",
    media: { type: "video", id: "wcO19ATLZwE01NjUTVLgPARA4e01fIfluUZq4yV4maY3s", fit: "cover" },
  },
  {
    label: "COLLABORATE AS A TEAM",
    tagline: "One knowledge base. Your entire team.",
    title: "Share knowledge across your whole team",
    body:
      "Invite team members to any project with a single email. Once they join, every uploaded file, every chat conversation, and every indexed source is shared across the entire team. HR teams can let every new employee ask questions from the company policy knowledge base. Developer teams can share their Jira tickets, Slack channels, and documentation in one searchable workspace. Teachers can invite their entire class to a shared subject knowledge base. Everyone searches the same knowledge. Everyone gets the same accurate, cited answers.",
    media: { type: "video", id: "qKoB0155oo4ZZAg01P3ZwBgUl402ILQXZEmkikzHN88H4k", fit: "cover" },
  },
];

const TOTAL = SLIDES.length;
const STRIPS = 6; // slide-1 image is revealed in 6 horizontal bands, 100 ms apart

/* ------------------------------------------------------------------ */
function Visual({ media, active, near }) {
  if (media.type === "image") {
    return (
      <div className="hiw__strips" role="img" aria-label={media.alt}>
        {Array.from({ length: STRIPS }, (_, i) => {
          const top = (i / STRIPS) * 100;
          const bottom = 100 - ((i + 1) / STRIPS) * 100;
          return (
            <img
              key={i}
              className="hiw__strip"
              src={media.src}
              alt=""
              draggable="false"
              style={{
                "--i": i,
                // tiny overlap hides hairline seams between bands
                clipPath: `inset(${Math.max(top - 0.15, 0)}% 0 ${Math.max(bottom - 0.15, 0)}% 0)`,
              }}
            />
          );
        })}
      </div>
    );
  }
  return <MuxVideo playbackId={media.id} active={active} near={near} fit={media.fit} />;
}

export default function HowItWorks() {
  const sectionRef = useRef(null);
  const [idx, setIdx] = useState(0);

  // ---- scroll position -> slide index (100vh of scroll per slide) ----
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const scrolled = -el.getBoundingClientRect().top + 72; // 72 = sticky offset (navbar)
      const vh = window.innerHeight;
      const next = Math.min(TOTAL - 1, Math.max(0, Math.floor(scrolled / vh)));
      setIdx((cur) => (cur === next ? cur : next));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ---- Skip: jump past the whole section (to Use Cases once it exists) ----
  const skip = useCallback(() => {
    const useCases = document.getElementById("use-cases");
    if (useCases) {
      useCases.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const el = sectionRef.current;
    if (!el) return;
    const bottom = el.getBoundingClientRect().bottom + window.scrollY;
    window.scrollTo({ top: bottom, behavior: "smooth" });
  }, []);

  const pct = ((idx + 1) / TOTAL) * 100;

  return (
    <>
      {/* ---------- heading above the scroll section ---------- */}
      <div id="how-it-works" className="hiw__head">
        <p className="hiw__eyebrow">HOW IT WORKS</p>
        <h2 className="hiw__h2">From upload to insight in minutes</h2>
        <p className="hiw__sub">
          See exactly how AI Personal Knowledge Engine transforms your raw content into an
          intelligent, conversational knowledge base — step by step.
        </p>
      </div>

      {/* ---------- tall scroll runway (600vh = 5 slides x 100vh + the sticky screen) ---------- */}
      <section ref={sectionRef} className="hiw" aria-label="How it works">
        <div className="hiw__sticky">
          <div className="hiw__box">
            <button type="button" className="hiw__skip" onClick={skip}>
              Skip
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="m19 12-7 7-7-7" />
              </svg>
            </button>

            <div className="hiw__stage">
              {SLIDES.map((s, i) => {
                const state = i === idx ? "is-active" : i < idx ? "is-before" : "is-after";
                return (
                  <article
                    key={s.title}
                    className={`hiw__slide ${state}`}
                    aria-hidden={i !== idx}
                  >
                    <div className="hiw__text">
                      <p className="hiw__step">
                        STEP {String(i + 1).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")} — {s.label}
                      </p>
                      <p className="hiw__tag">{s.tagline}</p>
                      <h3 className="hiw__title">{s.title}</h3>
                      <p className="hiw__body">{s.body}</p>
                      <a className="hiw__more" href="#features">
                        Learn more
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </a>
                    </div>

                    <div className="hiw__visual">
                      <Visual media={s.media} active={i === idx} near={Math.abs(i - idx) <= 1} />
                    </div>
                  </article>
                );
              })}
            </div>

            {/* progress bar – touches the bottom edge of the box */}
            <div className="hiw__progress">
              <div className="hiw__track">
                <div className="hiw__fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="hiw__count">{idx + 1} / {TOTAL}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

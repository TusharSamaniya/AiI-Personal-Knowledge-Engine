import { createElement, useEffect, useRef } from "react";
import { FEATURE_ICONS } from "./featureIcons.js";

const VIDEO_SRC =
  "https://videos.ctfassets.net/spoqsaf9291f/5aPgcRxfr53cMSHMjtYD71/48f0520889e9b6e1eae514eb7e891e55/ai-hero-animation.mp4";

function FeatureVideo() {
  const ref = useRef(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const tryPlay = () => {
      if (!video.paused) return;
      const p = video.play();
      if (p && p.catch) p.catch((e) => console.warn("[FeatureVideo] play() blocked:", e?.name || e));
    };

    tryPlay();
    video.addEventListener("canplay", tryPlay);
    const events = ["pointerdown", "touchstart", "keydown", "scroll"];
    const onInteract = () => {
      tryPlay();
      if (!video.paused) events.forEach((e) => window.removeEventListener(e, onInteract));
    };
    events.forEach((e) => window.addEventListener(e, onInteract, { passive: true }));

    return () => {
      video.removeEventListener("canplay", tryPlay);
      events.forEach((e) => window.removeEventListener(e, onInteract));
    };
  }, []);

  return (
    <video
      ref={ref}
      className="feat__video"
      src={VIDEO_SRC}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

const FEATURES = [
  { key: "search", label: "AI-Powered Search" },
  { key: "quiz", label: "Smart Quiz Generation" },
  { key: "cards", label: "Spaced Repetition Flashcards" },
  { key: "weak", label: "Weakness Tracker" },
  { key: "source", label: "Multi-Source Ingestion" },
  { key: "team", label: "Team Collaboration" },
];

function Icon({ name }) {
  return (
    <svg
      className="feat__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {FEATURE_ICONS[name].map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}

export default function Features() {
  return (
    <section id="features" className="feat">
      <div className="feat__wrap">
        <div className="feat__top">
          <div className="feat__copy">
            <p className="feat__eyebrow">WHAT YOU GET</p>
            <h2 className="feat__title">Everything you need to master your knowledge</h2>
            <p className="feat__lead">
              Built for students, teachers, and teams who need their information instantly
              accessible and intelligently searchable.
            </p>
          </div>

          <div className="feat__media">
            <FeatureVideo />
          </div>
        </div>

        <ul className="feat__grid">
          {FEATURES.map((f) => (
            <li key={f.key} className="feat__card">
              <Icon name={f.key} />
              <span className="feat__label">{f.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

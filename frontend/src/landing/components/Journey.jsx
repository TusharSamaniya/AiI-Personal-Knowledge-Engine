import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

/* ------------------------------------------------------------------ *
 *  ROAD GEOMETRY  (SVG viewBox units – everything scales together)
 *  Snake / S-shape, 5 straight roads + a short final drop.
 *  Corners have a small radius so the car turns smoothly.
 * ------------------------------------------------------------------ */
const VB_W = 1500;
const VB_H = 870;
const R = 28; // corner radius
const X_L = 40; // left vertical road
const X_R = 1140; // right vertical road
const X_START = 100;
const Y1 = 110;
const Y2 = 310;
const Y3 = 610;
const Y_END = 790;

const ROAD_D = [
  `M${X_START} ${Y1}`,
  `H${X_R - R}`, `Q${X_R} ${Y1} ${X_R} ${Y1 + R}`,
  `V${Y2 - R}`, `Q${X_R} ${Y2} ${X_R - R} ${Y2}`,
  `H${X_L + R}`, `Q${X_L} ${Y2} ${X_L} ${Y2 + R}`,
  `V${Y3 - R}`, `Q${X_L} ${Y3} ${X_L + R} ${Y3}`,
  `H${X_R - R}`, `Q${X_R} ${Y3} ${X_R} ${Y3 + R}`,
  `V${Y_END}`,
].join(" ");

/* ------------------------------------------------------------------ *
 *  STOPS – in the order the car reaches them
 *  place: where the label sits relative to the road
 * ------------------------------------------------------------------ */
const STOPS = [
  { icon: "🔐", title: "Login", sub: "Create your account or sign in with Google", x: 596, y: Y1, place: "above" },
  { icon: "🚀", title: "Get Started", sub: "Create your first project", x: 896, y: Y1, place: "above" },
  { icon: "📄", title: "Upload Docs", sub: "PDF, DOCX, TXT, CSV files", x: X_R, y: 160, place: "right" },
  { icon: "📁", title: "Import from Drive", sub: "Connect Google Drive", x: X_R, y: 255, place: "right" },
  // the car travels right -> left on this road, so Notion is reached first
  { icon: "📝", title: "Import from Notion", sub: "Sync your Notion pages", x: 975, y: Y2, place: "below" },
  { icon: "💬", title: "Import from Slack", sub: "Bring in channel messages", x: 596, y: Y2, place: "below" },
  { icon: "🎫", title: "Import from Jira", sub: "Sync your Jira tickets", x: 256, y: Y2, place: "below" },
  { icon: "▶️", title: "Give YouTube Link", sub: "AI extracts full transcript", x: X_L, y: 455, place: "right" },
  { icon: "🌐", title: "Give Website Link", sub: "AI scrapes and indexes the page", x: X_L, y: 538, place: "right" },
  { icon: "🤖", title: "Chat with AI", sub: "Ask anything from your docs", x: 175, y: Y3, place: "below" },
  { icon: "📋", title: "Summarize", sub: "Get instant document summaries", x: 465, y: Y3, place: "below" },
  { icon: "🧠", title: "Generate Quiz", sub: "Test your knowledge", x: 705, y: Y3, place: "below" },
  { icon: "🃏", title: "Generate Flashcards", sub: "Study with spaced repetition", x: 915, y: Y3, place: "below" },
  { icon: "👥", title: "Work in Team", sub: "Invite members, collaborate", x: X_R, y: 665, place: "right" },
  { icon: "📊", title: "Analyze Performance", sub: "Track quiz scores and weak areas", x: X_R, y: 745, place: "right" },
];

const TICK = 24; // length of the little connector between road and label

/* how far past a stop the car still counts as "at" it (0-1 of the road) */
const NOW_WINDOW = 0.032;
const EPS = 0.003;

/* top-down car, drawn pointing RIGHT (+x), centred on 0,0 – 64 x 34 */
function CarShape() {
  return (
    <g className="jr__car-shape">
      <rect x="-32" y="-17" width="64" height="34" rx="10" className="jr__car-body" />
      {/* wheels */}
      <rect x="-22" y="-20" width="12" height="5" rx="2" className="jr__car-wheel" />
      <rect x="-22" y="15" width="12" height="5" rx="2" className="jr__car-wheel" />
      <rect x="12" y="-20" width="12" height="5" rx="2" className="jr__car-wheel" />
      <rect x="12" y="15" width="12" height="5" rx="2" className="jr__car-wheel" />
      {/* glass */}
      <path d="M6 -12 L18 -9 L18 9 L6 12 Z" className="jr__car-glass" />
      <rect x="-14" y="-11" width="16" height="22" rx="4" className="jr__car-glass" />
      <path d="M-24 -10 L-20 -10 L-20 10 L-24 10 Z" className="jr__car-glass" />
      {/* lights */}
      <rect x="28" y="-14" width="4" height="7" rx="2" className="jr__car-light" />
      <rect x="28" y="7" width="4" height="7" rx="2" className="jr__car-light" />
    </g>
  );
}

function stateOf(p, stopP) {
  if (p < stopP - EPS) return "idle";
  if (p < stopP + NOW_WINDOW) return "now";
  return "passed";
}

export default function Journey() {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      /* ============================ DESKTOP ============================ */
      mm.add("(min-width: 1000px)", () => {
        const stage = root.querySelector(".jr__stage");
        const path = root.querySelector(".jr__road");
        const trail = root.querySelector(".jr__trail");
        const car = root.querySelector(".jr__car");
        const endEl = root.querySelector(".jr__end");
        if (!stage || !path || !car) return;

        const total = path.getTotalLength();

        // where (0-1) along the real path each stop sits
        const N = Math.ceil(total);
        const pts = [];
        for (let l = 0; l <= N; l++) pts.push(path.getPointAtLength(l));
        const stopP = STOPS.map((s) => {
          let best = 0, bestD = Infinity;
          for (let l = 0; l <= N; l++) {
            const dx = pts[l].x - s.x, dy = pts[l].y - s.y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = l; }
          }
          return best / total;
        });

        // the lit "already travelled" road is revealed with a dash offset
        trail.style.strokeDasharray = total;
        trail.style.strokeDashoffset = total;

        const els = STOPS.map((_, i) => ({
          label: root.querySelector(`.jr__stop[data-stop="${i}"]`),
          card: root.querySelector(`.jr__stop[data-stop="${i}"] .jr__card`),
          dot: root.querySelector(`.jr__dot[data-stop="${i}"]`),
          ring: root.querySelector(`.jr__ring[data-stop="${i}"]`),
        }));
        const states = STOPS.map(() => "idle");

        const apply = (i, next) => {
          const prev = states[i];
          if (prev === next) return;
          states[i] = next;
          const { label, card, dot, ring } = els[i];
          label.dataset.state = next;
          dot.dataset.state = next;
          if (next === "now") {
            // pulse: 1 -> 1.1 -> back, plus a ripple ring on the road
            gsap.fromTo(card, { scale: 1 }, { scale: 1.1, duration: 0.28, ease: "power2.out", yoyo: true, repeat: 1 });
            gsap.fromTo(ring, { attr: { r: 7 }, opacity: 0.9 }, { attr: { r: 34 }, opacity: 0, duration: 1, ease: "power2.out" });
          }
        };

        const update = (p) => {
          trail.style.strokeDashoffset = total * (1 - p);
          STOPS.forEach((_, i) => apply(i, stateOf(p, stopP[i])));
          if (endEl) endEl.dataset.state = p > 0.985 ? "now" : "idle";
        };
        update(0);

        const tween = gsap.to(car, {
          motionPath: {
            path,
            align: path,
            alignOrigin: [0.5, 0.5],
            autoRotate: true,
          },
          ease: "none",
          scrollTrigger: {
            trigger: stage,
            start: "top 72px",
            end: () => "+=" + window.innerHeight * 5, // pinned stage + 5 screens = ~600vh of scrolling
            scrub: 1,
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
          onUpdate() { update(this.progress()); },
        });
        gsap.set(car, { opacity: 1 });

        return () => { tween.scrollTrigger && tween.scrollTrigger.kill(); tween.kill(); };
      });

      /* ============================ MOBILE ============================= */
      mm.add("(max-width: 999px)", () => {
        const wrap = root.querySelector(".jr__m");
        const road = root.querySelector(".jr__m-road");
        const car = root.querySelector(".jr__m-car");
        if (!wrap || !road || !car) return;

        const items = Array.from(root.querySelectorAll(".jr__m-stop"));
        const states = items.map(() => "idle");
        const size = () => car.offsetHeight || 0;

        const update = () => {
          const roadTop = road.getBoundingClientRect().top;
          const carY = gsap.getProperty(car, "y") + 0;
          items.forEach((li, i) => {
            const dot = li.querySelector(".jr__m-dot");
            const mid = dot.getBoundingClientRect().top + dot.offsetHeight / 2 - roadTop;
            const next = carY >= mid ? (carY < mid + 70 ? "now" : "passed") : "idle";
            if (next === states[i]) return;
            states[i] = next;
            li.dataset.state = next;
            if (next === "now") {
              gsap.fromTo(li.querySelector(".jr__card"), { scale: 1 }, { scale: 1.05, duration: 0.25, yoyo: true, repeat: 1 });
            }
          });
        };

        const tween = gsap.fromTo(
          car,
          { y: 0, rotation: 90 },
          {
            y: () => road.offsetHeight,
            rotation: 90,
            ease: "none",
            scrollTrigger: {
              trigger: wrap,
              start: "top 55%",
              end: "bottom 55%",
              scrub: 0.8,
              invalidateOnRefresh: true,
            },
            onUpdate: update,
          }
        );
        gsap.set(car, { opacity: 1 });
        update();

        const ro = new ResizeObserver(() => ScrollTrigger.refresh());
        ro.observe(wrap);

        return () => { ro.disconnect(); tween.scrollTrigger && tween.scrollTrigger.kill(); tween.kill(); };
      });
    }, root);

    return () => ctx.revert(); // kills every ScrollTrigger / tween / media query created above
  }, []);

  const pct = (v, total) => `${(v / total) * 100}%`;

  return (
    <section id="journey" className="jr" ref={rootRef}>
      <div className="jr__head">
        <p className="jr__eyebrow">YOUR JOURNEY</p>
        <h2 className="jr__h2">
          From Sign Up to Insight<br />in Minutes
        </h2>
        <p className="jr__sub">
          Follow the road and see exactly how AI Personal Knowledge Engine takes you from zero to fully productive.
        </p>
      </div>

      {/* ---------------- desktop: pinned road + moving car ---------------- */}
      <div className="jr__stage">
        <div className="jr__canvas">
          <svg className="jr__svg" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
              <filter id="jr-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* faint road bed + dashed marking */}
            <path d={ROAD_D} className="jr__bed" />
            <path d={ROAD_D} className="jr__road" />
            {/* same dashes, brighter, revealed as the car drives */}
            <path d={ROAD_D} className="jr__trail" filter="url(#jr-glow)" />

            {/* connectors + stop dots + ripple rings */}
            {STOPS.map((s, i) => {
              const tx = s.place === "right" ? s.x + TICK : s.x;
              const ty = s.place === "above" ? s.y - TICK : s.place === "below" ? s.y + TICK : s.y;
              return (
                <g key={s.title}>
                  <line x1={s.x} y1={s.y} x2={tx} y2={ty} className="jr__tick" />
                  <circle cx={s.x} cy={s.y} r="7" className="jr__ring" data-stop={i} />
                  <circle cx={s.x} cy={s.y} r="6" className="jr__dot" data-stop={i} data-state="idle" />
                </g>
              );
            })}

            {/* start + end points */}
            <circle cx={X_START} cy={Y1} r="8" className="jr__start-dot" />
            <circle cx={X_R} cy={Y_END} r="8" className="jr__end-dot" />

            {/* the car (driven by GSAP MotionPath) */}
            <g className="jr__car" style={{ opacity: 0 }}>
              <CarShape />
            </g>
          </svg>

          {/* HTML labels, positioned in the same coordinate space */}
          <div className="jr__start" style={{ left: pct(X_START, VB_W), top: pct(Y1, VB_H) }}>
            <span>START</span>
          </div>

          {STOPS.map((s, i) => (
            <div
              key={s.title}
              className={`jr__stop jr__stop--${s.place}`}
              data-stop={i}
              data-state="idle"
              style={{ left: pct(s.x, VB_W), top: pct(s.y, VB_H) }}
            >
              <div className="jr__card">
                <div className="jr__title"><span className="jr__icon">{s.icon}</span>{s.title}</div>
                <div className="jr__desc">{s.sub}</div>
              </div>
            </div>
          ))}

          <div className="jr__end" data-state="idle" style={{ left: pct(X_R, VB_W), top: pct(Y_END + 46, VB_H) }}>
            END <span aria-hidden="true">🏁</span>
          </div>
        </div>
      </div>

      {/* ---------------- mobile: one straight road, stops listed ---------------- */}
      <div className="jr__m">
        <div className="jr__m-start"><i /> START</div>
        <div className="jr__m-road">
          <div className="jr__m-line" />
          <div className="jr__m-car" style={{ opacity: 0 }}>
            <svg viewBox="-36 -22 72 44" width="44" height="27" aria-hidden="true"><CarShape /></svg>
          </div>
        </div>
        <ol className="jr__m-list">
          {STOPS.map((s) => (
            <li key={s.title} className="jr__m-stop" data-state="idle">
              <span className="jr__m-dot" />
              <div className="jr__card">
                <div className="jr__title"><span className="jr__icon">{s.icon}</span>{s.title}</div>
                <div className="jr__desc">{s.sub}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="jr__m-end">END <span aria-hidden="true">🏁</span></div>
      </div>
    </section>
  );
}

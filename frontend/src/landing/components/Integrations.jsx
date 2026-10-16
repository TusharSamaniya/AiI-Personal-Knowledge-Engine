import { BRAND_PATHS } from "./brandPaths.js";

/* ---------- Icons (the LOGO is part of the moving item) ---------- */
const Brand = ({ d }) => (
  <svg className="int__icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} fill="currentColor" />
  </svg>
);

const Stroke = ({ children }) => (
  <svg
    className="int__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const FILE = (
  <>
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
    <path d="M14 2v5a1 1 0 0 0 1 1h5" />
  </>
);

/* `color` = brand colour shown on hover. Default state is muted. */
const ITEMS = [
  { name: "Notion", color: "#000000", icon: <Brand d={BRAND_PATHS.notion} /> },
  { name: "Google Drive", color: "#4285f4", icon: <Brand d={BRAND_PATHS.drive} /> },
  { name: "Jira", color: "#2684ff", icon: <Brand d={BRAND_PATHS.jira} /> },
  { name: "YouTube", color: "#ff0000", icon: <Brand d={BRAND_PATHS.youtube} /> },
  {
    name: "Upload documents",
    color: "#7aa2ff",
    icon: (
      <Stroke>
        {FILE}
        <path d="M12 12v6" />
        <path d="m15 15-3-3-3 3" />
      </Stroke>
    ),
  },
  {
    name: "Send Text",
    color: "#7aa2ff",
    icon: (
      <Stroke>
        <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
        <path d="M7 11h10" />
        <path d="M7 15h6" />
        <path d="M7 7h8" />
      </Stroke>
    ),
  },
  {
    name: "PDF/CSV Upload",
    color: "#7aa2ff",
    icon: (
      <Stroke>
        {FILE}
        <path d="M8 13h2" />
        <path d="M14 13h2" />
        <path d="M8 17h2" />
        <path d="M14 17h2" />
      </Stroke>
    ),
  },
];

function Row({ hidden = false }) {
  return (
    <ul className="int__row" aria-hidden={hidden || undefined}>
      {ITEMS.map((it) => (
        <li key={it.name} className="int__item" style={{ "--brand": it.color }}>
          {it.icon}
          <span className="int__name">{it.name}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Integrations() {
  return (
    <section id="integrations" className="int">
      <div className="int__head">
        <p className="int__eyebrow">INTEGRATIONS</p>
        <h2 className="int__title">
          Every source your knowledge lives in,
          <br />
          connected in one place.
        </h2>
      </div>

      {/* Two identical rows side by side => seamless infinite loop.
          The whole track (logo + text together) slides left -> right. */}
      <div className="int__marquee">
        <div className="int__track">
          <Row />
          <Row hidden />
        </div>
      </div>
    </section>
  );
}

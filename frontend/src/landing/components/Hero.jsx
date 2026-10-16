import BackgroundVideo from "./BackgroundVideo.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Hero() {
  const { user, openAuth } = useAuth();
  return (
    <section id="home" className="hero">
      <BackgroundVideo />
      <div className="hero__shade" />

      <div className="hero__content">
        <h1 className="hero__title">
          Your knowledge
          <br />
          Understood.
        </h1>

        <p className="hero__sub">
          Turn your documents, websites, conversations and connected platforms
          into an intelligent knowledge base — ask anything, get answers traced
          back to the exact source.
        </p>

        <div className="hero__actions">
          {user ? (
            <a href="#work" className="btn btn--light">
              Go to your work
            </a>
          ) : (
            <button type="button" className="btn btn--light" onClick={() => openAuth("signup")}>
              Get Started
            </button>
          )}
          <a href="#how-it-works" className="btn btn--outline">
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}

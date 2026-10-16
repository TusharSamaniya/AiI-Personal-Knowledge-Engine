import { useEffect } from "react";
import Navbar       from "./Navbar.jsx";
import Hero         from "./Hero.jsx";
import Integrations from "./Integrations.jsx";
import Features     from "./Features.jsx";
import HowItWorks   from "./HowItWorks.jsx";
import Journey      from "./Journey.jsx";
import Faq          from "./Faq.jsx";
import Footer       from "./Footer.jsx";
import AuthPage     from "./auth/AuthPage.jsx";
import SolutionsPage from "../pages/SolutionsPage.jsx";
import ContactPage   from "../pages/ContactPage.jsx";
import { useHash }   from "../lib/useHash.js";
import "../styles.css";

export default function LandingApp() {
  const hash       = useHash();
  const onSolutions = hash === "#solutions";
  const onContact   = hash === "#connect";

  useEffect(() => {
    if (onSolutions || onContact) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    const id = hash.slice(1);
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView(), 50);
    return () => clearTimeout(t);
  }, [hash, onSolutions, onContact]);

  return (
    <>
      <Navbar />
      {onSolutions ? (
        <main><SolutionsPage /></main>
      ) : onContact ? (
        <main><ContactPage /></main>
      ) : (
        <main>
          <Hero />
          <Integrations />
          <Features />
          <HowItWorks />
          <Journey />
          <Faq />
        </main>
      )}
      <Footer />
      <AuthPage />
    </>
  );
}

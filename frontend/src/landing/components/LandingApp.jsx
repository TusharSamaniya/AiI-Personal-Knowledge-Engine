import { useEffect } from "react";
import Navbar from "./landing/components/Navbar.jsx";
import Hero from "./landing/components/Hero.jsx";
import Integrations from "./landing/components/Integrations.jsx";
import Features from "./landing/components/Features.jsx";
import HowItWorks from "./landing/components/HowItWorks.jsx";
import Journey from "./landing/components/Journey.jsx";
import Faq from "./landing/components/Faq.jsx";
import Footer from "./landing/components/Footer.jsx";
import AuthPage from "./landing/components/auth/AuthPage.jsx";
import SolutionsPage from "./landing/pages/SolutionsPage.jsx";
import ContactPage from "./landing/pages/ContactPage.jsx";
import { useHash } from "./landing/lib/useHash.js";
import './styles.css';

export default function App() {
  const hash = useHash();
  const onSolutions = hash === "#solutions";
  const onContact = hash === "#connect";

  // The site uses hash links (no router): "#solutions" shows the Solutions page,
  // every other hash shows the home page and scrolls to that section.
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
        <main>
          <SolutionsPage />
        </main>
      ) : onContact ? (
        <main>
          <ContactPage />
        </main>
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

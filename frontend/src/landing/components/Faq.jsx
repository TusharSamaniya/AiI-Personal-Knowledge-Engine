import { useState } from "react";

/* ------------------------------------------------------------------ *
 *  CONTENT – edit questions / answers / background image here
 * ------------------------------------------------------------------ */
const FAQS = [
  {
    q: "How is this different from ChatGPT or Claude?",
    a: "ChatGPT and Claude are general purpose AI assistants that answer from their own training data. They have no memory of your files between sessions — every time you close the chat, your uploaded content is gone. AI Personal Knowledge Engine is completely different. Your content is stored permanently in your projects, grows over time as you add more, and the AI answers exclusively from your own uploaded material — never from the internet or its own assumptions. It also adds features like quiz generation, flashcards, weakness tracking, team collaboration, and third party integrations that no general chatbot offers.",
  },
  {
    q: "What types of files and content can I upload?",
    a: "You can upload PDF documents, Word files (DOCX), plain text files (TXT), and CSV files directly from your computer. You can paste YouTube video links and the platform automatically extracts the full spoken transcript. You can paste any website URL and the platform scrapes and indexes the entire page content. You can also connect Google Drive, Slack, Notion, and Jira to import content directly from those platforms without any manual downloading or uploading.",
  },
  {
    q: "How does the AI answer questions from my content?",
    a: "The platform uses a technique called Retrieval Augmented Generation or RAG. When you ask a question, the system converts your question into a mathematical vector and searches your entire knowledge base for the most semantically similar content chunks. The most relevant pieces are then passed to a large language model along with your question, and the model generates a precise answer based only on those retrieved pieces. This means every answer is grounded in your actual content and the AI cannot make things up or answer from outside sources.",
  },
  {
    q: "Can different team members see each other’s questions and answers?",
    a: "Chat history is shared within a project so all team members can see conversations that happened in the project. This is intentional — it means if one team member asks an important question, the answer is visible to the whole team and does not need to be asked again. In a future update we will add the option for private chat sessions within shared projects.",
  },
  {
    q: "What happens to my data if I delete my account?",
    a: "When you delete your account all your projects, uploaded files, embeddings, chat history, and personal data are permanently deleted from our servers within 30 days of account deletion. This deletion is irreversible. We recommend exporting any important information before deleting your account.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(null); // index of the expanded question, or null

  return (
    <section id="faq" className="faq">
      <div className="faq__card">
        <h2 className="faq__title">FAQ&rsquo;s</h2>

        <ul className="faq__list">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q} className={`faq__item ${isOpen ? "is-open" : ""}`}>
                <h3 className="faq__heading">
                  <button
                    type="button"
                    className="faq__q"
                    id={`faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <span>{item.q}</span>
                    <svg className="faq__chev" viewBox="0 0 24 24" width="22" height="22" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      strokeLinejoin="round" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </h3>
                <div
                  className="faq__panel"
                  id={`faq-a-${i}`}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                >
                  <div className="faq__panel-inner">
                    <p className="faq__a">{item.a}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

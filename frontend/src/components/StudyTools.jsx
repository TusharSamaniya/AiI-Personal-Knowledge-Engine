import { useState } from 'react';
import api from '../api/axios';

export default function StudyTools({ projectId }) {
  const [tab, setTab] = useState('flashcards'); // 'flashcards' | 'summary' | 'eli5'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Flashcards state
  const [cards, setCards] = useState([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [numCards, setNumCards] = useState(10);

  // Summary state
  const [summary, setSummary] = useState('');

  // ELI5 state
  const [eliQuestion, setEliQuestion] = useState('');
  const [eliAnswer, setEliAnswer] = useState('');

  const handleGenerateFlashcards = async () => {
    setLoading(true); setMessage('');
    try {
      const res = await api.post('/study/generate', null, {
        params: { project_id: projectId, mode: 'flashcards', num_cards: numCards }
      });
      setCards(res.data.cards || []);
      setCardIdx(0);
      setFlipped(false);
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.detail || 'Failed to generate flashcards.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    setLoading(true); setMessage('');
    try {
      const res = await api.post('/study/generate', null, {
        params: { project_id: projectId, mode: 'summary' }
      });
      setSummary(res.data.summary || '');
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.detail || 'Failed to generate summary.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEli5 = async () => {
    if (!eliQuestion.trim()) {
      setMessage('Please enter a question.');
      return;
    }
    setLoading(true); setMessage('');
    try {
      const res = await api.post('/study/generate', null, {
        params: { project_id: projectId, mode: 'eli5', question: eliQuestion }
      });
      setEliAnswer(res.data.answer || '');
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.detail || 'Failed to generate ELI5.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>📚 Study Tools</h4>

      {/* Tab Bar */}
      <div style={styles.tabBar}>
        <button
          onClick={() => setTab('flashcards')}
          style={tab === 'flashcards' ? styles.tabActive : styles.tabInactive}
        >
          📇 Flashcards
        </button>
        <button
          onClick={() => setTab('summary')}
          style={tab === 'summary' ? styles.tabActive : styles.tabInactive}
        >
          📄 Summary
        </button>
        <button
          onClick={() => setTab('eli5')}
          style={tab === 'eli5' ? styles.tabActive : styles.tabInactive}
        >
          👶 ELI5
        </button>
      </div>

      {message && <p style={styles.message}>{message}</p>}

      {/* FLASHCARDS TAB */}
      {tab === 'flashcards' && (
        <div>
          <div style={styles.controls}>
            <label style={styles.label}>Cards:</label>
            <select value={numCards} onChange={(e) => setNumCards(Number(e.target.value))} style={styles.select}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
            </select>
            <button onClick={handleGenerateFlashcards} disabled={loading} style={styles.primaryButton}>
              {loading ? 'Generating...' : 'Generate Flashcards'}
            </button>
          </div>

          {cards.length > 0 && (
            <>
              <p style={styles.progress}>Card {cardIdx + 1} of {cards.length}</p>
              <div
                onClick={() => setFlipped(!flipped)}
                style={flipped ? styles.cardBack : styles.cardFront}
              >
                <div style={styles.cardLabel}>{flipped ? 'Answer' : 'Question'}</div>
                <div style={styles.cardText}>
                  {flipped ? cards[cardIdx].back : cards[cardIdx].front}
                </div>
                <div style={styles.cardHint}>Click to flip</div>
              </div>

              <div style={styles.navRow}>
                <button
                  onClick={() => { setCardIdx(cardIdx - 1); setFlipped(false); }}
                  disabled={cardIdx === 0}
                  style={styles.navButton}
                >
                  ← Prev
                </button>
                <button
                  onClick={() => { setCardIdx(cardIdx + 1); setFlipped(false); }}
                  disabled={cardIdx === cards.length - 1}
                  style={styles.navButton}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* SUMMARY TAB */}
      {tab === 'summary' && (
        <div>
          <button onClick={handleGenerateSummary} disabled={loading} style={styles.primaryButton}>
            {loading ? 'Summarizing...' : 'Generate Summary'}
          </button>
          {summary && (
            <div style={styles.summaryBox}>
              <p style={styles.summaryText}>{summary}</p>
            </div>
          )}
        </div>
      )}

      {/* ELI5 TAB */}
      {tab === 'eli5' && (
        <div>
          <p style={styles.text}>Ask a question and I'll explain it like you're 5 years old.</p>
          <div style={styles.eli5InputRow}>
            <input
              value={eliQuestion}
              onChange={(e) => setEliQuestion(e.target.value)}
              placeholder="e.g., What is Newton's 3rd Law?"
              style={styles.input}
            />
            <button onClick={handleGenerateEli5} disabled={loading} style={styles.primaryButton}>
              {loading ? '...' : 'Explain'}
            </button>
          </div>
          {eliAnswer && (
            <div style={styles.eli5Box}>
              <div style={styles.eli5Emoji}>👶</div>
              <p style={styles.eli5Text}>{eliAnswer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { marginTop: '20px', padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '10px', border: '1px solid #a5d6a7' },
  title: { marginTop: 0, marginBottom: '15px' },
  tabBar: { display: 'flex', gap: '8px', marginBottom: '15px' },
  tabActive: { padding: '8px 16px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  tabInactive: { padding: '8px 16px', backgroundColor: '#c8e6c9', color: '#2e7d32', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  message: { marginTop: '10px', color: '#dc3545' },
  controls: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' },
  label: { fontWeight: '600', fontSize: '14px' },
  select: { padding: '6px 10px', borderRadius: '5px', border: '1px solid #ccc' },
  primaryButton: { padding: '10px 20px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
  progress: { color: '#666', fontSize: '13px', marginBottom: '8px' },
  cardFront: { padding: '40px 20px', backgroundColor: '#fff9c4', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', minHeight: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '2px solid #fbc02d' },
  cardBack: { padding: '40px 20px', backgroundColor: '#bbdefb', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', minHeight: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '2px solid #1976d2' },
  cardLabel: { fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' },
  cardText: { fontSize: '18px', fontWeight: '500', color: '#222' },
  cardHint: { fontSize: '11px', color: '#999', marginTop: '15px' },
  navRow: { display: 'flex', justifyContent: 'space-between', marginTop: '15px' },
  navButton: { padding: '8px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' },
  summaryBox: { marginTop: '15px', padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ddd' },
  summaryText: { margin: 0, lineHeight: '1.6', color: '#333' },
  text: { margin: '10px 0', color: '#555' },
  eli5InputRow: { display: 'flex', gap: '10px', marginBottom: '15px' },
  input: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' },
  eli5Box: { padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px', border: '1px solid #ffcc80', position: 'relative' },
  eli5Emoji: { fontSize: '30px', marginBottom: '10px' },
  eli5Text: { margin: 0, lineHeight: '1.7', color: '#333', fontSize: '15px' }
};
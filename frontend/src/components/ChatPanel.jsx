import { useState, useRef, useEffect } from 'react';
import api from '../api/axios';

export default function ChatPanel({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    const userMsg = { role: 'user', text: question };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/query', null, {
        params: { project_id: projectId, question: question }
      });
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: res.data.answer, sources: res.data.sources }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: '❌ Error fetching answer. Please try again.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>💬 Ask questions about your files</h3>

      <div style={styles.messages}>
        {messages.length === 0 && (
          <p style={styles.empty}>No messages yet. Ask your first question below!</p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? styles.userRow : styles.aiRow}>
            <div style={m.role === 'user' ? styles.userBubble : styles.aiBubble}>
              <p style={styles.bubbleText}>{m.text}</p>
              {m.sources && m.sources.length > 0 && (
                <p style={styles.sources}>📄 Sources: {m.sources.join(', ')}</p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={styles.aiRow}>
            <div style={styles.aiBubble}>
              <p style={styles.bubbleText}>⏳ Thinking...</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={styles.inputBar}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your files..."
          style={styles.input}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()} style={styles.sendButton}>
          {loading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: { marginTop: '30px', padding: '20px', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  title: { marginTop: 0, marginBottom: '15px' },
  messages: { maxHeight: '500px', overflowY: 'auto', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '15px' },
  empty: { color: '#888', textAlign: 'center', padding: '20px' },
  userRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' },
  aiRow: { display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' },
  userBubble: { backgroundColor: '#007bff', color: 'white', padding: '10px 15px', borderRadius: '15px 15px 0 15px', maxWidth: '70%' },
  aiBubble: { backgroundColor: '#e9ecef', color: '#333', padding: '10px 15px', borderRadius: '15px 15px 15px 0', maxWidth: '70%' },
  bubbleText: { margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' },
  sources: { margin: '8px 0 0 0', fontSize: '12px', color: '#666', fontStyle: 'italic' },
  inputBar: { display: 'flex', gap: '10px' },
  input: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px' },
  sendButton: { padding: '12px 24px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }
};
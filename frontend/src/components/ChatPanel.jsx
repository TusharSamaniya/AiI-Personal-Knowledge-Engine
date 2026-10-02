import { useState, useRef, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

export default function ChatPanel({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);

    // Add an empty AI message that we'll fill in as tokens arrive
    setMessages(prev => [...prev, { role: 'ai', text: '', sources: [], streaming: true }]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/query/stream?project_id=${projectId}&question=${encodeURIComponent(question)}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on double newlines (SSE message separator)
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep the last incomplete chunk

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6); // Remove "data: "
          
          try {
            const parsed = JSON.parse(payload);

            if (parsed.type === 'sources') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, sources: parsed.sources };
                return updated;
              });
            } else if (parsed.type === 'token') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, text: last.text + parsed.text };
                return updated;
              });
            } else if (parsed.type === 'done') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, streaming: false };
                return updated;
              });
            } else if (parsed.type === 'error') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, text: '❌ ' + parsed.message, streaming: false };
                return updated;
              });
            }
          } catch (err) {
            console.error('Failed to parse SSE line:', line, err);
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = { ...last, text: '❌ Error fetching answer. Please try again.', streaming: false };
        return updated;
      });
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
              <p style={styles.bubbleText}>
                {m.text}
                {m.streaming && <span style={styles.cursor}>▋</span>}
              </p>
              {m.sources && m.sources.length > 0 && (
                <p style={styles.sources}>📄 Sources: {m.sources.join(', ')}</p>
              )}
            </div>
          </div>
        ))}
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
  cursor: { animation: 'blink 1s infinite', marginLeft: '2px' },
  sources: { margin: '8px 0 0 0', fontSize: '12px', color: '#666', fontStyle: 'italic' },
  inputBar: { display: 'flex', gap: '10px' },
  input: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px' },
  sendButton: { padding: '12px 24px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }
};
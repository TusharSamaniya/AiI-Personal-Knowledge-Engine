import { useState, useRef, useEffect } from 'react';
import api from '../api/axios';
import { API_BASE } from '../api/config';

export default function ChatPanel({ projectId, bare = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load chat history when project changes
  useEffect(() => {
    if (!projectId) return;

    api.get(`/chat/history/${projectId}`)
      .then(res => {
        const historyMessages = [];

        res.data.forEach(h => {
          historyMessages.push({ role: 'user', text: h.question });
          historyMessages.push({
            role: 'ai',
            text: h.answer,
            sources: []
          });
        });

        setMessages(historyMessages);
      })
      .catch(err => {
        console.error('Failed to load chat history:', err);
        setMessages([]);
      });
  }, [projectId]);

  const handleSend = async (e) => {
    e.preventDefault();

    if (!input.trim() || loading) return;

    const question = input.trim();

    setMessages(prev => [
      ...prev,
      { role: 'user', text: question },
      { role: 'ai', text: '', sources: [], streaming: true }
    ]);

    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${API_BASE}/query/stream?project_id=${encodeURIComponent(projectId)}&question=${encodeURIComponent(question)}`,
        {
          method: 'POST',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'text/event-stream'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Streaming response body is unavailable.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamFinished = false;

      const updateLastMessage = (update) => {
        setMessages(prev => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;

          if (lastIndex < 0) return prev;

          updated[lastIndex] = update(updated[lastIndex]);
          return updated;
        });
      };

      const processSSE = (block) => {
        const data = block
          .split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart())
          .join('\n');

        if (!data) return;

        try {
          const parsed = JSON.parse(data);

          if (parsed.type === 'sources') {
            updateLastMessage(last => ({
              ...last,
              sources: parsed.sources || []
            }));
          } else if (parsed.type === 'token') {
            updateLastMessage(last => ({
              ...last,
              text: last.text + (parsed.text || '')
            }));
          } else if (parsed.type === 'done') {
            streamFinished = true;
            updateLastMessage(last => ({
              ...last,
              streaming: false
            }));
          } else if (parsed.type === 'error') {
            streamFinished = true;
            updateLastMessage(last => ({
              ...last,
              text: '❌ ' + (parsed.message || 'Something went wrong.'),
              streaming: false
            }));
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';

        blocks.forEach(processSSE);
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        processSSE(buffer);
      }

      if (!streamFinished) {
        updateLastMessage(last => ({
          ...last,
          streaming: false,
          ...(!last.text
            ? { text: 'The response ended unexpectedly. Please try again.' }
            : {})
        }));
      }
    } catch (err) {
      console.error('Failed to fetch streamed answer:', err);

      setMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;

        if (lastIndex >= 0) {
          updated[lastIndex] = {
            ...updated[lastIndex],
            text: '❌ Error fetching answer. Please try again.',
            streaming: false
          };
        }

        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {!bare && (
        <h3 style={styles.title}>
          💬 Ask questions about your files
        </h3>
      )}

      <div style={styles.messages}>
        {messages.length === 0 && (
          <p style={styles.empty}>
            No messages yet. Ask your first question below!
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={m.role === 'user' ? styles.userRow : styles.aiRow}
          >
            <div
              style={m.role === 'user' ? styles.userBubble : styles.aiBubble}
            >
              <p style={styles.bubbleText}>
                {m.text}
                {m.streaming && <span style={styles.cursor}>▋</span>}
              </p>

              {m.sources && m.sources.length > 0 && (
                <p style={styles.sources}>
                  📄 Sources: {m.sources.join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={styles.inputBar}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question about your files..."
          style={styles.input}
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={styles.sendButton}
        >
          {loading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#fff',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  title: { marginTop: 0, marginBottom: '15px' },
  messages: {
    maxHeight: '500px',
    overflowY: 'auto',
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    marginBottom: '15px'
  },
  empty: { color: '#888', textAlign: 'center', padding: '20px' },
  userRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' },
  aiRow: { display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' },
  userBubble: {
    backgroundColor: '#007bff',
    color: 'white',
    padding: '10px 15px',
    borderRadius: '15px 15px 0 15px',
    maxWidth: '70%'
  },
  aiBubble: {
    backgroundColor: '#e9ecef',
    color: '#333',
    padding: '10px 15px',
    borderRadius: '15px 15px 15px 0',
    maxWidth: '70%'
  },
  bubbleText: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word'
  },
  cursor: { animation: 'blink 1s infinite', marginLeft: '2px' },
  sources: {
    margin: '8px 0 0 0',
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic'
  },
  inputBar: { display: 'flex', gap: '10px' },
  input: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    fontSize: '14px'
  },
  sendButton: {
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  }
};
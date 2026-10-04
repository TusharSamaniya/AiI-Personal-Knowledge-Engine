import { useState, useEffect } from 'react';
import api from '../api/axios';

const API_BASE = 'http://localhost:8000';

export default function NotionIntegration() {
  const [connected, setConnected] = useState(false);
  const [pages, setPages] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check if URL has ?notion=connected from the OAuth redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('notion') === 'connected') {
      setMessage('✅ Notion connected successfully!');
      window.history.replaceState({}, '', '/dashboard');
    }
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      await api.get('/integrations/notion/pages');
      setConnected(true);
    } catch {
      setConnected(false);
    }
  };

  const handleConnect = () => {
    const token = localStorage.getItem('token');
    // Full-page redirect because Notion's OAuth is a browser flow
    window.location.href = `${API_BASE}/integrations/notion/connect?token=${token}`;
  };

  const openPagePicker = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.get('/integrations/notion/pages');
      setPages(res.data);
      setShowModal(true);
    } catch (err) {
      setMessage('❌ Failed to list Notion pages.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (page) => {
    setLoading(true);
    try {
      await api.post('/integrations/notion/import', null, {
        params: { page_id: page.id, page_title: page.title }
      });
      setMessage(`✅ Importing "${page.title}"... Check the files list below.`);
      setShowModal(false);
    } catch (err) {
      setMessage('❌ Import failed. Make sure you have an active project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>📝 Notion</h4>

      {!connected ? (
        <>
          <p style={styles.text}>Connect your Notion account to import pages.</p>
          <button onClick={handleConnect} style={styles.connectButton}>
            Connect Notion
          </button>
        </>
      ) : (
        <>
          <p style={styles.text}>✅ Notion is connected.</p>
          <button onClick={openPagePicker} disabled={loading} style={styles.importButton}>
            {loading ? 'Loading...' : '📄 Import from Notion'}
          </button>
        </>
      )}

      {message && <p style={styles.message}>{message}</p>}

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Select a Notion page</h3>
            {pages.length === 0 && (
              <p style={styles.emptyText}>
                No pages found. Make sure you've shared pages with the "AI Knowledge Engine" integration in Notion.
              </p>
            )}
            <ul style={styles.pageList}>
              {pages.map((p) => (
                <li key={p.id} style={styles.pageItem}>
                  <span style={styles.pageName}>{p.title}</span>
                  <button
                    onClick={() => handleImport(p)}
                    disabled={loading}
                    style={styles.importSmallButton}
                  >
                    Import
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowModal(false)} style={styles.closeButton}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { marginTop: '20px', padding: '20px', backgroundColor: '#f7f6f3', borderRadius: '10px', border: '1px solid #e0ddd5' },
  title: { marginTop: 0, marginBottom: '10px' },
  text: { margin: '10px 0', color: '#555' },
  connectButton: { padding: '10px 20px', backgroundColor: '#000000', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  importButton: { padding: '10px 20px', backgroundColor: '#2eaadc', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  message: { marginTop: '15px', color: '#333' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', width: '500px', maxHeight: '80vh', overflowY: 'auto' },
  modalTitle: { marginTop: 0, marginBottom: '15px' },
  emptyText: { color: '#888', fontSize: '14px' },
  pageList: { listStyle: 'none', padding: 0, maxHeight: '400px', overflowY: 'auto' },
  pageItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' },
  pageName: { flex: 1, marginRight: '10px', overflow: 'hidden', textOverflow: 'ellipsis' },
  importSmallButton: { padding: '5px 15px', backgroundColor: '#2eaadc', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' },
  closeButton: { marginTop: '15px', padding: '8px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }
};
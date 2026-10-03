import { useState, useEffect } from 'react';
import api from '../api/axios';

const API_BASE = 'http://localhost:8000';

export default function DriveIntegration() {
  const [connected, setConnected] = useState(false);
  const [files, setFiles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check if URL has ?drive=connected from the OAuth redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('drive') === 'connected') {
      setMessage('✅ Google Drive connected successfully!');
      // Clean the URL
      window.history.replaceState({}, '', '/dashboard');
    }
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      await api.get('/integrations/drive/files');
      setConnected(true);
    } catch {
      setConnected(false);
    }
  };

  const handleConnect = () => {
    const token = localStorage.getItem('token');
    // Full-page redirect (not AJAX) because Google OAuth is a browser flow
    window.location.href = `${API_BASE}/integrations/drive/connect?token=${token}`;
  };

  const openFilePicker = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.get('/integrations/drive/files');
      setFiles(res.data);
      setShowModal(true);
    } catch (err) {
      setMessage('❌ Failed to list Drive files.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (file) => {
    setLoading(true);
    try {
      await api.post('/integrations/drive/import', null, {
        params: { file_id: file.id, file_name: file.name }
      });
      setMessage(`✅ Importing "${file.name}"... Check the files list below.`);
      setShowModal(false);
    } catch (err) {
      setMessage('❌ Import failed. Make sure you have an active project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>🔗 Google Drive</h4>

      {!connected ? (
        <>
          <p style={styles.text}>Connect your Google Drive to import files directly.</p>
          <button onClick={handleConnect} style={styles.connectButton}>
            Connect Google Drive
          </button>
        </>
      ) : (
        <>
          <p style={styles.text}>✅ Google Drive is connected.</p>
          <button onClick={openFilePicker} disabled={loading} style={styles.importButton}>
            {loading ? 'Loading...' : '📁 Import from Drive'}
          </button>
        </>
      )}

      {message && <p style={styles.message}>{message}</p>}

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Select a file from Google Drive</h3>
            {files.length === 0 && <p>No files found.</p>}
            <ul style={styles.fileList}>
              {files.map((f) => (
                <li key={f.id} style={styles.fileItem}>
                  <span style={styles.fileName}>{f.name}</span>
                  <button
                    onClick={() => handleImport(f)}
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
  container: { marginTop: '20px', padding: '20px', backgroundColor: '#f0f4ff', borderRadius: '10px', border: '1px solid #d0d9f0' },
  title: { marginTop: 0, marginBottom: '10px' },
  text: { margin: '10px 0', color: '#555' },
  connectButton: { padding: '10px 20px', backgroundColor: '#4285f4', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  importButton: { padding: '10px 20px', backgroundColor: '#34a853', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  message: { marginTop: '15px', color: '#333' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', width: '500px', maxHeight: '80vh', overflowY: 'auto' },
  modalTitle: { marginTop: 0, marginBottom: '15px' },
  fileList: { listStyle: 'none', padding: 0, maxHeight: '400px', overflowY: 'auto' },
  fileItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' },
  fileName: { flex: 1, marginRight: '10px', overflow: 'hidden', textOverflow: 'ellipsis' },
  importSmallButton: { padding: '5px 15px', backgroundColor: '#34a853', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' },
  closeButton: { marginTop: '15px', padding: '8px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }
};
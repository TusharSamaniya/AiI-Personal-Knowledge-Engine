import { useState, useEffect } from 'react';
import api from '../api/axios';

const API_BASE = 'http://localhost:8000';

export default function JiraIntegration() {
  const [connected, setConnected] = useState(false);
  const [sites, setSites] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('jira') === 'connected') {
      setMessage('✅ Jira connected successfully!');
      window.history.replaceState({}, '', '/dashboard');
    }
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      await api.get('/integrations/jira/sites');
      setConnected(true);
    } catch {
      setConnected(false);
    }
  };

  const handleConnect = () => {
    const token = localStorage.getItem('token');
    window.location.href = `${API_BASE}/integrations/jira/connect?token=${token}`;
  };

  const openSitePicker = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.get('/integrations/jira/sites');
      setSites(res.data);
      if (res.data.length === 1) {
        // Auto-select if only one site
        handleSelectSite(res.data[0]);
      } else {
        setShowSiteModal(true);
      }
    } catch (err) {
      setMessage('❌ Failed to list Jira sites. Try reconnecting.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSite = async (site) => {
    setSelectedSite(site);
    setShowSiteModal(false);
    setLoading(true);
    try {
      const res = await api.get('/integrations/jira/projects', {
        params: { cloud_id: site.id }
      });
      setProjects(res.data);
      setShowProjectModal(true);
    } catch (err) {
      setMessage('❌ Failed to list projects for this site.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportProject = async (project) => {
    setLoading(true);
    try {
      await api.post('/integrations/jira/import', null, {
        params: {
          cloud_id: selectedSite.id,
          project_key: project.key,
          project_name: project.name
        }
      });
      setMessage(`✅ Importing issues from "${project.name}"... Check the files list below.`);
      setShowProjectModal(false);
      setSelectedSite(null);
      setProjects([]);
    } catch (err) {
      setMessage('❌ Import failed. Make sure you have an active project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>🎫 Jira</h4>

      {!connected ? (
        <>
          <p style={styles.text}>Connect your Jira account to import issues and documentation.</p>
          <button onClick={handleConnect} style={styles.connectButton}>
            Connect Jira
          </button>
        </>
      ) : (
        <>
          <p style={styles.text}>✅ Jira is connected.</p>
          <button onClick={openSitePicker} disabled={loading} style={styles.importButton}>
            {loading ? 'Loading...' : '🎫 Import from Jira'}
          </button>
        </>
      )}

      {message && <p style={styles.message}>{message}</p>}

      {/* Site Picker Modal */}
      {showSiteModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Select a Jira site</h3>
            <ul style={styles.list}>
              {sites.map((s) => (
                <li key={s.id} style={styles.listItem}>
                  <div>
                    <strong>{s.name}</strong>
                    <p style={styles.subtext}>{s.url}</p>
                  </div>
                  <button onClick={() => handleSelectSite(s)} style={styles.selectButton}>
                    Select
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowSiteModal(false)} style={styles.closeButton}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Project Picker Modal */}
      {showProjectModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>
              Select a project from {selectedSite?.name}
            </h3>
            {projects.length === 0 && (
              <p style={styles.emptyText}>No projects found in this site.</p>
            )}
            <ul style={styles.list}>
              {projects.map((p) => (
                <li key={p.id} style={styles.listItem}>
                  <div>
                    <strong>{p.name}</strong>
                    <p style={styles.subtext}>Key: {p.key}</p>
                  </div>
                  <button
                    onClick={() => handleImportProject(p)}
                    disabled={loading}
                    style={styles.importSmallButton}
                  >
                    {loading ? '...' : 'Import'}
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowProjectModal(false)} style={styles.closeButton}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { marginTop: '20px', padding: '20px', backgroundColor: '#e6f0ff', borderRadius: '10px', border: '1px solid #c8d9f5' },
  title: { marginTop: 0, marginBottom: '10px' },
  text: { margin: '10px 0', color: '#555' },
  connectButton: { padding: '10px 20px', backgroundColor: '#0052CC', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  importButton: { padding: '10px 20px', backgroundColor: '#2684FF', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  message: { marginTop: '15px', color: '#333' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', width: '550px', maxHeight: '80vh', overflowY: 'auto' },
  modalTitle: { marginTop: 0, marginBottom: '15px' },
  emptyText: { color: '#888', fontSize: '14px' },
  list: { listStyle: 'none', padding: 0, maxHeight: '400px', overflowY: 'auto' },
  listItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 10px', borderBottom: '1px solid #eee' },
  subtext: { margin: '4px 0 0 0', fontSize: '12px', color: '#888' },
  selectButton: { padding: '6px 16px', backgroundColor: '#0052CC', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' },
  importSmallButton: { padding: '6px 16px', backgroundColor: '#2684FF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' },
  closeButton: { marginTop: '15px', padding: '8px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }
};
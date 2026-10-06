import { useState, useEffect } from 'react';
import api from '../api/axios';

const API_BASE = 'http://localhost:8000';

export default function SlackIntegration() {
  const [connected, setConnected] = useState(false);
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState({});  // { channel_id: true/false }
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check if URL has ?slack=connected from the OAuth redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('slack') === 'connected') {
      setMessage('✅ Slack connected successfully!');
      window.history.replaceState({}, '', '/dashboard');
    }
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      await api.get('/integrations/slack/channels');
      setConnected(true);
    } catch {
      setConnected(false);
    }
  };

  const handleConnect = () => {
    const token = localStorage.getItem('token');
    window.location.href = `${API_BASE}/integrations/slack/connect?token=${token}`;
  };

  const openChannelPicker = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await api.get('/integrations/slack/channels');
      setChannels(res.data);
      // Reset selections
      const initial = {};
      res.data.forEach(c => { initial[c.id] = false; });
      setSelected(initial);
      setShowModal(true);
    } catch (err) {
      setMessage('❌ Failed to list Slack channels. Make sure the bot is invited to them.');
    } finally {
      setLoading(false);
    }
  };

  const toggleChannel = (channelId) => {
    setSelected(prev => ({ ...prev, [channelId]: !prev[channelId] }));
  };

  const handleImportSelected = async () => {
    const toImport = channels.filter(c => selected[c.id]);
    if (toImport.length === 0) {
      setMessage('⚠️ Please select at least one channel.');
      return;
    }

    setLoading(true);
    setMessage('');
    let successCount = 0;
    let failCount = 0;

    for (const channel of toImport) {
      try {
        await api.post('/integrations/slack/import', null, {
          params: { channel_id: channel.id, channel_name: channel.name }
        });
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    setShowModal(false);
    setLoading(false);
    
    if (successCount > 0) {
      setMessage(`✅ Queued ${successCount} channel(s) for import. ${failCount > 0 ? `${failCount} failed.` : ''} Check the files list below.`);
    } else {
      setMessage(`❌ All imports failed. Make sure you have an active project and the bot is in the channels.`);
    }
  };

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>💬 Slack</h4>

      {!connected ? (
        <>
          <p style={styles.text}>Connect your Slack workspace to import channel conversations.</p>
          <button onClick={handleConnect} style={styles.connectButton}>
            Connect Slack Workspace
          </button>
        </>
      ) : (
        <>
          <p style={styles.text}>✅ Slack is connected.</p>
          <button onClick={openChannelPicker} disabled={loading} style={styles.importButton}>
            {loading ? 'Loading...' : '💬 Import from Slack'}
          </button>
        </>
      )}

      {message && <p style={styles.message}>{message}</p>}

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Select channels to import</h3>
            <p style={styles.modalHint}>
              The bot can only see channels it's been invited to. In Slack, type{' '}
              <code>/invite @AI Knowledge Engine</code> in a channel to grant access.
            </p>

            {channels.length === 0 && (
              <p style={styles.emptyText}>
                No channels found. Invite the bot to at least one channel and try again.
              </p>
            )}

            <ul style={styles.channelList}>
              {channels.map((c) => (
                <li
                  key={c.id}
                  style={styles.channelItem}
                  onClick={() => toggleChannel(c.id)}
                >
                  <input
                    type="checkbox"
                    checked={selected[c.id] || false}
                    onChange={() => toggleChannel(c.id)}
                    style={styles.checkbox}
                  />
                  <span style={styles.channelName}>
                    {c.is_private ? '🔒 ' : '#'}{c.name}
                  </span>
                  <span style={styles.memberCount}>{c.member_count} members</span>
                </li>
              ))}
            </ul>

            <div style={styles.buttonRow}>
              <button onClick={() => setShowModal(false)} style={styles.cancelButton}>
                Cancel
              </button>
              <button
                onClick={handleImportSelected}
                disabled={loading || channels.length === 0}
                style={styles.importSelectedButton}
              >
                {loading ? 'Importing...' : `Import Selected (${Object.values(selected).filter(Boolean).length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { marginTop: '20px', padding: '20px', backgroundColor: '#f5e6f7', borderRadius: '10px', border: '1px solid #e0c8e5' },
  title: { marginTop: 0, marginBottom: '10px' },
  text: { margin: '10px 0', color: '#555' },
  connectButton: { padding: '10px 20px', backgroundColor: '#4A154B', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  importButton: { padding: '10px 20px', backgroundColor: '#ECB22E', color: '#1d1c1d', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  message: { marginTop: '15px', color: '#333' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'white', padding: '25px', borderRadius: '10px', width: '550px', maxHeight: '80vh', overflowY: 'auto' },
  modalTitle: { marginTop: 0, marginBottom: '10px' },
  modalHint: { fontSize: '13px', color: '#666', backgroundColor: '#fff8e1', padding: '10px', borderRadius: '5px', marginBottom: '15px' },
  emptyText: { color: '#888', fontSize: '14px' },
  channelList: { listStyle: 'none', padding: 0, maxHeight: '350px', overflowY: 'auto' },
  channelItem: { display: 'flex', alignItems: 'center', padding: '12px 10px', borderBottom: '1px solid #eee', cursor: 'pointer' },
  checkbox: { marginRight: '12px', width: '18px', height: '18px', cursor: 'pointer' },
  channelName: { flex: 1, fontWeight: '500' },
  memberCount: { color: '#888', fontSize: '12px' },
  buttonRow: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' },
  cancelButton: { padding: '8px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' },
  importSelectedButton: { padding: '8px 20px', backgroundColor: '#4A154B', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }
};
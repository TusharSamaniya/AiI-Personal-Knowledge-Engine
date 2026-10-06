import { useState, useEffect } from 'react';
import api from '../api/axios';

const INTEGRATION_INFO = {
  google_drive: { name: 'Google Drive', icon: '📁', color: '#4285f4' },
  notion:       { name: 'Notion',       icon: '📝', color: '#000000' },
  slack:        { name: 'Slack',        icon: '💬', color: '#4A154B' },
  jira:         { name: 'Jira',         icon: '🎫', color: '#0052CC' },
};

export default function IntegrationsManager() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/integrations/list');
      setIntegrations(res.data);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleDisconnect = async (type) => {
    if (!window.confirm(`Disconnect ${INTEGRATION_INFO[type]?.name || type}?`)) return;
    try {
      await api.delete(`/integrations/disconnect/${type}`);
      fetchIntegrations();  // Refresh the list
    } catch (err) {
      alert('Failed to disconnect. Please try again.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'unknown';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  // Build a lookup for connected types
  const connectedTypes = new Set(integrations.map(i => i.type));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>🔗 Connected Integrations</h4>
        <button onClick={fetchIntegrations} style={styles.refreshButton} disabled={loading}>
          {loading ? '...' : '🔄'}
        </button>
      </div>

      {integrations.length === 0 && !loading && (
        <p style={styles.empty}>
          No integrations connected yet. Use the buttons below to connect Google Drive, Notion, Slack, or Jira.
        </p>
      )}

      <div style={styles.grid}>
        {Object.entries(INTEGRATION_INFO).map(([type, info]) => {
          const integration = integrations.find(i => i.type === type);
          const isConnected = connectedTypes.has(type);

          return (
            <div key={type} style={{
              ...styles.card,
              borderColor: isConnected ? info.color : '#e0e0e0',
              opacity: isConnected ? 1 : 0.65,
            }}>
              <div style={styles.cardHeader}>
                <span style={styles.cardIcon}>{info.icon}</span>
                <span style={styles.cardName}>{info.name}</span>
              </div>

              {isConnected ? (
                <>
                  <p style={styles.cardStatus}>
                    <span style={{ color: '#28a745' }}>● Connected</span>
                  </p>
                  <p style={styles.cardDate}>
                    Since {formatDate(integration.connected_at)}
                  </p>
                  <button
                    onClick={() => handleDisconnect(type)}
                    style={styles.disconnectButton}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <p style={styles.cardStatus}>
                  <span style={{ color: '#999' }}>○ Not connected</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: { marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '10px', border: '1px solid #e0e0e0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  title: { margin: 0 },
  refreshButton: { padding: '6px 12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px' },
  empty: { color: '#888', fontSize: '14px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' },
  card: { padding: '15px', backgroundColor: 'white', borderRadius: '8px', border: '2px solid', textAlign: 'center' },
  cardHeader: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '10px' },
  cardIcon: { fontSize: '22px' },
  cardName: { fontWeight: 'bold', fontSize: '14px' },
  cardStatus: { margin: '6px 0', fontSize: '13px', fontWeight: '600' },
  cardDate: { margin: '4px 0 10px 0', fontSize: '12px', color: '#888' },
  disconnectButton: { padding: '6px 14px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
};
import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function TeamPanel({ projectId }) {
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchMembers = async () => {
    try {
      const res = await api.get(`/projects/members/${projectId}`);
      setMembers(res.data);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await api.post('/projects/invite', null, {
        params: { project_id: projectId, email: email.trim() }
      });
      setMessage(`✅ ${res.data.message}`);
      setEmail('');
      fetchMembers();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.detail || 'Failed to invite.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from this project?`)) return;
    try {
      await api.delete(`/projects/remove-member/${projectId}/${userId}`);
      fetchMembers();
    } catch (err) {
      alert('Failed to remove member.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const currentUserEmail = localStorage.getItem('userEmail') || '';

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>👥 Team Members</h4>

      {/* Members list */}
      {members.length === 0 ? (
        <p style={styles.empty}>Loading members...</p>
      ) : (
        <ul style={styles.list}>
          {members.map((m) => (
            <li key={m.id} style={styles.memberItem}>
              <div style={styles.memberInfo}>
                <div style={styles.memberName}>
                  {m.name || m.email}
                  <span style={m.role === 'owner' ? styles.ownerBadge : styles.memberBadge}>
                    {m.role === 'owner' ? '👑 Owner' : '👤 Member'}
                  </span>
                </div>
                <div style={styles.memberEmail}>{m.email}</div>
              </div>
              {m.role !== 'owner' && (
                <button
                  onClick={() => handleRemove(m.id, m.name || m.email)}
                  style={styles.removeButton}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Invite form */}
      <form onSubmit={handleInvite} style={styles.form}>
        <input
          type="email"
          placeholder="Invite by email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !email.trim()} style={styles.inviteButton}>
          {loading ? '...' : 'Invite'}
        </button>
      </form>

      {message && <p style={styles.message}>{message}</p>}

      <p style={styles.hint}>
        The invited user must already have an account. They'll see this project on their dashboard after logging in.
      </p>
    </div>
  );
}

const styles = {
  container: { marginTop: '20px', padding: '20px', backgroundColor: '#f3e5f5', borderRadius: '10px', border: '1px solid #ce93d8' },
  title: { marginTop: 0, marginBottom: '15px' },
  empty: { color: '#888', fontSize: '14px' },
  list: { listStyle: 'none', padding: 0, marginBottom: '15px' },
  memberItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'white', borderRadius: '6px', marginBottom: '8px', border: '1px solid #e0e0e0' },
  memberInfo: { flex: 1 },
  memberName: { fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' },
  memberEmail: { fontSize: '12px', color: '#888', marginTop: '2px' },
  ownerBadge: { fontSize: '11px', padding: '2px 8px', backgroundColor: '#fff3e0', color: '#e65100', borderRadius: '10px', fontWeight: 'normal' },
  memberBadge: { fontSize: '11px', padding: '2px 8px', backgroundColor: '#e3f2fd', color: '#1565c0', borderRadius: '10px', fontWeight: 'normal' },
  removeButton: { padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },
  form: { display: 'flex', gap: '10px', marginTop: '10px' },
  input: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' },
  inviteButton: { padding: '10px 20px', backgroundColor: '#9c27b0', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
  message: { marginTop: '10px', color: '#333', fontSize: '13px' },
  hint: { marginTop: '15px', fontSize: '12px', color: '#888', fontStyle: 'italic' }
};
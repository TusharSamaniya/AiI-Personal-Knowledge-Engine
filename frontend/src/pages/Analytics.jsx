import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../api/axios';

const COLORS = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#17a2b8'];

export default function Analytics() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/analytics/overview')
      .then(res => setData(res.data))
      .catch(err => setError('Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.center}>Loading analytics...</div>;
  if (error) return <div style={styles.center}>{error}</div>;
  if (!data) return null;

  const { overview, per_project, queries_per_day, top_sources } = data;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>📊 Analytics</h1>
        <button onClick={() => navigate('/dashboard')} style={styles.backButton}>
          ← Back to Dashboard
        </button>
      </div>

      {/* Stat Cards */}
      <div style={styles.statsGrid}>
        <StatCard icon="📁" label="Projects" value={overview.total_projects} color="#007bff" />
        <StatCard icon="📄" label="Files" value={overview.total_files} color="#28a745" />
        <StatCard icon="💬" label="Questions Asked" value={overview.total_queries} color="#ffc107" />
        <StatCard icon="📝" label="Quiz Attempts" value={overview.total_quiz_attempts} color="#dc3545" />
      </div>

      {/* Queries Per Day Chart */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Questions Over the Last 7 Days</h3>
        {queries_per_day.length === 0 ? (
          <p style={styles.empty}>No queries yet. Ask some questions first!</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={queries_per_day}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#007bff"
                strokeWidth={3}
                dot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Two-column: Per-Project Table + Sources Pie */}
      <div style={styles.twoCol}>
        {/* Per-Project Breakdown */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Per-Project Activity</h3>
          {per_project.length === 0 ? (
            <p style={styles.empty}>No projects yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={per_project}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="project_name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="files" fill="#28a745" name="Files" />
                <Bar dataKey="queries" fill="#007bff" name="Questions" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Sources Pie */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Content Sources</h3>
          {top_sources.length === 0 ? (
            <p style={styles.empty}>No content uploaded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={top_sources}
                  dataKey="count"
                  nameKey="source_type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.source_type}: ${entry.count}`}
                >
                  {top_sources.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quiz Scores Table */}
      {per_project.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Quiz Performance</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Project</th>
                <th style={styles.th}>Attempts</th>
                <th style={styles.th}>Average Score</th>
              </tr>
            </thead>
            <tbody>
              {per_project.map((p) => (
                <tr key={p.project_id}>
                  <td style={styles.td}>{p.project_name}</td>
                  <td style={styles.td}>{p.quiz_attempts}</td>
                  <td style={styles.td}>
                    {p.quiz_attempts > 0
                      ? `${Math.round(p.avg_quiz_score * 100)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ ...styles.statCard, borderTopColor: color }}>
      <div style={styles.statIcon}>{icon}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles = {
  container: { padding: '30px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
  title: { margin: 0, fontSize: '28px' },
  backButton: { padding: '8px 18px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px' },
  center: { padding: '50px', textAlign: 'center', fontSize: '16px', color: '#666' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' },
  statCard: { padding: '20px', backgroundColor: 'white', borderRadius: '8px', borderTop: '4px solid', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  statIcon: { fontSize: '28px', marginBottom: '8px' },
  statValue: { fontSize: '32px', fontWeight: 'bold', color: '#222' },
  statLabel: { fontSize: '13px', color: '#888', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  card: { padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' },
  cardTitle: { marginTop: 0, marginBottom: '15px', fontSize: '16px', color: '#333' },
  empty: { color: '#888', fontSize: '14px', textAlign: 'center', padding: '30px' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px', borderBottom: '2px solid #eee', fontSize: '13px', color: '#666', textTransform: 'uppercase' },
  td: { padding: '12px 10px', borderBottom: '1px solid #f0f0f0', fontSize: '14px' }
};
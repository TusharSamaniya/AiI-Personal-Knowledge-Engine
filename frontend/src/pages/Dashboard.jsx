import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    // Fetch current user info
    api.get('/user/me')
      .then(res => setUser(res.data))
      .catch(() => {
        logout();
        navigate('/login');
      });

    // Fetch user projects
    fetchProjects();
  }, []);

  const fetchProjects = () => {
    api.get('/projects/list')
      .then(res => setProjects(res.data))
      .catch(err => console.log(err));
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName) return;
    try {
      await api.post('/projects/create', null, {
        params: { name: newProjectName }
      });
      setNewProjectName('');
      fetchProjects(); // Refresh the list
    } catch (err) {
      alert("Failed to create project. Make sure your role is 'teacher' or 'admin'.");
    }
  };

  const handleSwitchProject = async (projectId) => {
    try {
      await api.post(`/projects/switch/${projectId}`);
      fetchProjects(); // Refresh the list to show the new active project
    } catch (err) {
      alert("Failed to switch project.");
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Dashboard</h2>
        {user && <p>Welcome, <strong>{user.name}</strong>!</p>}
        <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
      </div>

      <div style={styles.content}>
        <h3>Your Projects</h3>
        
        {/* Create Project Form */}
        <form onSubmit={handleCreateProject} style={styles.form}>
          <input
            style={styles.input}
            type="text"
            placeholder="New project name..."
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <button style={styles.button} type="submit">Create</button>
        </form>

        {/* Project List */}
        <ul style={styles.list}>
          {projects.map((p) => (
            <li key={p.id} style={p.is_active ? styles.activeItem : styles.item}>
              <span>{p.name} {p.is_active && "✅ (Active)"}</span>
              {!p.is_active && (
                <button 
                  onClick={() => handleSwitchProject(p.id)} 
                  style={styles.switchButton}
                >
                  Switch
                </button>
              )}
            </li>
          ))}
          {projects.length === 0 && <p>No projects yet. Create one above!</p>}
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '40px', fontFamily: 'Arial, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px' },
  logoutButton: { padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' },
  content: { marginTop: '20px', maxWidth: '600px' },
  form: { display: 'flex', gap: '10px', marginBottom: '20px' },
  input: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' },
  button: { padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' },
  list: { listStyle: 'none', padding: 0 },
  item: { display: 'flex', justifyContent: 'space-between', padding: '15px', backgroundColor: '#f9f9f9', marginBottom: '10px', borderRadius: '5px', border: '1px solid #eee' },
  activeItem: { display: 'flex', justifyContent: 'space-between', padding: '15px', backgroundColor: '#e6f4ea', marginBottom: '10px', borderRadius: '5px', border: '1px solid #b7e1cd' },
  switchButton: { padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }
};
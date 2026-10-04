import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import ChatPanel from '../components/ChatPanel';
import DriveIntegration from '../components/DriveIntegration';
import NotionIntegration from '../components/NotionIntegration';

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');

  // Upload states
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);

  // 1. Derived value FIRST
  const activeProject = projects.find(p => p.is_active);

  // 2. Define fetchProjects
  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects/list');
      setProjects(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  // 3. Define fetchFiles wrapped in useCallback so it's stable
  const fetchFiles = useCallback(async () => {
    if (!activeProject) return;
    try {
      const res = await api.get(`/files/list/${activeProject.id}`);
      setFiles(res.data);
    } catch (err) {
      console.log(err);
    }
  }, [activeProject?.id]);

  // 4. useEffect #1: Load user + projects once on mount
  useEffect(() => {
    api.get('/user/me')
      .then(res => setUser(res.data))
      .catch(() => {
        logout();
        navigate('/login');
      });
    fetchProjects();
  }, []);

  // 5. useEffect #2: Poll files every 5 seconds when active project changes
  useEffect(() => {
    if (!activeProject) {
      setFiles([]);
      return;
    }
    fetchFiles();
    const interval = setInterval(fetchFiles, 5000);
    return () => clearInterval(interval);
  }, [activeProject?.id, fetchFiles]);

  // ============ Handlers ============

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName) return;
    try {
      await api.post('/projects/create', null, {
        params: { name: newProjectName }
      });
      setNewProjectName('');
      fetchProjects();
    } catch (err) {
      alert("Failed to create project. Make sure your role is 'teacher' or 'admin'.");
    }
  };

  const handleSwitchProject = async (projectId) => {
    try {
      await api.post(`/projects/switch/${projectId}`);
      fetchProjects();
    } catch (err) {
      alert("Failed to switch project.");
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percent);
        }
      });
      setMessage('✅ File uploaded! Processing in background...');
      setFile(null);
      setProgress(0);
      fetchFiles();  // Refresh file list immediately
    } catch (err) {
      setMessage('❌ Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlUpload = async (e) => {
    e.preventDefault();
    if (!url) return;
    setUploading(true);
    setMessage('');
    try {
      await api.post('/ingest/url', null, { params: { url } });
      setMessage('✅ URL received! Processing in background...');
      setUrl('');
      fetchFiles();  // Refresh file list immediately
    } catch (err) {
      setMessage('❌ Invalid URL or processing failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ============ Render ============

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Dashboard</h2>
        {user && <p>Welcome, <strong>{user.name}</strong>!</p>}
        <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
      </div>

      <div style={styles.content}>
        <h3>Your Projects</h3>

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

        {activeProject ? (
          <div style={styles.uploadSection}>
            <h4>Add Content to "{activeProject.name}"</h4>

            {/* File Upload Box */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setFile(e.dataTransfer.files[0]);
              }}
              style={styles.dropZone}
            >
              <p>📄 Drag & drop a file here, or click to browse</p>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.csv"
                onChange={(e) => setFile(e.target.files[0])}
              />
              {file && <p><strong>Selected:</strong> {file.name}</p>}
              {uploading && <progress value={progress} max="100" style={{ width: '100%' }} />}
              <button
                onClick={handleFileUpload}
                disabled={uploading || !file}
                style={styles.button}
              >
                {uploading ? `Uploading... ${progress}%` : 'Upload File'}
              </button>
            </div>

            {/* URL Upload Box */}
            <form onSubmit={handleUrlUpload} style={styles.urlForm}>
              <input
                type="url"
                placeholder="Paste YouTube or website URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={styles.input}
              />
              <button type="submit" disabled={uploading || !url} style={styles.button}>
                Add URL
              </button>
            </form>

            {/* Google Drive Integration */}
            <DriveIntegration />

            {/* Notion Integration */}
            <NotionIntegration />

            {message && <p style={styles.message}>{message}</p>}

                        {/* Files List */}
            <div style={styles.filesSection}>
              <h4>Files in "{activeProject.name}"</h4>
              {files.length === 0 && <p>No files yet. Upload one above!</p>}
              <ul style={styles.list}>
                {files.map((f) => (
                  <li key={f.id} style={styles.fileItem}>
                    <div>
                      <strong>{f.name}</strong>
                      <span style={styles.badge}>{f.source_type}</span>
                    </div>
                    <div style={styles.fileStatus}>
                      {f.status === 'processed' && <span style={{ color: '#28a745' }}>✅ Processed</span>}
                      {f.status === 'processing' && <span style={{ color: '#ffc107' }}>⏳ Processing...</span>}
                      {f.status === 'failed' && (
                        <div>
                          <span style={{ color: '#dc3545' }}>❌ Failed</span>
                          {f.error_message && (
                            <p style={styles.errorText}>{f.error_message}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Chat Panel - NEW */}
            <ChatPanel projectId={activeProject.id} />
          </div>
        ) : (
          <p style={styles.warning}>⚠️ Please select or create a project first.</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '40px', fontFamily: 'Arial, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px' },
  logoutButton: { padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' },
  content: { marginTop: '20px', maxWidth: '700px' },
  form: { display: 'flex', gap: '10px', marginBottom: '20px' },
  input: { flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' },
  button: { padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' },
  list: { listStyle: 'none', padding: 0 },
  item: { display: 'flex', justifyContent: 'space-between', padding: '15px', backgroundColor: '#f9f9f9', marginBottom: '10px', borderRadius: '5px', border: '1px solid #eee' },
  activeItem: { display: 'flex', justifyContent: 'space-between', padding: '15px', backgroundColor: '#e6f4ea', marginBottom: '10px', borderRadius: '5px', border: '1px solid #b7e1cd' },
  switchButton: { padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' },
  uploadSection: { marginTop: '30px', padding: '20px', backgroundColor: '#f4f6f8', borderRadius: '10px' },
  dropZone: { border: '2px dashed #007bff', padding: '20px', borderRadius: '10px', textAlign: 'center', backgroundColor: 'white', marginBottom: '15px' },
  urlForm: { display: 'flex', gap: '10px' },
  message: { marginTop: '15px', color: '#333' },
  warning: { marginTop: '20px', color: '#dc3545' },
  filesSection: { marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '10px' },
  fileItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'white', marginBottom: '8px', borderRadius: '5px', border: '1px solid #eee' },
  fileStatus: { textAlign: 'right' },
  badge: { marginLeft: '10px', padding: '2px 8px', backgroundColor: '#e0e0e0', borderRadius: '3px', fontSize: '12px' },
  errorText: { margin: '5px 0 0 0', color: '#dc3545', fontSize: '12px', maxWidth: '400px' }
};
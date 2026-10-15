import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import WorkBox from './WorkBox';
import DriveIntegration from './DriveIntegration';
import NotionIntegration from './NotionIntegration';
import SlackIntegration from './SlackIntegration';
import JiraIntegration from './JiraIntegration';

const BG_IMAGE = 'https://images.pexels.com/photos/39307839/pexels-photo-39307839.jpeg?auto=compress&cs=tinysrgb&w=1600';

export default function MainArea({ activeProject, onRefresh }) {
  const [userName, setUserName] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState('');
  const [urlModal, setUrlModal] = useState(null);
  const [integrationModal, setIntegrationModal] = useState(null);
  const [url, setUrl] = useState('');
  const fileInputRef = useRef(null);

  // ===== Load user name =====
  useEffect(() => {
    api.get('/user/me')
      .then(res => setUserName(res.data.name?.split(' ')[0] || 'there'))
      .catch(() => setUserName('there'));
  }, []);

  // ===== Fetch files =====
  const fetchFiles = async () => {
    if (!activeProject) return;
    try {
      const res = await api.get(`/files/list/${activeProject.id}`);
      setFiles(res.data);
    } catch (err) {
      console.error('Failed to fetch files', err);
    }
  };

  useEffect(() => {
    setFiles([]);
    if (activeProject) {
      fetchFiles();
      const interval = setInterval(fetchFiles, 5000);
      return () => clearInterval(interval);
    }
  }, [activeProject?.id]);

  // ===== Upload =====
  const uploadFile = async (file) => {
    if (!activeProject) {
      setMessage('⚠️ Please create or select a project first.');
      return;
    }
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setMessage('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / e.total)),
      });
      setMessage(`✅ Uploaded "${file.name}" — processing in background`);
      fetchFiles();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.detail || 'Upload failed.'));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleFilePick = (e) => {
    if (e.target.files && e.target.files[0]) uploadFile(e.target.files[0]);
    e.target.value = null;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
  };

  // ===== URL ingestion =====
  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim() || !activeProject) return;
    setUploading(true);
    setMessage('');
    try {
      await api.post('/ingest/url', null, { params: { url: url.trim() } });
      setMessage(`✅ URL received — processing in background`);
      setUrl('');
      setUrlModal(null);
      fetchFiles();
    } catch (err) {
      setMessage('❌ ' + (err.response?.data?.detail || 'Failed to ingest URL.'));
    } finally {
      setUploading(false);
    }
  };

  // ===== Integration buttons =====
  const integrations = [
    { id: 'notion',  label: 'Notion',  icon: '📝', color: 'hover:bg-black hover:text-white' },
    { id: 'slack',   label: 'Slack',   icon: '💬', color: 'hover:bg-purple-700 hover:text-white' },
    { id: 'jira',    label: 'Jira',    icon: '🎫', color: 'hover:bg-blue-600 hover:text-white' },
    { id: 'drive',   label: 'Drive',   icon: '📁', color: 'hover:bg-green-600 hover:text-white' },
    { id: 'youtube', label: 'YouTube', icon: '▶️', color: 'hover:bg-red-600 hover:text-white' },
    { id: 'website', label: 'Website', icon: '🌐', color: 'hover:bg-cyan-600 hover:text-white' },
    { id: 'browse',  label: 'Browse',  icon: '📎', color: 'hover:bg-blue-600 hover:text-white' },
  ];

  const handleIntegrationClick = (id) => {
    if (id === 'browse') fileInputRef.current?.click();
    else if (id === 'youtube' || id === 'website') setUrlModal(id);
    else setIntegrationModal(id);
  };

  // ===== Quick actions for Copilot-style home =====
  const createChat = async (name) => {
    try {
      await api.post('/projects/create', null, { params: { name } });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Failed to create: ' + (err.response?.data?.detail || 'Unknown error'));
    }
  };

  const handleQuickChat = () => {
    const name = window.prompt('Name your chat:', 'My Notes');
    if (name && name.trim()) createChat(name.trim());
  };

  const handleQuickTeam = () => {
    const name = window.prompt('Name your team:', 'Study Group');
    if (name && name.trim()) createChat(name.trim());
  };

  // ============================================
  // VIEW 1: NO PROJECT SELECTED — Copilot Home
  // ============================================
  if (!activeProject) {
    return (
      <main
        className="flex-1 h-full overflow-y-auto relative"
        style={{
          backgroundImage: `url(${BG_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        {/* Dark tint — makes image rich, not washed out */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        <div className="relative min-h-full flex flex-col items-center justify-center px-6 py-16">
          {/* Greeting */}
          <h1 className="text-4xl md:text-5xl font-semibold text-white text-center drop-shadow-lg mb-10">
            Hey {userName}, what's on your mind today?
          </h1>

          {/* Big input box */}
          <div className="w-full max-w-2xl bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-3 mb-6">
            <div className="flex items-center gap-2">
              <button
                onClick={handleQuickChat}
                className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 text-xl shrink-0"
                title="New chat"
              >
                +
              </button>
              <input
                readOnly
                onClick={handleQuickChat}
                placeholder="Message Knowledge Engine..."
                className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400 px-2 cursor-pointer text-base"
              />
              <button
                onClick={handleQuickChat}
                className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white shrink-0"
                title="Start"
              >
                ➤
              </button>
            </div>
          </div>

          {/* Suggestion pills */}
          <div className="flex flex-wrap justify-center gap-3 max-w-3xl mb-12">
            <Pill icon="💬" label="New Personal Chat"  onClick={handleQuickChat} />
            <Pill icon="👥" label="Start a Team"       onClick={handleQuickTeam} />
            <Pill icon="📎" label="Upload a File"      onClick={() => {
              const name = window.prompt('Create a chat to upload into:', 'My Files');
              if (name && name.trim()) createChat(name.trim());
            }} />
            <Pill icon="🧠" label="Take a Quiz"        onClick={handleQuickChat} />
            <Pill icon="📇" label="Flashcards"          onClick={handleQuickChat} />
          </div>

          {/* Two big cards */}
          <div className="grid md:grid-cols-2 gap-5 w-full max-w-4xl">
            <ActionCard
              icon="📎"
              title="Work smarter with your files"
              description="I can search, summarize, and analyze your files. Attach a file to build your knowledge base."
              cta="Upload a file"
              onClick={() => {
                const name = window.prompt('Create a chat to upload into:', 'My Files');
                if (name && name.trim()) createChat(name.trim());
              }}
            />
            <ActionCard
              icon="💬"
              title="Keep talking with your data"
              description="Continue where you left off. Pick a conversation from the sidebar to keep asking questions."
              cta="Open a chat"
              onClick={handleQuickChat}
            />
          </div>

          <p className="text-white/70 text-xs mt-12 text-center max-w-md">
            Knowledge Engine is AI and may make mistakes. Answers are sourced from your uploaded content.
          </p>
        </div>
      </main>
    );
  }

  // ============================================
  // VIEW 2: ACTIVE PROJECT
  // ============================================
  return (
    <>
        <main className="flex-1 h-full overflow-y-auto relative bg-gray-50">
          
          <div className="p-8 max-w-5xl w-full mx-auto">

          {/* Heading */}
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Upload / Import / Drag-Drop Your File / Chat Here
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Importing to <span className="font-semibold text-gray-800">{activeProject.name}</span>
          </p>

          {/* Integration buttons */}
          <div className="flex flex-wrap gap-2 mb-5">
            {integrations.map((it) => (
              <button
                key={it.id}
                onClick={() => handleIntegrationClick(it.id)}
                className={`px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition shadow-sm ${it.color}`}
              >
                <span className="mr-1.5">{it.icon}</span>
                {it.label}
              </button>
            ))}
          </div>

          {/* File list + Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`bg-white/95 backdrop-blur rounded-2xl border-2 border-dashed transition shadow-sm ${
              dragOver ? 'border-blue-500 bg-blue-50/95' : 'border-gray-300'
            }`}
          >
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 text-center">
                Drag your files here, or use the buttons above
              </p>
              {uploading && (
                <div className="mt-3">
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-500 h-1.5 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {files.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">
                  No files yet. Upload your first file to get started.
                </p>
              ) : (
                files.map((f) => (
                  <div key={f.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-lg flex-shrink-0">{getFileIcon(f.source_type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                        <p className="text-xs text-gray-400">{f.source_type}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      {f.status === 'processed' && (
                        <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full font-medium">✅ Processed</span>
                      )}
                      {f.status === 'processing' && (
                        <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded-full font-medium">⏳ Processing...</span>
                      )}
                      {f.status === 'failed' && (
                        <span className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded-full font-medium cursor-help" title={f.error_message || 'Processing failed'}>
                          ❌ Failed
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {message && (
            <p className="mt-4 text-sm text-gray-700 bg-white/95 backdrop-blur border border-gray-200 px-4 py-2 rounded-lg shadow-sm">
              {message}
            </p>
          )}

          {/* Work Box */}
          <WorkBox projectId={activeProject.id} />

        </div>

        <input type="file" ref={fileInputRef} onChange={handleFilePick} className="hidden" accept=".pdf,.docx,.txt,.csv" />
      </main>

      {/* URL Modal */}
      {urlModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {urlModal === 'youtube' ? '🎥 Import YouTube Video' : '🌐 Import Website'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {urlModal === 'youtube'
                ? 'Paste a YouTube URL. We will extract the transcript.'
                : 'Paste a website URL. We will scrape the main content.'}
            </p>
            <form onSubmit={handleUrlSubmit}>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={urlModal === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://en.wikipedia.org/wiki/...'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setUrlModal(null); setUrl(''); }}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition">
                  Cancel
                </button>
                <button type="submit" disabled={!url.trim() || uploading}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition">
                  {uploading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Integration Modal */}
      {integrationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => setIntegrationModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              title="Close"
            >
              ×
            </button>
            <div className="mt-2">
              {integrationModal === 'drive' && <DriveIntegration />}
              {integrationModal === 'notion' && <NotionIntegration />}
              {integrationModal === 'slack' && <SlackIntegration />}
              {integrationModal === 'jira' && <JiraIntegration />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// Helper components
// ============================================
function Pill({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur text-white text-sm font-medium rounded-full border border-white/20 transition"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ActionCard({ icon, title, description, cta, onClick }) {
  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-6 flex flex-col">
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-gray-800 mb-1">{title}</h3>
      <p className="text-sm text-gray-600 mb-4 flex-1">{description}</p>
      <button
        onClick={onClick}
        className="self-start px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition"
      >
        {cta} →
      </button>
    </div>
  );
}

// ============================================
// File type icon
// ============================================
function getFileIcon(sourceType) {
  switch (sourceType) {
    case 'youtube': return '🎥';
    case 'web':     return '🌐';
    case 'notion':  return '📝';
    case 'slack':   return '💬';
    case 'jira':    return '🎫';
    default:        return '📄';
  }
}
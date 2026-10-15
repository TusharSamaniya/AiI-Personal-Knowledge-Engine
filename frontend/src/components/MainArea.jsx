import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import WorkBox from './WorkBox';
import DriveIntegration from './DriveIntegration';
import NotionIntegration from './NotionIntegration';
import SlackIntegration from './SlackIntegration';
import JiraIntegration from './JiraIntegration';

export default function MainArea({ activeProject }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState('');
  const [urlModal, setUrlModal] = useState(null);
  const [integrationModal, setIntegrationModal] = useState(null);
  const [url, setUrl] = useState('');
  const fileInputRef = useRef(null);

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
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded * 100) / e.total);
          setProgress(pct);
        },
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
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
    e.target.value = null;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    if (!activeProject) {
      setMessage('⚠️ Please create or select a project first.');
      return;
    }
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
    if (id === 'browse') {
      fileInputRef.current?.click();
    } else if (id === 'youtube' || id === 'website') {
      setUrlModal(id);
    } else {
      setIntegrationModal(id);
    }
  };

  if (!activeProject) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            No Project Selected
          </h2>
          <p className="text-gray-500 mb-6">
            Create a Personal Chat or Team from the left sidebar to get started.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-gray-50">
        <div className="p-8 max-w-5xl w-full mx-auto">

          {/* Heading */}
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Upload / Import / Drag-Drop Your File / Chat Here
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Importing to <span className="font-semibold text-gray-700">{activeProject.name}</span>
          </p>

          {/* Integration buttons */}
          <div className="flex flex-wrap gap-2 mb-5">
            {integrations.map((it) => (
              <button
                key={it.id}
                onClick={() => handleIntegrationClick(it.id)}
                className={`px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition ${it.color}`}
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
            className={`bg-white rounded-2xl border-2 border-dashed transition ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 text-center">
                Drag your files here, or use the buttons above
              </p>
              {uploading && (
                <div className="mt-3">
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-1.5 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {files.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">
                  No files yet. Upload your first file to get started.
                </p>
              ) : (
                files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between px-6 py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-lg flex-shrink-0">
                        {getFileIcon(f.source_type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {f.name}
                        </p>
                        <p className="text-xs text-gray-400">{f.source_type}</p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      {f.status === 'processed' && (
                        <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full font-medium">
                          ✅ Processed
                        </span>
                      )}
                      {f.status === 'processing' && (
                        <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded-full font-medium">
                          ⏳ Processing...
                        </span>
                      )}
                      {f.status === 'failed' && (
                        <span
                          className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded-full font-medium cursor-help"
                          title={f.error_message || 'Processing failed'}
                        >
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
            <p className="mt-4 text-sm text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-lg">
              {message}
            </p>
          )}

          {/* Tabbed Work Box */}
          <WorkBox projectId={activeProject.id} />

        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFilePick}
          className="hidden"
          accept=".pdf,.docx,.txt,.csv"
        />
      </main>

      {/* URL Modal */}
      {urlModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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
                placeholder={
                  urlModal === 'youtube'
                    ? 'https://www.youtube.com/watch?v=...'
                    : 'https://en.wikipedia.org/wiki/...'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-4"
                autoFocus
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setUrlModal(null); setUrl(''); }}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!url.trim() || uploading}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition"
                >
                  {uploading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Integration Modal */}
      {integrationModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
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

// ===== File type icon =====
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
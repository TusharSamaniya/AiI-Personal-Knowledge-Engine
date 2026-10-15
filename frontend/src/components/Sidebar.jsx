import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function Sidebar({ projects, onRefresh }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState(null);

  // Split projects: team = has members OR you're not the owner
  const teamProjects = projects.filter(p => p.member_count > 0 || !p.is_owner);
  const personalProjects = projects.filter(p => p.member_count === 0 && p.is_owner);

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* TEAM section */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Team
          </h3>
          <button
            onClick={() => { setCreateMode('team'); setShowCreateModal(true); }}
            className="text-gray-400 hover:text-blue-600 text-xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-blue-50 transition"
            title="Create new team"
          >
            +
          </button>
        </div>
        {teamProjects.length === 0 ? (
          <p className="text-xs text-gray-400 px-1">No teams yet — click + to create one</p>
        ) : (
          <ul className="space-y-0.5">
            {teamProjects.map(p => (
              <ProjectItem key={p.id} project={p} onRefresh={onRefresh} />
            ))}
          </ul>
        )}
      </div>

      {/* PERSONAL CHAT section */}
      <div className="flex-1 p-4 border-b border-gray-100 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Personal Chat
          </h3>
          <button
            onClick={() => { setCreateMode('personal'); setShowCreateModal(true); }}
            className="text-gray-400 hover:text-blue-600 text-xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-blue-50 transition"
            title="Create new personal chat"
          >
            +
          </button>
        </div>
        {personalProjects.length === 0 ? (
          <p className="text-xs text-gray-400 px-1">No personal chats yet</p>
        ) : (
          <ul className="space-y-0.5">
            {personalProjects.map(p => (
              <ProjectItem key={p.id} project={p} onRefresh={onRefresh} />
            ))}
          </ul>
        )}
      </div>

      {/* Performance button */}
      <div className="p-4">
        <button
          onClick={() => (window.location.href = '/analytics')}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
        >
          📊 Performance
        </button>
      </div>

      {showCreateModal && (
        <CreateTeamModal
          mode={createMode}
          onClose={() => { setShowCreateModal(false); setCreateMode(null); }}
          onCreated={fetchProjects}
        />
      )}
    </aside>
  );
}

// ============================================
// Project Item (with hover 3-dot menu)
// ============================================
function ProjectItem({ project, onRefresh }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSwitch = async () => {
    if (project.is_active) { setMenuOpen(false); return; }
    try {
      await api.post(`/projects/switch/${project.id}`);
      onRefresh();
    } catch (err) {
      alert('Failed to switch project.');
    }
    setMenuOpen(false);
  };

  const handleRemove = async () => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/delete/${project.id}`);
      onRefresh();
    } catch (err) {
      alert('Failed to delete project.');
    }
    setMenuOpen(false);
  };

  return (
    <li className="relative group">
      <div
        onClick={handleSwitch}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition ${
          project.is_active
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span className="flex-1 truncate" title={project.name}>
          {project.is_active && '● '}
          {project.name}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 px-1 transition-opacity"
        >
          ⋯
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-2 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 w-52">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-800 truncate">{project.name}</p>
              <p className="text-xs text-gray-400 truncate">
                {project.is_owner ? 'You own this' : `Owner: ${project.owner_name || 'Unknown'}`}
              </p>
            </div>
            {!project.is_active && (
              <button
                onClick={handleSwitch}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                🔄 Switch
              </button>
            )}
            {project.is_owner && (
              <button
                onClick={handleRemove}
                className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                🗑️ Remove
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}

// ============================================
// Create Team Modal
// ============================================
function CreateTeamModal({ mode, onClose, onCreated }) {
  const isPersonal = mode === 'personal';
  const [name, setName] = useState('');
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      // 1. Create the project
      const createRes = await api.post('/projects/create', null, {
        params: { name: name.trim() }
      });
      const projectId = createRes.data.project_id;

      // 2. If it's a team, invite each email
      if (!isPersonal) {
        const emailList = emails.split(',').map(e => e.trim()).filter(e => e);
        for (const email of emailList) {
          try {
            await api.post('/projects/invite', null, {
              params: { project_id: projectId, email }
            });
          } catch (inviteErr) {
            console.warn(`Invite failed for ${email}:`, inviteErr.response?.data?.detail);
          }
        }
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold text-gray-800 mb-1">
          {isPersonal ? 'New Personal Chat' : 'Create New Team'}
        </h2>
        <p className="text-xs text-gray-500 mb-5">
          {isPersonal
            ? 'Start a private workspace just for yourself.'
            : 'Start a shared project and invite others by email.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isPersonal ? 'Chat Name' : 'Team Name'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isPersonal ? 'e.g., My Notes' : 'e.g., Physics Study Group'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoFocus
            />
          </div>

          {!isPersonal && (
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invite Members <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="friend1@example.com, friend2@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                rows={2}
              />
              <p className="text-xs text-gray-500 mt-1">
                Separate multiple emails with commas. Members must already have accounts.
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition"
            >
              {loading ? 'Creating...' : (isPersonal ? 'Create Chat' : 'Create Team')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
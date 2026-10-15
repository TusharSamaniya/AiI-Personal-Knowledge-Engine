import { useState } from 'react';
import ChatPanel from './ChatPanel';
import QuizPanel from './QuizPanel';
import StudyTools from './StudyTools';

export default function WorkBox({ projectId }) {
  const [tab, setTab] = useState('chat');
  const [expanded, setExpanded] = useState(false);

  const tabs = [
    { id: 'chat',       label: 'Chat',       icon: '💬' },
    { id: 'quiz',       label: 'Quiz',       icon: '📝' },
    { id: 'flashcards', label: 'Flashcard',  icon: '📇' },
    { id: 'summary',    label: 'Summary',    icon: '📄' },
    { id: 'eli5',       label: 'ELI5',       icon: '👶' },
  ];

  return (
    <div
      className={
        expanded
          ? 'fixed inset-0 z-40 bg-white flex flex-col'
          : 'mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[600px]'
      }
    >
      {/* Tab Bar */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 shrink-0">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 transition shrink-0"
          title={expanded ? 'Close fullscreen' : 'Expand'}
        >
          {expanded ? '✕ Close' : '⛶ Expand'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'chat' && <ChatPanel projectId={projectId} bare />}
        {tab === 'quiz' && <QuizPanel projectId={projectId} bare />}
        {tab === 'flashcards' && (
          <StudyTools projectId={projectId} initialTab="flashcards" hideTabs />
        )}
        {tab === 'summary' && (
          <StudyTools projectId={projectId} initialTab="summary" hideTabs />
        )}
        {tab === 'eli5' && (
          <StudyTools projectId={projectId} initialTab="eli5" hideTabs />
        )}
      </div>
    </div>
  );
}
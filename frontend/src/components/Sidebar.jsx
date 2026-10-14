export default function Sidebar() {
  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Placeholder for Team section */}
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Team
        </h3>
        <p className="text-xs text-gray-400 mt-2">Coming soon...</p>
      </div>

      {/* Placeholder for Personal Chat */}
      <div className="flex-1 p-4 border-b border-gray-100 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Personal Chat
        </h3>
        <p className="text-xs text-gray-400 mt-2">Coming soon...</p>
      </div>

      {/* Placeholder for Performance Button */}
      <div className="p-4">
        <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium transition">
          📊 Performance
        </button>
      </div>
    </aside>
  );
}
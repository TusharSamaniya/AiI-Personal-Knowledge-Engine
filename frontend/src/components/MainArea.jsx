export default function MainArea() {
  return (
    <main className="flex-1 flex flex-col h-full overflow-y-auto bg-gray-50">
      {/* Placeholder for Upload Section */}
      <div className="p-8 border-b border-gray-200 bg-white">
        <h2 className="text-2xl font-bold text-gray-800">
          Upload / Import / Drag-Drop Your File / Chat Here
        </h2>
        <p className="text-sm text-gray-500 mt-2">Upload area coming soon...</p>
      </div>

      {/* Placeholder for Work Box */}
      <div className="flex-1 p-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 h-full flex items-center justify-center">
          <p className="text-gray-400">Chat / Quiz / Flashcards / Summary / ELI5 coming soon...</p>
        </div>
      </div>
    </main>
  );
}
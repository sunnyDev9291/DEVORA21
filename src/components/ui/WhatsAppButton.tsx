export default function LiveChatButton() {
  return (
    <button
      aria-label="Live Chat"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold pl-4 pr-5 h-12 rounded-full shadow-xl shadow-blue-600/30 hover:shadow-blue-500/40 transition-all duration-200 hover:-translate-y-1 hover:scale-105"
    >
      {/* Chat bubble icon */}
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      Live Chat
    </button>
  );
}

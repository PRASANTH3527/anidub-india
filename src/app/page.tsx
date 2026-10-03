'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('../App'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-700 via-purple-600 to-indigo-500 flex items-center justify-center animate-pulse shadow-lg shadow-purple-600/30">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-neutral-400 text-sm font-medium tracking-wide">Loading AniDub India...</p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <App />;
}

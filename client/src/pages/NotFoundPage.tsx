import { Link } from 'react-router-dom';
import { Home, Compass } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center p-8 text-center">
      {/* Decorative glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand-500/8 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md">
        {/* 404 number */}
        <p className="text-[120px] font-black text-white/5 leading-none select-none mb-2">404</p>

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl gradient-brand shadow-glow-brand flex items-center justify-center mx-auto -mt-8 mb-6">
          <Compass size={28} className="text-white" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
          Head back to the pipeline to get back on track.
        </p>

        <Link
          to="/pipeline"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all shadow-glow-brand/50 hover:shadow-glow-brand"
        >
          <Home size={16} />
          Back to Pipeline
        </Link>
      </div>
    </div>
  );
}

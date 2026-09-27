export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="w-16 h-16 rounded-2xl bg-surface-700 flex items-center justify-center">
        <span className="text-2xl">🚧</span>
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">Coming in a future phase</p>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-slate-300 font-mono gap-4">
      <div className="w-12 h-12 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
      <div className="text-sm tracking-wider uppercase">
        Initializing High-Performance Streaming Engine...
      </div>
      <div className="text-xs text-slate-500">
        Generating baseline 10,000 telemetry data points
      </div>
    </div>
  );
}

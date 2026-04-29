export default function AnalysisLoading() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="skeleton h-4 w-28 mb-2 rounded-md" />
          <div className="skeleton h-7 w-44 mb-1 rounded-md" />
          <div className="skeleton h-4 w-56 rounded-md" />
        </div>
        <div className="flex gap-3">
          <div className="skeleton h-9 w-28 rounded-xl" />
          <div className="skeleton h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl p-5"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="skeleton h-5 w-16 mb-3 rounded-md" />
                <div className="skeleton h-4 w-full mb-1.5 rounded-md" />
                <div className="skeleton h-4 w-3/4 rounded-md" />
              </div>
              <div className="skeleton h-8 w-16 rounded-lg flex-shrink-0" />
            </div>
            <div className="flex gap-3 mb-4">
              <div className="skeleton h-3.5 w-24 rounded-md" />
              <div className="skeleton h-3.5 w-20 rounded-md" />
            </div>
            <div className="skeleton h-1.5 w-full rounded-full mb-4" />
            <div className="flex gap-2">
              <div className="skeleton h-8 flex-1 rounded-lg" />
              <div className="skeleton h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalysisDetailLoading() {
  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="skeleton h-8 w-8 rounded-lg" />
        <div>
          <div className="skeleton h-6 w-64 mb-1.5 rounded-md" />
          <div className="skeleton h-4 w-40 rounded-md" />
        </div>
      </div>

      {/* Top meta bar */}
      <div
        className="rounded-2xl p-5 mb-5 flex items-center gap-6 flex-wrap"
        style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 min-w-[120px]">
            <div className="skeleton h-3.5 w-20 mb-2 rounded-md" />
            <div className="skeleton h-5 w-32 rounded-md" />
          </div>
        ))}
      </div>

      {/* Score rings */}
      <div
        className="rounded-2xl p-6 mb-5"
        style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
      >
        <div className="skeleton h-5 w-32 mb-5 rounded-md" />
        <div className="flex gap-8 flex-wrap">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="skeleton w-20 h-20 rounded-full" />
              <div className="skeleton h-3.5 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Content sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl p-5"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
          >
            <div className="skeleton h-5 w-32 mb-4 rounded-md" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-start gap-3 mb-3">
                <div className="skeleton h-4 w-28 rounded-md flex-shrink-0" />
                <div className="skeleton h-4 flex-1 rounded-md" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

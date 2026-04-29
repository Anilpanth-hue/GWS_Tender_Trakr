export default function TendersLoading() {
  return (
    <div className="flex h-full">
      {/* Main list area */}
      <div className="flex-1 p-6 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="skeleton h-7 w-40 mb-2 rounded-md" />
            <div className="skeleton h-4 w-56 rounded-md" />
          </div>
          <div className="skeleton h-9 w-36 rounded-xl" />
        </div>

        {/* Filter bar */}
        <div
          className="rounded-xl p-4 mb-4 flex items-center gap-3"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          <div className="skeleton h-9 flex-1 rounded-lg" />
          <div className="skeleton h-9 w-36 rounded-lg" />
          <div className="skeleton h-9 w-36 rounded-lg" />
          <div className="skeleton h-9 w-28 rounded-lg" />
        </div>

        {/* Table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          {/* Table header */}
          <div className="px-4 py-3 flex items-center gap-4" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {[120, 80, 80, 70, 70, 100].map((w, i) => (
              <div key={i} className={`skeleton h-3.5 rounded-md flex-shrink-0`} style={{ width: w }} />
            ))}
          </div>

          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="px-4 py-4 flex items-center gap-4"
              style={{ borderBottom: '1px solid #f1f5f9' }}
            >
              <div className="skeleton h-4 w-[120px] rounded-md" />
              <div className="flex-1">
                <div className="skeleton h-4 w-full max-w-[280px] mb-1.5 rounded-md" />
                <div className="skeleton h-3 w-40 rounded-md" />
              </div>
              <div className="skeleton h-4 w-[80px] rounded-md" />
              <div className="skeleton h-4 w-[80px] rounded-md" />
              <div className="skeleton h-6 w-[70px] rounded-md" />
              <div className="skeleton h-6 w-[100px] rounded-md" />
            </div>
          ))}

          {/* Footer */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <div className="skeleton h-4 w-40 rounded-md" />
            <div className="flex items-center gap-2">
              <div className="skeleton h-8 w-8 rounded-lg" />
              <div className="skeleton h-8 w-8 rounded-lg" />
              <div className="skeleton h-8 w-8 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

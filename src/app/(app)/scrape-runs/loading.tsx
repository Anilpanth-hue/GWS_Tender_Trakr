export default function ScrapeRunsLoading() {
  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="skeleton h-7 w-36 mb-2 rounded-md" />
          <div className="skeleton h-4 w-52 rounded-md" />
        </div>
        <div className="skeleton h-9 w-32 rounded-xl" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
          >
            <div className="skeleton h-7 w-12 mb-1 rounded-md" />
            <div className="skeleton h-4 w-20 rounded-md" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
      >
        <div className="px-5 py-3 flex items-center gap-4" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          {[80, 90, 70, 70, 70, 80, 100].map((w, i) => (
            <div key={i} className="skeleton h-3.5 rounded-md flex-shrink-0" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="px-5 py-4 flex items-center gap-4"
            style={{ borderBottom: '1px solid #f1f5f9' }}
          >
            <div className="skeleton h-4 w-[80px] rounded-md" />
            <div className="skeleton h-6 w-[90px] rounded-md" />
            <div className="skeleton h-6 w-[70px] rounded-md" />
            <div className="skeleton h-4 w-[70px] rounded-md" />
            <div className="skeleton h-4 w-[70px] rounded-md" />
            <div className="skeleton h-4 w-[70px] rounded-md" />
            <div className="skeleton h-4 w-[100px] rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
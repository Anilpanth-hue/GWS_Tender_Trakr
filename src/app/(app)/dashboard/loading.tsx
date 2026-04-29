export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-[1380px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="skeleton h-4 w-36 mb-3 rounded-md" />
          <div className="skeleton h-8 w-52 mb-2 rounded-md" />
          <div className="skeleton h-4 w-72 rounded-md" />
        </div>
        <div className="skeleton h-10 w-36 rounded-xl" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl p-5"
            style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
          >
            <div className="skeleton h-9 w-9 rounded-xl mb-5" />
            <div className="skeleton h-8 w-14 mb-2 rounded-md" />
            <div className="skeleton h-4 w-24 rounded-md" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-12 gap-4">
        <div
          className="col-span-12 lg:col-span-7 rounded-2xl p-6"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          <div className="skeleton h-5 w-36 mb-1 rounded-md" />
          <div className="skeleton h-4 w-52 mb-6 rounded-md" />
          <div className="skeleton h-[196px] rounded-xl" />
        </div>
        <div
          className="col-span-12 lg:col-span-2 rounded-2xl p-5"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          <div className="skeleton h-5 w-20 mb-4 rounded-md" />
          <div className="skeleton h-[156px] w-[156px] rounded-full mx-auto mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between mb-2">
              <div className="skeleton h-3 w-20 rounded-md" />
              <div className="skeleton h-3 w-6 rounded-md" />
            </div>
          ))}
        </div>
        <div
          className="col-span-12 lg:col-span-3 rounded-2xl overflow-hidden"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
            <div className="skeleton h-5 w-28 rounded-md" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div className="skeleton w-2 h-2 rounded-full flex-shrink-0" />
              <div className="flex-1">
                <div className="skeleton h-3.5 w-16 mb-1.5 rounded-md" />
                <div className="skeleton h-3 w-24 rounded-md" />
              </div>
              <div className="text-right">
                <div className="skeleton h-4 w-8 mb-1 rounded-md" />
                <div className="skeleton h-3 w-12 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <div className="p-6 max-w-[820px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="skeleton h-7 w-24 mb-2 rounded-md" />
        <div className="skeleton h-4 w-60 rounded-md" />
      </div>

      {/* Sections */}
      {Array.from({ length: 3 }).map((_, s) => (
        <div
          key={s}
          className="rounded-2xl overflow-hidden mb-5"
          style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          {/* Section header */}
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #f1f5f9' }}>
            <div className="skeleton h-5 w-36 mb-1 rounded-md" />
            <div className="skeleton h-3.5 w-52 rounded-md" />
          </div>

          {/* Fields */}
          <div className="p-6 space-y-5">
            {Array.from({ length: s === 1 ? 2 : 3 }).map((_, f) => (
              <div key={f}>
                <div className="skeleton h-4 w-32 mb-2 rounded-md" />
                <div className="skeleton h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 flex justify-end" style={{ borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <div className="skeleton h-9 w-28 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full" style={{ background: '#f8fafc' }}>
      {children}
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5EFE8] flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}

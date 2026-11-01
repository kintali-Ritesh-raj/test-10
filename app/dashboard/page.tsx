import Dashboard from "@/components/Dashboard";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-dark">
            ESA Hospital Deep Cleaning
          </p>
          <h1 className="text-2xl font-bold text-navy">
            SLG Housekeeping &amp; Facility Services
          </h1>
          <p className="text-slate-600">Attendance dashboard</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Dashboard />
      </main>
    </div>
  );
}

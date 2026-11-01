import Dashboard from "@/components/Dashboard";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold text-navy">
        SLG Housekeeping &amp; Facility Services
      </h1>
      <p className="mb-6 mt-1 text-slate-600">Attendance dashboard</p>
      <Dashboard />
    </main>
  );
}

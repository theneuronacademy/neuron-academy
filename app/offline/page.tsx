import Link from "next/link";

export const metadata = { title: "Offline | Neuron Academy" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-card border border-silver-200 bg-white p-8 text-center shadow-card">
        <p className="text-3xl">📡</p>
        <h1 className="mt-3 text-xl font-extrabold text-navy-700">You are offline</h1>
        <p className="mt-2 text-sm text-muted">
          Connect to the internet to see live tests, results and attendance. Saved pages never show stale marks.
        </p>
        <Link
          href="/student/dashboard"
          className="mt-5 inline-block rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-800"
        >
          Retry Dashboard
        </Link>
      </div>
    </div>
  );
}

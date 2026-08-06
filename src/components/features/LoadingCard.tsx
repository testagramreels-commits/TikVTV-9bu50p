export default function LoadingCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-700 bg-gray-900 p-4">
      <div className="h-48 w-full rounded-lg bg-gray-800" />
      <div className="mt-4 h-5 w-3/4 rounded bg-gray-800" />
      <div className="mt-2 h-4 w-1/2 rounded bg-gray-800" />
      <div className="mt-6 flex gap-2">
        <div className="h-8 w-20 rounded bg-gray-800" />
        <div className="h-8 w-20 rounded bg-gray-800" />
      </div>
    </div>
  );
}

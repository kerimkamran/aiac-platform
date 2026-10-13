export default function Loading() {
  return (
    <div className="p-6 lg:p-10 max-w-5xl space-y-6" aria-busy>
      <div className="space-y-2.5">
        <div className="skeleton h-7 w-64 rounded-lg" />
        <div className="skeleton h-4 w-96 max-w-full rounded-lg" />
      </div>
      <div className="skeleton h-36 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

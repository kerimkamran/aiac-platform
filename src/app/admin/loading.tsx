import { Skeleton, LoadingRegion } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading the system view">
      <div className="px-1 py-2">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="mt-3 h-5 w-72 max-w-full" />
        <div className="mt-12 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

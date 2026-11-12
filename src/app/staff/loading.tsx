import { Skeleton } from "@/components/ui/Skeleton";
import { LoadingRegion } from "@/components/ui/Skeleton";

// Matches the staff home: statement, pipeline row, two lists.
export default function Loading() {
  return (
    <LoadingRegion label="Loading your home">
      <div className="container-page py-8 lg:py-12">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-10 w-full max-w-xl" />
        <Skeleton className="mt-3 h-5 w-72 max-w-full" />
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-5 gap-6 border-t border-line pt-8">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="mt-14 grid gap-12 lg:grid-cols-2">
          {[0, 1].map((c) => (
            <div key={c} className="space-y-3">
              <Skeleton className="h-6 w-40" />
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

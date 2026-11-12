import { Skeleton, LoadingRegion } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading your path">
      <div className="container-page max-w-4xl py-8 lg:py-12">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-10 w-full max-w-md" />
        <Skeleton className="mt-8 h-12" />
        <Skeleton className="mt-8 h-44" />
        <div className="mt-12 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

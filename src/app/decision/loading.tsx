import { Skeleton, LoadingRegion } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading your decisions">
      <div className="container-page max-w-3xl py-8 lg:py-12">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="mt-8 h-56" />
        <div className="mt-14 space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

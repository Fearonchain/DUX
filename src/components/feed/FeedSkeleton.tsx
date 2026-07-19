import { Skeleton } from "../ui/Skeleton";
import type { FeedViewMode } from "./FeedToolbar";

/** Placeholder card that mirrors FeedCard's layout while data loads. */
function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <Skeleton className="aspect-[3/1] rounded-none" />
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-2/3 rounded-full" />
            <Skeleton className="mt-1.5 h-2.5 w-1/3 rounded-full" />
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-line bg-bg-soft px-2.5 py-2">
          <div className="flex-1">
            <Skeleton className="h-4 w-20 rounded-full" />
            <Skeleton className="mt-1.5 h-2.5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-7 w-16 rounded" />
        </div>
        <Skeleton className="mt-2.5 h-3 w-full rounded-full" />
        <Skeleton className="mt-1.5 h-3 w-4/5 rounded-full" />
      </div>
    </div>
  );
}

/** Placeholder row that mirrors FeedTable's layout while data loads. */
function RowSkeleton() {
  return (
    <tr className="border-b border-line/60 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-32 rounded-full" />
            <Skeleton className="mt-1.5 h-2.5 w-20 rounded-full" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Skeleton className="ml-auto h-3.5 w-16 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="ml-auto h-3.5 w-12 rounded-full" />
      </td>
      <td className="hidden px-4 py-3 lg:table-cell">
        <Skeleton className="ml-auto h-7 w-[88px] rounded" />
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <Skeleton className="h-3 w-40 rounded-full" />
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <Skeleton className="h-5 w-24 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="ml-auto h-3 w-12 rounded-full" />
      </td>
    </tr>
  );
}

/** Full loading state for the live feed, matching the active view mode. */
export default function FeedSkeleton({ viewMode }: { viewMode: FeedViewMode }) {
  if (viewMode === "table") {
    return (
      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <RowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

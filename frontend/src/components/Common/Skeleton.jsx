export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-20 mb-3"></div>
      <div className="h-5 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6 mb-3"></div>
      <div className="flex space-x-4">
        <div className="h-3 bg-gray-200 rounded w-16"></div>
        <div className="h-3 bg-gray-200 rounded w-20"></div>
      </div>
    </div>
  );
}

export function SkeletonBlogCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200"></div>
      <div className="p-5">
        <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
        <div className="h-5 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-5 bg-gray-200 rounded w-4/5 mb-3"></div>
        <div className="h-3 bg-gray-200 rounded w-40"></div>
      </div>
    </div>
  );
}

export function SkeletonPaperDetail() {
  return (
    <div className="animate-pulse grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-6 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-10 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-[500px]">
          <div className="h-full bg-gray-100 rounded"></div>
        </div>
      </div>
    </div>
  );
}

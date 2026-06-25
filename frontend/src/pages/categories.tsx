import { AppLayout } from "@/components/layout/app-layout";
import { useListCategories } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function Categories() {
  const { data: categories, isLoading } = useListCategories();

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories?.map((cat) => (
              <Link key={cat.id} href={`/categories/${cat.id}`}>
                <div className="bg-card hover:bg-accent/10 hover:border-accent transition-colors border border-border p-6 rounded-xl flex flex-col items-center justify-center cursor-pointer text-center group">
                  <h2 className="font-bold text-lg group-hover:text-accent">{cat.name}</h2>
                  <p className="text-sm text-muted-foreground mt-2">{cat.videoCount} videos</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
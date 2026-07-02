import { AppLayout } from "@/components/layout/app-layout";
import { useListUsers } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Creators() {
  const { data, isLoading } = useListUsers({ role: "creator", limit: 50 });

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        <h1 className="text-2xl font-bold mb-6">Discover Creators</h1>
        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-card p-6 rounded-xl border flex flex-col items-center gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-8 w-full mt-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {data?.users.map((creator) => (
              <div key={creator.id} className="bg-card hover:bg-secondary/50 transition-colors p-6 rounded-xl border border-border flex flex-col items-center text-center group">
                <Link href={`/creators/${creator.id}`}>
                  <Avatar className="h-20 w-20 mb-4 cursor-pointer border-2 border-transparent group-hover:border-primary transition-colors">
                    <AvatarImage src={creator.avatarUrl || ""} />
                    <AvatarFallback className="text-2xl">{creator.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <Link href={`/creators/${creator.id}`}>
                  <h3 className="font-bold text-lg hover:text-primary cursor-pointer flex items-center justify-center gap-1">
                    {creator.displayName || creator.username}
                    {creator.isVerified && <span className="text-primary text-sm">✓</span>}
                  </h3>
                </Link>
                <p className="text-sm text-muted-foreground mb-4">@{creator.username}</p>
                <div className="flex gap-4 text-xs text-muted-foreground mb-6">
                  <div><strong className="text-foreground">{creator.followerCount}</strong> followers</div>
                  <div><strong className="text-foreground">{creator.videoCount}</strong> videos</div>
                </div>
                <Link href={`/creators/${creator.id}`} className="w-full">
                  <Button className="w-full rounded-full" variant="secondary">View Profile</Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
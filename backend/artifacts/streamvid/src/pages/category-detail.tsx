import { AppLayout } from "@/components/layout/app-layout";
import { useParams } from "wouter";

export default function CategoryDetail() {
  const params = useParams();
  
  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
        <h1 className="text-2xl font-bold">Category Detail: {params.id}</h1>
      </div>
    </AppLayout>
  );
}
import { ReactNode } from "react";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";
import { useLocation } from "wouter";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const isShortsPage = location === "/shorts";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {!isShortsPage && <Navbar />}
      {!isShortsPage && <Sidebar />}
      <main className={!isShortsPage ? "pt-14" : ""}>
        {children}
      </main>
    </div>
  );
}

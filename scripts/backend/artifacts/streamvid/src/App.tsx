import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { SidebarProvider } from "@/lib/sidebar-context";
import { NotificationProvider } from "@/lib/use-notifications";
import { MiningProvider } from "@/lib/use-mining";
import { SiteConfigProvider } from "@/lib/use-site-config";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import { PublicSiteSettingsProvider } from "@/lib/use-public-site-settings";
import { AgeGate } from "@/components/age-gate";
import { GeoGuard } from "@/components/geo-block";
import { usePageTracking } from "@/hooks/use-page-tracking";
import { ThemeProvider } from "@/lib/use-theme";
import { gated } from "@/components/layout/feature-gate";

// İlk render için gerekli değil — ayrı chunk olarak yüklenir
const Toaster        = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const AdBlockDetector = lazy(() => import("@/components/adblock-detector").then(m => ({ default: m.AdBlockDetector })));
const MiningConsent  = lazy(() => import("@/components/mining-consent").then(m => ({ default: m.MiningConsent })));
const ThemePicker    = lazy(() => import("@/components/theme-picker").then(m => ({ default: m.ThemePicker })));

const Home             = lazy(() => import("@/pages/home"));
const Videos           = lazy(() => import("@/pages/videos"));
const Shorts           = lazy(() => import("@/pages/shorts"));
const Search           = lazy(() => import("@/pages/search"));
const Categories       = lazy(() => import("@/pages/categories"));
const CategoryDetail   = lazy(() => import("@/pages/category-detail"));
const Creators         = lazy(() => import("@/pages/creators"));
const CreatorProfile   = lazy(() => import("@/pages/creator-profile"));
const VideoWatch       = lazy(() => import("@/pages/video-watch"));
const Login            = lazy(() => import("@/pages/login"));
const Register         = lazy(() => import("@/pages/register"));
const Profile          = lazy(() => import("@/pages/profile"));
const PublicProfile    = lazy(() => import("@/pages/public-profile"));
const Notifications    = lazy(() => import("@/pages/notifications"));
const Playlists        = lazy(() => import("@/pages/playlists"));
const PlaylistDetail   = lazy(() => import("@/pages/playlist-detail"));
const History          = lazy(() => import("@/pages/history"));
const Bookmarks        = lazy(() => import("@/pages/bookmarks"));
const Subscriptions    = lazy(() => import("@/pages/subscriptions"));
const Pricing          = lazy(() => import("@/pages/pricing"));
const Payment          = lazy(() => import("@/pages/payment"));
const CreatorDashboard = lazy(() => import("@/pages/creator-dashboard"));
const Admin            = lazy(() => import("@/pages/admin"));
const DeveloperPage    = lazy(() => import("@/pages/developer"));
const Upload           = lazy(() => import("@/pages/upload"));
const Stories          = lazy(() => import("@/pages/stories"));
const MyRequests       = lazy(() => import("@/pages/my-requests"));
const AffiliatePage    = lazy(() => import("@/pages/affiliate"));
const MessagesPage     = lazy(() => import("@/pages/messages"));
const LiveStreamsPage   = lazy(() => import("@/pages/live-streams"));
const LiveWatchPage    = lazy(() => import("@/pages/live-watch"));
const CustomPageView   = lazy(() => import("@/pages/custom-page"));
const DownloadsPage    = lazy(() => import("@/pages/downloads"));
const MatchRoomsPage   = lazy(() => import("@/pages/match-rooms"));
const LeaderboardPage  = lazy(() => import("@/pages/leaderboard"));
const BecomeCreator    = lazy(() => import("@/pages/become-creator"));
const CrosspostJobs    = lazy(() => import("@/pages/crosspost-jobs"));
const NotFound         = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      gcTime: 15 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function RouterInner() {
  usePageTracking();
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/videos" component={gated("videos", Videos)} />
        <Route path="/shorts" component={gated("shorts", Shorts)} />
        <Route path="/search" component={gated("search", Search)} />
        <Route path="/categories" component={gated("categories", Categories)} />
        <Route path="/categories/:id" component={gated("categories", CategoryDetail)} />
        <Route path="/creators" component={gated("creators", Creators)} />
        <Route path="/creators/:id" component={gated("creators", CreatorProfile)} />
        <Route path="/videos/:id" component={gated("videos", VideoWatch)} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/profile/:username" component={PublicProfile} />
        <Route path="/profile" component={Profile} />
        <Route path="/notifications" component={gated("notifications", Notifications)} />
        <Route path="/playlists" component={gated("playlists", Playlists)} />
        <Route path="/playlists/:id" component={gated("playlists", PlaylistDetail)} />
        <Route path="/history" component={gated("history", History)} />
        <Route path="/bookmarks" component={gated("bookmarks", Bookmarks)} />
        <Route path="/subscriptions" component={gated("subscriptions", Subscriptions)} />
        <Route path="/pricing" component={gated("pricing", Pricing)} />
        <Route path="/payment" component={gated("payment", Payment)} />
        <Route path="/creator/dashboard" component={gated("creator_dashboard", CreatorDashboard)} />
        <Route path="/admin" component={Admin} />
        <Route path="/developer" component={DeveloperPage} />
        <Route path="/upload" component={gated("upload", Upload)} />
        <Route path="/stories" component={gated("stories", Stories)} />
        <Route path="/my-requests" component={MyRequests} />
        <Route path="/affiliate" component={gated("affiliate", AffiliatePage)} />
        <Route path="/messages" component={gated("dm_messages", MessagesPage)} />
        <Route path="/messages/:convId" component={gated("dm_messages", MessagesPage)} />
        <Route path="/live" component={gated("live_streams", LiveStreamsPage)} />
        <Route path="/live/:id" component={gated("live_streams", LiveWatchPage)} />
        <Route path="/page/:slug" component={CustomPageView} />
        <Route path="/downloads" component={gated("downloads", DownloadsPage)} />
        <Route path="/match" component={gated("match", MatchRoomsPage)} />
        <Route path="/leaderboard" component={gated("leaderboard", LeaderboardPage)} />
        <Route path="/become-creator" component={BecomeCreator} />
        <Route path="/crosspost-jobs" component={CrosspostJobs} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ThemeProvider>
    <PublicSiteSettingsProvider>
    <GeoGuard>
    <AgeGate>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <FeatureFlagsProvider>
          <SiteConfigProvider>
          <MiningProvider>
            <NotificationProvider>
              <SidebarProvider>
                <TooltipProvider>
                  <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                    <RouterInner />
                  </WouterRouter>
                  <Suspense fallback={null}>
                    <Toaster />
                    <AdBlockDetector />
                    <MiningConsent />
                    <ThemePicker />
                  </Suspense>
                </TooltipProvider>
              </SidebarProvider>
            </NotificationProvider>
          </MiningProvider>
          </SiteConfigProvider>
          </FeatureFlagsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AgeGate>
    </GeoGuard>
    </PublicSiteSettingsProvider>
    </ThemeProvider>
  );
}

export default App;

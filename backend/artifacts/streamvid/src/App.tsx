import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { SidebarProvider } from "@/lib/sidebar-context";
import { NotificationProvider } from "@/lib/use-notifications";
import { MiningProvider } from "@/lib/use-mining";
import { SiteConfigProvider } from "@/lib/use-site-config";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import { PublicSiteSettingsProvider } from "@/lib/use-public-site-settings";
import { AgeGate } from "@/components/age-gate";
import { AdBlockDetector } from "@/components/adblock-detector";
import { MiningConsent } from "@/components/mining-consent";
import { GeoGuard } from "@/components/geo-block";

import Home from "@/pages/home";
import Videos from "@/pages/videos";
import Shorts from "@/pages/shorts";
import Search from "@/pages/search";
import Categories from "@/pages/categories";
import CategoryDetail from "@/pages/category-detail";
import Creators from "@/pages/creators";
import CreatorProfile from "@/pages/creator-profile";
import VideoWatch from "@/pages/video-watch";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Profile from "@/pages/profile";
import Notifications from "@/pages/notifications";
import Playlists from "@/pages/playlists";
import PlaylistDetail from "@/pages/playlist-detail";
import History from "@/pages/history";
import Bookmarks from "@/pages/bookmarks";
import Subscriptions from "@/pages/subscriptions";
import Pricing from "@/pages/pricing";
import Payment from "@/pages/payment";
import CreatorDashboard from "@/pages/creator-dashboard";
import Admin from "@/pages/admin";
import DeveloperPage from "@/pages/developer";
import Upload from "@/pages/upload";
import Stories from "@/pages/stories";
import MyRequests from "@/pages/my-requests";
import AffiliatePage from "@/pages/affiliate";
import MessagesPage from "@/pages/messages";
import LiveStreamsPage from "@/pages/live-streams";
import LiveWatchPage from "@/pages/live-watch";
import CustomPageView from "@/pages/custom-page";
import DownloadsPage from "@/pages/downloads";
import MatchRoomsPage from "@/pages/match-rooms";
import LeaderboardPage from "@/pages/leaderboard";
import BecomeCreator from "@/pages/become-creator";
import CrosspostJobs from "@/pages/crosspost-jobs";
import NotFound from "@/pages/not-found";
import { usePageTracking } from "@/hooks/use-page-tracking";
import { ThemeProvider } from "@/lib/use-theme";
import { gated } from "@/components/layout/feature-gate";
import { ThemePicker } from "@/components/theme-picker";

const queryClient = new QueryClient();

function RouterInner() {
  usePageTracking();
  return (
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
  );
}

function Router() {
  return <RouterInner />;
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
                    <Router />
                  </WouterRouter>
                  <Toaster />
                  <AdBlockDetector />
                  <MiningConsent />
                  <ThemePicker />
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

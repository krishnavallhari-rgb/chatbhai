import React from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { useApp } from '@/lib/store';
import { Sidebar, MobileTabBar } from '@/components/layout';
import { AnimatePresence } from 'framer-motion';

// Pages
import Feed from '@/pages/feed';
import Login from '@/pages/login';
import Register from '@/pages/register';
import ForgotPassword from '@/pages/forgot-password';
import Messages from '@/pages/messages';
import NotFound from '@/pages/not-found';
import Profile from '@/pages/profile';
import ProfileEdit from '@/pages/profile-edit';
import Settings from '@/pages/settings';
import Explore from '@/pages/explore';
import Notifications from '@/pages/notifications';
import Search from '@/pages/search';
import Stories from '@/pages/stories';
import Create from '@/pages/create';
import UserList from '@/pages/user-list';

export function AppRouter() {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="*">
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto relative pb-16 md:pb-0 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        <AnimatePresence mode="wait">
          <Switch>
            <Route path="/" component={() => <Redirect to="/feed" />} />
            <Route path="/feed" component={Feed} />
            <Route path="/explore" component={Explore} />
            <Route path="/search" component={Search} />
            <Route path="/messages" component={Messages} />
            <Route path="/messages/:id" component={Messages} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/create" component={Create} />
            <Route path="/profile/edit" component={ProfileEdit} />
            <Route
              path="/profile/:username/followers"
              component={({ params }) => (
                <UserList params={params} mode="followers" />
              )}
            />
            <Route
              path="/profile/:username/following"
              component={({ params }) => (
                <UserList params={params} mode="following" />
              )}
            />
            <Route path="/profile/:username" component={Profile} />
            <Route path="/settings" component={Settings} />
            <Route path="/stories/:id" component={Stories} />
            <Route component={NotFound} />
          </Switch>
        </AnimatePresence>
      </main>
      <MobileTabBar />
    </div>
  );
}

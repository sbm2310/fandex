import AppTabs from '@/components/app-tabs';

/**
 * The tab bar (Collection, Universes, Add, Upcoming, Account). Lives in a route group so its screens keep
 * their URLs: /, /universes, /add, /upcoming and /account.
 */
export default function TabsLayout() {
  return <AppTabs />;
}

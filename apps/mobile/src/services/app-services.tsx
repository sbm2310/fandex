import type { BookCatalog, CollectionRepository, LegoCatalog } from '@fandex/core';
import { createContext, use, type ReactNode } from 'react';

import type { AccountService } from './account-service';
import type { AdminReviews } from './admin-reviews';
import type { DeviceSessions } from './device-sessions';
import type { CustomItems } from './custom-items';
import type { FigureCatalog } from './figure-catalog';
import type { FigureScanner } from './figure-scanner';
import type { FigureSuggestions } from './figure-suggestions';
import type { Preorders } from './preorders';
import type { QuestionAsker } from './question-asker';
import type { SeriesCatalog } from './series-catalog';
import type { ShelfScanner } from './shelf-scanner';

/** The app's external dependencies. The root layout provides real ones; tests provide fakes. */
export type AppServices = {
  catalog: BookCatalog;
  legoCatalog: LegoCatalog;
  /** Fandex's shared figure catalog (public). */
  figureCatalog: FigureCatalog;
  /** Books saved on this device: the collection while signed out ("guest mode"). */
  deviceCollection: CollectionRepository;
  /** The signed-in user's collection on the Fandex API, synced across devices. */
  accountCollection: CollectionRepository;
  account: AccountService;
  /** Shelf photos read by AI on the Fandex API (signed in only). */
  shelfScanner: ShelfScanner;
  /** Figure boxes read by AI on the Fandex API (signed in only). */
  figureScanner: FigureScanner;
  /** "Ask your collection" questions answered on the Fandex API (signed in only). */
  questionAsker: QuestionAsker;
  /** Figures added by hand, saved on the Fandex API (signed in). */
  customItems: CustomItems;
  /** Suggesting the user's own figures for the shared catalog (signed in). */
  figureSuggestions: FigureSuggestions;
  /** Reviewing figure suggestions (admins only). */
  adminReviews: AdminReviews;
  /** The devices the user is signed in on (signed in only). */
  deviceSessions: DeviceSessions;
  /** The signed-in user's pre-orders on the Fandex API. */
  preorders: Preorders;
  /** Book series and the books missing from them (public, also for guests). */
  seriesCatalog: SeriesCatalog;
};

const AppServicesContext = createContext<AppServices | null>(null);

/** Supplies services to screens, like registering them in a DI container. */
export function AppServicesProvider({
  services,
  children,
}: {
  services: AppServices;
  children: ReactNode;
}) {
  return <AppServicesContext value={services}>{children}</AppServicesContext>;
}

function useAppServices(): AppServices {
  const services = use(AppServicesContext);
  if (!services) throw new Error('App services are missing: wrap the app in <AppServicesProvider>');
  return services;
}

export function useCatalog(): BookCatalog {
  return useAppServices().catalog;
}

export function useLegoCatalog(): LegoCatalog {
  return useAppServices().legoCatalog;
}

export function useFigureCatalog(): FigureCatalog {
  return useAppServices().figureCatalog;
}

export function useCollectionRepositories(): {
  device: CollectionRepository;
  account: CollectionRepository;
} {
  const { deviceCollection, accountCollection } = useAppServices();
  return { device: deviceCollection, account: accountCollection };
}

export function useAccountService(): AccountService {
  return useAppServices().account;
}

export function useShelfScanner(): ShelfScanner {
  return useAppServices().shelfScanner;
}

export function useFigureScanner(): FigureScanner {
  return useAppServices().figureScanner;
}

export function useQuestionAsker(): QuestionAsker {
  return useAppServices().questionAsker;
}

export function useCustomItems(): CustomItems {
  return useAppServices().customItems;
}

export function useFigureSuggestionService(): FigureSuggestions {
  return useAppServices().figureSuggestions;
}

export function useAdminReviews(): AdminReviews {
  return useAppServices().adminReviews;
}

export function useDeviceSessions(): DeviceSessions {
  return useAppServices().deviceSessions;
}

export function usePreorderService(): Preorders {
  return useAppServices().preorders;
}

export function useSeriesCatalog(): SeriesCatalog {
  return useAppServices().seriesCatalog;
}

import type { BookCatalog, CollectionRepository, LegoCatalog } from '@fandex/core';
import { createContext, use, type ReactNode } from 'react';

import type { AccountService } from './account-service';
import type { CustomItems } from './custom-items';
import type { FigureCatalog } from './figure-catalog';
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
  /** "Ask your collection" questions answered on the Fandex API (signed in only). */
  questionAsker: QuestionAsker;
  /** Figures added by hand, saved on the Fandex API (signed in). */
  customItems: CustomItems;
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

export function useQuestionAsker(): QuestionAsker {
  return useAppServices().questionAsker;
}

export function useCustomItems(): CustomItems {
  return useAppServices().customItems;
}

export function usePreorderService(): Preorders {
  return useAppServices().preorders;
}

export function useSeriesCatalog(): SeriesCatalog {
  return useAppServices().seriesCatalog;
}

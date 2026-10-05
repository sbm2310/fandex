import type { BookCatalog, CollectionRepository } from '@fandex/core';
import { createContext, use, type ReactNode } from 'react';

import type { AccountService } from './account-service';

/** The app's external dependencies. The root layout provides real ones; tests provide fakes. */
export type AppServices = {
  catalog: BookCatalog;
  /** Books saved on this device: the collection while signed out ("guest mode"). */
  deviceCollection: CollectionRepository;
  /** The signed-in user's collection on the Fandex API, synced across devices. */
  accountCollection: CollectionRepository;
  account: AccountService;
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

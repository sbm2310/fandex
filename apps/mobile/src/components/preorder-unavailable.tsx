import { EmptyState } from './empty-state';
import { PageTitle } from './page-title';

type Props = {
  signedIn: boolean;
  /** Loading the pre-orders failed (offline, server down): not the same as "it's gone". */
  failed: boolean;
  retry: () => void;
};

/** Why a pre-order can't be shown: signed out, couldn't load, or no such pre-order. */
export function PreorderUnavailable({ signedIn, failed, retry }: Props) {
  if (!signedIn) {
    return (
      <>
        <PageTitle title="Pre-order" />
        <EmptyState
          title="No such pre-order"
          message="Sign in to see your pre-orders."
          action={{ label: 'Sign in', href: '/account' }}
        />
      </>
    );
  }
  if (failed) {
    return (
      <>
        <PageTitle title="Pre-order" />
        <EmptyState
          title="Couldn't load this pre-order"
          message="Can't reach the Fandex server. Check your connection and try again."
          action={{ label: 'Try again', onPress: retry }}
        />
      </>
    );
  }
  return (
    <>
      <PageTitle title="Not found" />
      <EmptyState
        title="No such pre-order"
        message="It may have been deleted."
        action={{ label: 'Upcoming', href: '/upcoming' }}
      />
    </>
  );
}

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

export default function AddScreen() {
  return (
    <Screen>
      <EmptyState
        title="Add a book"
        message="Search by title or author, or scan the barcode on the back of a book. Coming soon."
      />
    </Screen>
  );
}

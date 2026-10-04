import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

export default function CollectionScreen() {
  return (
    <Screen>
      <EmptyState
        title="Your collection is empty"
        message="Add books by searching for a title or scanning an ISBN barcode."
        action={{ label: 'Add your first book', href: '/add' }}
      />
    </Screen>
  );
}

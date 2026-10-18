import { LegalPage } from '@/components/legal-page';
import { TERMS } from '@/content/legal';

export default function TermsScreen() {
  return <LegalPage document={TERMS} />;
}

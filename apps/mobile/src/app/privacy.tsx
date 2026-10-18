import { LegalPage } from '@/components/legal-page';
import { PRIVACY_POLICY } from '@/content/legal';

export default function PrivacyScreen() {
  return <LegalPage document={PRIVACY_POLICY} />;
}

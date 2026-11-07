import type { Metadata } from 'next';
import { readChangelog } from '@/lib/changelog';
import { VersionHistory } from '@/components/version/VersionHistory';

export const metadata: Metadata = { title: 'Riwayat versi · Leosiqra', robots: { index: false } };

export default function VersiPage() {
  return <VersionHistory entries={readChangelog()} variant="web" />;
}

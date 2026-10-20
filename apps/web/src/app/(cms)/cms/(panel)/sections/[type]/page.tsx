/**
 * `/cms/sections/[type]` — one section's editor and live preview (`cms-panel-shell.T05`, `T07`).
 */
import { SectionEditorScreen } from './section-editor-screen';

interface SectionPageProps {
  readonly params: Promise<{ type: string }>;
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { type } = await params;
  return <SectionEditorScreen type={type} />;
}

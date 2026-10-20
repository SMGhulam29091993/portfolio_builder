/**
 * The renderer catalogue: every section renderer and layout variant this build ships
 * (`int-standards.nextjs.md` → Adding a section type or layout variant, step 2; `design-theme` →
 * Variant catalogue). Each type lists its reference variant first — the registry's fallback for
 * an unknown id. The public site and the CMS preview both render through `rendererRegistry`.
 */
import { AboutBento } from './about/bento.js';
import { AboutStacked } from './about/stacked.js';
import { ContactGlowCard } from './contact/glow-card.js';
import { ContactMinimal } from './contact/minimal.js';
import { ExperienceCards } from './experience/cards.js';
import { ExperienceTimeline } from './experience/timeline.js';
import { HeroCentered } from './hero/centered.js';
import { HeroSplitCodeCard } from './hero/split-code-card.js';
import { SectionRendererRegistry, type SectionRendererEntry } from './registry.js';
import type { SectionContext } from './shared/context.js';
import { StackChipGroups } from './stack/chip-groups.js';
import { StackColumns } from './stack/columns.js';
import { WorkFeaturedGrid } from './work/featured-grid.js';
import { WorkList } from './work/list.js';

export const SECTION_RENDERERS: readonly SectionRendererEntry<SectionContext>[] = [
  { type: 'hero', variant: 'split-code-card', component: HeroSplitCodeCard, label: 'Split with code card' },
  { type: 'hero', variant: 'centered', component: HeroCentered, label: 'Centred' },
  { type: 'about', variant: 'bento', component: AboutBento, label: 'Bento grid' },
  { type: 'about', variant: 'stacked', component: AboutStacked, label: 'Stacked' },
  { type: 'work', variant: 'featured-grid', component: WorkFeaturedGrid, label: 'Featured + grid' },
  { type: 'work', variant: 'list', component: WorkList, label: 'List' },
  { type: 'experience', variant: 'timeline', component: ExperienceTimeline, label: 'Timeline' },
  { type: 'experience', variant: 'cards', component: ExperienceCards, label: 'Cards' },
  { type: 'stack', variant: 'chip-groups', component: StackChipGroups, label: 'Chip groups' },
  { type: 'stack', variant: 'columns', component: StackColumns, label: 'Columns' },
  { type: 'contact', variant: 'glow-card', component: ContactGlowCard, label: 'Glow card' },
  { type: 'contact', variant: 'minimal', component: ContactMinimal, label: 'Minimal' },
];

export const rendererRegistry = new SectionRendererRegistry<SectionContext>(SECTION_RENDERERS);

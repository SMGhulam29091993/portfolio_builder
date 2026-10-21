/**
 * `/cms/credits` — mount point (`cms-panel-shell` → Screens) for buying credits, filled by
 * `credits-billing` (ADR-0012). The AI Studio's "Buy credits" link leads here
 * (`ai-design-studio.AC18`).
 */
import { AreaPlaceholder } from '../../../../../components/cms/panel/area-placeholder';

export default function Page() {
  return <AreaPlaceholder title="Credits" note="Buying credits is not available yet." />;
}

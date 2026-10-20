/** `buildPreviewModel` — `cms-panel-shell.UT06` (AC9). */
import { describe, expect, it } from 'vitest';

import { buildPreviewModel } from './preview-model';

const draft = {
  portfolio: { id: 'p', slug: 's', revision: 3, sectionOrder: ['about', 'work'] },
  sections: [
    { type: 'hero', visible: true, revision: 1, data: { title: 'Saved hero' } },
    { type: 'about', visible: true, revision: 2, data: { heading: 'Saved about' } },
    { type: 'work', visible: false, revision: 1, data: { heading: 'Saved work' } },
  ],
};

describe('buildPreviewModel (cms-panel-shell.UT06)', () => {
  it('replaces only the edited section data', () => {
    const model = buildPreviewModel(draft, { type: 'about', data: { heading: 'Unsaved' } });

    expect(model.sections).toEqual([
      { type: 'hero', visible: true, data: { title: 'Saved hero' } },
      { type: 'about', visible: true, data: { heading: 'Unsaved' } },
      { type: 'work', visible: false, data: { heading: 'Saved work' } },
    ]);
    expect(model.sectionOrder).toEqual(['about', 'work']);
  });

  it('is the saved draft when nothing is being edited', () => {
    expect(buildPreviewModel(draft).sections[1]?.data).toEqual({ heading: 'Saved about' });
  });
});

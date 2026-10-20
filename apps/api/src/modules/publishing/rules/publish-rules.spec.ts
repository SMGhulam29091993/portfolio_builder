/**
 * The nine publish rules (`publish-pipeline.T04`): UT01–UT04 and the `IPublishRule` contract
 * (`publish-pipeline.CT02`) — one passing and one failing fixture each.
 */
import { describe, expect, it } from 'vitest';

import { publishableContent, sectionData, seedContent } from '../../../testing/index.js';
import type { IPublishDesignCheck, IPublishRule } from '../publishing.interface.js';
import type { PublishedContent } from '../publishing.types.js';
import { AssetsResolveRule } from './assets-resolve.rule.js';
import { DesignValidRule } from './design-valid.rule.js';
import { FillerTextRule } from './filler-text.rule.js';
import { InternalLinksResolveRule } from './internal-links-resolve.rule.js';
import { LinksValidRule } from './links-valid.rule.js';
import { NoPlaceholderTextRule } from './no-placeholder-text.rule.js';
import { ResumeMissingRule } from './resume-missing.rule.js';
import { SectionsAllHiddenRule } from './sections-all-hidden.rule.js';
import { SeoIncompleteRule } from './seo-incomplete.rule.js';

/** Fails a design whose `theme` is the string `bad`; otherwise passes. */
const designCheck: IPublishDesignCheck = {
  check: (design) =>
    typeof design === 'object' && design !== null && 'theme' in design && design.theme === 'bad'
      ? [{ path: 'theme.colors.text', message: 'Contrast too low' }]
      : [],
};

/** Each rule with a mutation that makes it fail, and the path its issue must carry. */
const CASES: readonly { rule: IPublishRule; breaks: (content: PublishedContent) => void; path: string }[] = [
  {
    rule: new NoPlaceholderTextRule(),
    breaks: (content) => {
      content.identity.roleTitle = '[Your role]';
    },
    path: 'identity.roleTitle',
  },
  {
    rule: new LinksValidRule(),
    breaks: (content) => {
      content.identity.socials[0] = { ...content.identity.socials[0], platform: 'github', url: 'http://insecure.test' };
    },
    path: 'identity.socials[0].url',
  },
  {
    rule: new InternalLinksResolveRule(),
    breaks: (content) => {
      content.sections = content.sections.filter((section) => section.type !== 'contact');
    },
    path: 'sections.hero.',
  },
  {
    rule: new AssetsResolveRule(),
    breaks: (content) => {
      content.assets = [];
    },
    path: 'identity.resume.assetId',
  },
  {
    rule: new DesignValidRule(designCheck),
    breaks: (content) => {
      content.design.theme = 'bad';
    },
    path: 'design.theme.colors.text',
  },
  {
    rule: new FillerTextRule(),
    breaks: (content) => {
      content.identity.roleTitle = 'Engineer TODO';
    },
    path: 'identity.roleTitle',
  },
  {
    rule: new ResumeMissingRule(),
    breaks: (content) => {
      content.identity.resume.assetId = null;
    },
    path: 'identity.resume.assetId',
  },
  {
    rule: new SeoIncompleteRule(),
    breaks: (content) => {
      content.identity.seo.title = ' ';
    },
    path: 'identity.seo.title',
  },
  {
    rule: new SectionsAllHiddenRule(),
    breaks: (content) => {
      content.sections = content.sections.filter((section) => section.type === 'hero');
    },
    path: 'sections',
  },
];

describe('publish-pipeline.CT02 / UT03 / UT04 — every rule', () => {
  it('has nine distinct ids; four are warnings', () => {
    expect(new Set(CASES.map(({ rule }) => rule.id)).size).toBe(9);
    expect(CASES.filter(({ rule }) => rule.severity === 'warning').map(({ rule }) => rule.id).sort()).toEqual(
      ['filler-text', 'resume-missing', 'sections-all-hidden', 'seo-incomplete'],
    );
  });

  it.each(CASES)('$rule.id: a clean fixture yields none; a broken one yields issues with its id, severity and path', async ({ rule, breaks, path }) => {
    expect(await rule.check(publishableContent())).toEqual([]);
    const content = publishableContent();
    breaks(content);
    const issues = await rule.check(content);
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue).toMatchObject({ rule: rule.id, severity: rule.severity });
      expect(issue.message.length).toBeGreaterThan(0);
    }
    expect(issues.some((issue) => issue.path.startsWith(path))).toBe(true);
  });
});

describe('no-placeholder-text', () => {
  const rule = new NoPlaceholderTextRule();

  it('publish-pipeline.UT01 — one issue on the seed, at the Second Brain description', async () => {
    expect(await rule.check(seedContent())).toEqual([
      { rule: 'no-placeholder-text', severity: 'error', path: 'sections.work.projects[3].description', message: 'Replace the placeholder text in brackets' },
    ]);
  });

  it.each([
    ['[1]', 0],
    ['[beta]', 0],
    ['See [Note 1] below', 0],
    ['[ADD LINK]', 1],
    ['[Your project]', 1],
    ['[add a one-line description]', 0],
  ])('publish-pipeline.UT02 — %s gives %i issue(s)', async (text, count) => {
    const content = publishableContent();
    content.identity.roleTitle = text;
    expect(await rule.check(content)).toHaveLength(count);
  });

  it('publish-pipeline.UT02 — finds a placeholder inside a tag and a metric label', async () => {
    const content = publishableContent();
    const work = sectionData(content, 'work') as { projects: { tags: string[]; metrics: { label: string }[] }[] };
    const [project] = work.projects;
    if (!project?.metrics[0]) throw new Error('fixture');
    project.tags.push('[ADD A TOOL NAME]');
    project.metrics[0].label = '[Your metric label]';
    expect((await rule.check(content)).map((issue) => issue.path)).toEqual([
      'sections.work.projects[0].metrics[0].label',
      `sections.work.projects[0].tags[${String(project.tags.length - 1)}]`,
    ]);
  });
});

describe('rule details', () => {
  it('links-valid refuses an unparsable link and accepts mailto:', async () => {
    const content = publishableContent();
    content.identity.socials[0] = { platform: 'github', url: 'not a url' };
    expect(await new LinksValidRule().check(content)).toHaveLength(1);
    const mail = publishableContent();
    const [project] = (sectionData(mail, 'work') as { projects: { link: string | null }[] }).projects;
    if (!project) throw new Error('fixture');
    project.link = 'mailto:ada@example.test';
    expect(await new LinksValidRule().check(mail)).toEqual([]);
  });

  it('assets-resolve names the wrong kind', async () => {
    const content = publishableContent();
    content.identity.seo.ogImageAssetId = content.assets[0]?.id ?? null;
    expect(await new AssetsResolveRule().check(content)).toEqual([
      { rule: 'assets-resolve', severity: 'error', path: 'identity.seo.ogImageAssetId', message: 'This file must be an image' },
    ]);
  });

  it('design-valid reports a whole-design problem at `design`', async () => {
    const rule = new DesignValidRule({ check: () => [{ path: '', message: 'Unreadable' }] });
    expect((await rule.check(publishableContent()))[0]?.path).toBe('design');
  });

  it('filler-text matches lorem ipsum and whole words only', async () => {
    const rule = new FillerTextRule();
    for (const [text, count] of [['Lorem ipsum dolor', 1], ['tbd', 1], ['Todos and TBDs', 0]] as const) {
      const content = publishableContent();
      content.identity.roleTitle = text;
      expect(await rule.check(content)).toHaveLength(count);
    }
  });

  it('seo-incomplete reports the description too', async () => {
    const content = publishableContent();
    content.identity.seo.description = '';
    expect((await new SeoIncompleteRule().check(content)).map((issue) => issue.path)).toEqual(['identity.seo.description']);
  });
});

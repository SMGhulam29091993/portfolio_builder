/**
 * `DesignPromptBuilder` (`ai-design-studio.T03`; AC3, AC4, AC15): the provider-agnostic request.
 *
 * It sends the catalogue, the font allow-list, the contrast rules, the scope, the visible section
 * types and — when the user asked to start from it — the current design. Its input type has no
 * field for a name, an email or section text, so none can reach a provider (AC15).
 *
 * The JSON Schema of the answer is derived once from the `DesignSpec` zod schema in
 * `packages/design-tokens`, narrowed to this catalogue's fonts and variants — one definition,
 * never hand-copied per adapter. The parser stays the authority whatever a provider enforces.
 */
import {
  designSpecSchema,
  layoutSchema,
  MOTIONS,
  RADII,
  themeTokensSchema,
  type ContrastPair,
  type FontInfo,
  type FontRole,
  type VariantInfo,
} from '@portfolio/design-tokens';
import { z } from 'zod';

import type { IDesignPromptBuilder } from './ai-design.interface.js';
import {
  RATIONALE_MAX_LENGTH,
  type AnswerIssue,
  type GenerationRequest,
  type PromptInput,
  type ProposalScope,
} from './ai-design.types.js';

/** What the model may choose from; `container.ts` passes the design-tokens catalogue. */
export interface DesignCatalogue {
  readonly variants: Readonly<Record<string, readonly VariantInfo[]>>;
  readonly fonts: readonly FontInfo[];
  readonly contrastPairs: readonly ContrastPair[];
}

/** The schema name providers that ask for one receive (OpenRouter). */
const SCHEMA_NAME = 'design_proposal';

/** A previous answer longer than this is cut in the repair turn; the issues matter, not the bulk. */
const MAX_ECHOED_ANSWER = 4_000;

/** What each scope asks of the model. The parser enforces it regardless (AC5). */
const SCOPE_TEXT: Readonly<Record<ProposalScope, string>> = {
  theme: 'Change only the theme (colours, fonts, radius, effects). The layout is kept as it is; return it unchanged.',
  layout: 'Change only the layout (one variant per section). The theme is kept as it is; return it unchanged.',
  both: 'Change the theme and the layout.',
};

export class DesignPromptBuilder implements IDesignPromptBuilder {
  private readonly instructions: string;
  private readonly schema: Readonly<Record<string, unknown>>;

  constructor(catalogue: DesignCatalogue) {
    this.instructions = DesignPromptBuilder.instructionsFor(catalogue);
    this.schema = DesignPromptBuilder.schemaFor(catalogue);
  }

  build(input: PromptInput): GenerationRequest {
    const lines = [
      `Request: ${input.prompt}`,
      `Scope: ${SCOPE_TEXT[input.scope]}`,
      `Visible sections, in page order: ${input.visibleSections.join(', ') || 'none'}.`,
      input.current
        ? `Current design, to start from:\n${JSON.stringify(input.current)}`
        : 'Start fresh rather than from the current design.',
    ];
    return {
      instructions: this.instructions,
      messages: [{ role: 'user', content: lines.join('\n') }],
      schema: this.schema,
      schemaName: SCHEMA_NAME,
    };
  }

  repair(request: GenerationRequest, answer: string, issues: readonly AnswerIssue[]): GenerationRequest {
    const problems = issues.map((issue) => `- ${issue.path || '(answer)'}: ${issue.message}`).join('\n');
    return {
      ...request,
      messages: [
        ...request.messages,
        { role: 'assistant', content: answer.slice(0, MAX_ECHOED_ANSWER) },
        {
          role: 'user',
          content: `That answer cannot be used:\n${problems}\nAnswer again with one corrected JSON object that matches the schema.`,
        },
      ],
    };
  }

  /** The system instructions: what may be chosen, and the rules every answer must meet. */
  private static instructionsFor(catalogue: DesignCatalogue): string {
    const fontsOf = (role: FontRole) =>
      catalogue.fonts.filter((font) => font.role === role).map((font) => `${font.id} (${font.label})`).join(', ');
    const variants = Object.entries(catalogue.variants)
      .map(([section, entries]) => `- ${section}: ${entries.map((entry) => `${entry.id} (${entry.label})`).join(', ')}`)
      .join('\n');
    const contrast = catalogue.contrastPairs
      .map((pair) => `- ${pair.foreground} on ${pair.background}: at least ${String(pair.minimum)}:1`)
      .join('\n');
    return [
      'You choose the visual design of a portfolio website from a fixed catalogue.',
      'You never write HTML, CSS, JavaScript, URLs, links, images or page copy.',
      'Answer with exactly one JSON object matching the given schema and nothing else:',
      `"theme" (colours, fonts, radius, effects), "layout" (one variant per section) and "rationale" (one or two plain sentences, at most ${String(RATIONALE_MAX_LENGTH)} characters, with no links or markup).`,
      'Colours are 6-digit hex values such as #1a2b3c. These contrast ratios (WCAG 2.1) must hold:',
      contrast,
      `Fonts — sans: ${fontsOf('sans')}; display: ${fontsOf('display')}; mono: ${fontsOf('mono')}.`,
      `Radius: one of ${RADII.join(', ')}. Motion: one of ${MOTIONS.join(', ')}.`,
      'Layout variants by section:',
      variants,
      'Choose only from these lists. When the request asks for something they cannot express, still return a design from the lists and say so in the rationale.',
    ].join('\n');
  }

  /** The answer's JSON Schema: `DesignSpec` plus a rationale, narrowed to the catalogue. */
  private static schemaFor(catalogue: DesignCatalogue): Readonly<Record<string, unknown>> {
    const choice = (ids: readonly string[]) => z.enum(ids as [string, ...string[]]);
    const fontIds = (role: FontRole) => catalogue.fonts.filter((font) => font.role === role).map((font) => font.id);
    const answer = designSpecSchema.extend({
      theme: themeTokensSchema.extend({
        fonts: z.object({ sans: choice(fontIds('sans')), display: choice(fontIds('display')), mono: choice(fontIds('mono')) }),
      }),
      layout: z.object(
        Object.fromEntries(
          Object.keys(layoutSchema.shape).map((section) => [
            section,
            choice((catalogue.variants[section] ?? []).map((entry) => entry.id)),
          ]),
        ),
      ),
      rationale: z.string().max(RATIONALE_MAX_LENGTH),
    });
    // `io: 'input'` describes what the model writes (before the hex transform). Strict-mode
    // providers want closed objects, so every object refuses extra keys.
    const schema: Record<string, unknown> = z.toJSONSchema(answer, {
      io: 'input',
      override: ({ jsonSchema }) => {
        if (jsonSchema.type === 'object') jsonSchema.additionalProperties = false;
      },
    });
    // The dialect marker is not part of the answer's shape, and some providers refuse it.
    delete schema.$schema;
    return Object.freeze(schema);
  }
}

/**
 * Drives the CMS API from an E2E spec through the web app's `/api/v1` proxy — the same origin a
 * browser uses — for set-up the journey under test is not about (publishing before visiting the
 * public site). Signs in with a password; keeps the session in its own request context.
 */
import type { APIRequest, APIRequestContext } from '@playwright/test';

/** The seed's one placeholder (`publish-pipeline.AC4`). */
const SEED_PLACEHOLDER = '[ADD A ONE-LINE DESCRIPTION OF WHAT SECOND BRAIN DOES]';

interface DraftSection {
  readonly type: string;
  readonly revision: number;
  readonly visible: boolean;
  readonly data: Record<string, unknown>;
}

export class CmsApi {
  private constructor(private readonly context: APIRequestContext) {}

  static async signIn(requests: APIRequest, baseURL: string, credentials: { email: string; password: string }): Promise<CmsApi> {
    const context = await requests.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
    const response = await context.post('/api/v1/auth/login', { data: credentials });
    if (!response.ok()) throw new Error(`Sign-in failed with ${String(response.status())}`);
    return new CmsApi(context);
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }

  async slug(): Promise<string> {
    const body = (await (await this.context.get('/api/v1/cms/portfolio')).json()) as { data: { portfolio: { slug: string } } };
    return body.data.portfolio.slug;
  }

  /** The page order the public site must show: `hero`, then the visible sections in order. */
  async publishedOrder(): Promise<string[]> {
    const body = (await (await this.context.get('/api/v1/cms/portfolio')).json()) as {
      data: { portfolio: { sectionOrder: string[] }; sections: DraftSection[] };
    };
    const visible = new Set(body.data.sections.filter((section) => section.visible).map((section) => section.type));
    return ['hero', ...body.data.portfolio.sectionOrder.filter((type) => visible.has(type))];
  }

  async section(type: string): Promise<DraftSection> {
    const body = (await (await this.context.get('/api/v1/cms/portfolio')).json()) as { data: { sections: DraftSection[] } };
    const found = body.data.sections.find((section) => section.type === type);
    if (!found) throw new Error(`No ${type} section`);
    return found;
  }

  async editSection(type: string, edit: (data: Record<string, unknown>) => void): Promise<void> {
    const section = await this.section(type);
    const data = structuredClone(section.data);
    edit(data);
    const response = await this.context.put(`/api/v1/cms/portfolio/sections/${type}`, { data: { expectedRevision: section.revision, data } });
    if (!response.ok()) throw new Error(`Saving ${type} failed with ${String(response.status())}`);
  }

  async setVisible(type: string, visible: boolean): Promise<void> {
    const section = await this.section(type);
    const response = await this.context.patch(`/api/v1/cms/portfolio/sections/${type}/visibility`, {
      data: { expectedRevision: section.revision, visible },
    });
    if (!response.ok()) throw new Error(`Visibility of ${type} failed with ${String(response.status())}`);
  }

  /** Replaces the seed placeholder if it is still there. */
  async fixSeedPlaceholder(): Promise<void> {
    const work = await this.section('work');
    if (!JSON.stringify(work.data).includes(SEED_PLACEHOLDER)) return;
    await this.editSection('work', (data) => {
      for (const project of (data as { projects: { description: string }[] }).projects) {
        project.description = project.description.replace(SEED_PLACEHOLDER, 'A second brain for notes and links.');
      }
    });
  }

  async uploadResume(bytes: Buffer, filename: string): Promise<string> {
    const response = await this.context.post('/api/v1/cms/assets', {
      multipart: { kind: 'resume', file: { name: filename, mimeType: 'application/pdf', buffer: bytes } },
    });
    return ((await response.json()) as { data: { asset: { id: string } } }).data.asset.id;
  }

  async setResume(assetId: string | null): Promise<void> {
    const { data } = (await (await this.context.get('/api/v1/cms/identity')).json()) as {
      data: { identity: { revision: number; data: { resume: Record<string, unknown> } } };
    };
    const response = await this.context.put('/api/v1/cms/identity', {
      data: { expectedRevision: data.identity.revision, data: { ...data.identity.data, resume: { ...data.identity.data.resume, assetId } } },
    });
    if (!response.ok()) throw new Error(`Saving the identity failed with ${String(response.status())}`);
  }

  /** Validates and publishes; "already live" counts as published. */
  async publish(): Promise<void> {
    const report = (await (await this.context.post('/api/v1/cms/publishing/validate')).json()) as { data: { draftContentHash: string } };
    const response = await this.context.post('/api/v1/cms/publishing/publish', { data: { expectedDraftHash: report.data.draftContentHash } });
    if (response.status() === 201) return;
    const body = (await response.json()) as { data?: { code?: string } };
    if (body.data?.code !== 'NOTHING_TO_PUBLISH') throw new Error(`Publish failed with ${String(response.status())} ${body.data?.code ?? ''}`);
  }
}

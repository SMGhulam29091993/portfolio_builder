/**
 * Drives the CMS API as a signed-in user for route tests that need published content
 * (`public-site-rendering`, `publish-pipeline`): sign in, edit, upload and publish through the
 * real routes, never by writing documents.
 */
import request from 'supertest';

import type { ApiApplication } from '../../app.js';
import type { RecordingMailSender } from '../auth/recording-mail-sender.js';
import { SEED_PLACEHOLDER } from '../publishing/publishing-fixtures.js';

export class CmsTestClient {
  private constructor(
    private readonly api: ApiApplication,
    private readonly origin: string,
    /** The session cookies, as one `Cookie` header value. */
    readonly cookie: string,
  ) {}

  /** Signs in with a password (the seeded owner). */
  static async signIn(api: ApiApplication, origin: string, credentials: { email: string; password: string }): Promise<CmsTestClient> {
    const response = await request(api.handler).post('/api/v1/auth/login').set('Origin', origin).send(credentials);
    if (response.status !== 200) throw new Error(`Sign-in failed with ${String(response.status)}`);
    return new CmsTestClient(api, origin, cookiesOf(response.headers['set-cookie']));
  }

  /** Registers and verifies a new account; its portfolio is the template. */
  static async register(api: ApiApplication, origin: string, mail: RecordingMailSender, email: string): Promise<CmsTestClient> {
    const registered = await request(api.handler)
      .post('/api/v1/auth/register')
      .set('Origin', origin)
      .send({ email, password: 'a cms test client password', displayName: 'Test User' });
    const code = /\b(\d{6})\b/.exec(mail.last?.text ?? '')?.[1] ?? '';
    const verified = await request(api.handler)
      .post('/api/v1/auth/register/verify')
      .set('Origin', origin)
      .send({ reference: (registered.body as { data: { reference: string } }).data.reference, otp: code });
    return new CmsTestClient(api, origin, cookiesOf(verified.headers['set-cookie']));
  }

  get(path: string) {
    return request(this.api.handler).get(`/api/v1${path}`).set('Cookie', this.cookie);
  }

  send(method: 'post' | 'put' | 'patch' | 'delete', path: string, body?: object) {
    const call = request(this.api.handler)[method](`/api/v1${path}`).set('Cookie', this.cookie).set('Origin', this.origin);
    return body ? call.send(body) : call;
  }

  /** The portfolio's slug. */
  async slug(): Promise<string> {
    return ((await this.get('/cms/portfolio')).body as { data: { portfolio: { slug: string } } }).data.portfolio.slug;
  }

  /** Applies `edit` to a section's data and saves it. */
  async editSection(type: string, edit: (data: Record<string, unknown>) => void): Promise<void> {
    const draft = (await this.get('/cms/portfolio')).body as { data: { sections: { type: string; revision: number; data: Record<string, unknown> }[] } };
    const section = draft.data.sections.find((candidate) => candidate.type === type);
    if (!section) throw new Error(`No ${type} section`);
    const data = structuredClone(section.data);
    edit(data);
    const saved = await this.send('put', `/cms/portfolio/sections/${type}`, { expectedRevision: section.revision, data });
    if (saved.status !== 200) throw new Error(`Saving ${type} failed with ${String(saved.status)}`);
  }

  /** Replaces the seed's one placeholder so the seeded portfolio can publish. */
  fixSeedPlaceholder(): Promise<void> {
    return this.editSection('work', (data) => {
      const project = (data as { projects: { description: string }[] }).projects[3];
      if (!project) throw new Error('No fourth project');
      project.description = project.description.replace(SEED_PLACEHOLDER, 'A second brain for notes.');
    });
  }

  /** Uploads a file and returns its asset id. */
  async upload(kind: 'resume' | 'image', bytes: Buffer, filename: string): Promise<string> {
    const response = await request(this.api.handler)
      .post('/api/v1/cms/assets')
      .set('Cookie', this.cookie)
      .set('Origin', this.origin)
      .field('kind', kind)
      .attach('file', bytes, { filename, contentType: 'application/octet-stream' });
    return (response.body as { data: { asset: { id: string } } }).data.asset.id;
  }

  /** Sets the identity's résumé (`null` removes it). */
  async setResume(assetId: string | null): Promise<void> {
    const { identity } = ((await this.get('/cms/identity')).body as {
      data: { identity: { revision: number; data: { resume: Record<string, unknown> } } };
    }).data;
    const saved = await this.send('put', '/cms/identity', {
      expectedRevision: identity.revision,
      data: { ...identity.data, resume: { ...identity.data.resume, assetId } },
    });
    if (saved.status !== 200) throw new Error(`Saving the identity failed with ${String(saved.status)}`);
  }

  /** Validates and publishes; returns the response. */
  async publish(): Promise<{ status: number; body: unknown }> {
    const report = (await this.send('post', '/cms/publishing/validate')).body as { data: { draftContentHash: string } };
    return this.send('post', '/cms/publishing/publish', { expectedDraftHash: report.data.draftContentHash });
  }
}

function cookiesOf(header: unknown): string {
  return (header as string[]).map((line) => line.slice(0, line.indexOf(';'))).join('; ');
}

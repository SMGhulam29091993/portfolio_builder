/**
 * `owner-auth.CT10` — shared contract suite for `IUserReader`, `IUserCreator` and
 * `IUserPasswordWriter`, run against `UserRepository` on a real `mongod` and against
 * `InMemoryUserRepository`, the fake the auth services are tested with (`constitution.md` →
 * Liskov Substitution). `IUserPasswordWriter` joined in `owner-auth.T08`, when the fake gained
 * it for `PasswordResetService`. The layout check only MongoDB has (the unique index) stays in
 * `user.repository.spec.ts`.
 */
import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError } from '../../core/errors/index.js';
import {
  InMemoryUserRepository,
  MongoTestHarness,
  NewUserFactory,
} from '../../testing/index.js';
import type { IUserCreator, IUserPasswordWriter, IUserReader } from './auth.interface.js';
import { userModel } from './user.model.js';
import { UserRepository } from './user.repository.js';

type UserPorts = IUserReader & IUserCreator & IUserPasswordWriter;

interface ContractSubject {
  readonly name: string;
  readonly create: () => UserPorts;
}

let mongo: MongoTestHarness;

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  // Wait for the index build, so the duplicate-email case cannot race it.
  await userModel(mongo.connection.getConnection()).init();
});

afterEach(async () => {
  await mongo.reset();
});

afterAll(async () => {
  await mongo.stop();
});

const subjects: readonly ContractSubject[] = [
  { name: 'UserRepository', create: () => new UserRepository(mongo.connection) },
  { name: 'InMemoryUserRepository', create: () => new InMemoryUserRepository() },
];

describe.each(subjects)('owner-auth.CT10 — user repository contract — $name', (subject) => {
  const newUsers = new NewUserFactory();

  it('create() returns the stored user with an id and timestamps', async () => {
    const users = subject.create();
    const input = newUsers.build();

    const created = await users.create(input);

    expect(created).toStrictEqual({
      id: expect.any(String) as string,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      createdAt: expect.any(Date) as Date,
      updatedAt: expect.any(Date) as Date,
    });
    expect(Types.ObjectId.isValid(created.id)).toBe(true);
  });

  it('owner-auth.IT23 — stores the email lower-cased and finds it in any case', async () => {
    const users = subject.create();
    const created = await users.create(newUsers.build({ email: 'Mixed.Case@Example.TEST' }));

    expect(created.email).toBe('mixed.case@example.test');
    await expect(users.findByEmail('MIXED.case@example.test')).resolves.toEqual(created);
  });

  it('findById() returns the created user', async () => {
    const users = subject.create();
    const created = await users.create(newUsers.build());

    await expect(users.findById(created.id)).resolves.toEqual(created);
  });

  it('answers null for an unknown email, an unknown id and a malformed id', async () => {
    const users = subject.create();

    await expect(users.findByEmail('nobody@example.test')).resolves.toBeNull();
    await expect(users.findById(new Types.ObjectId().toString())).resolves.toBeNull();
    await expect(users.findById('not-an-object-id')).resolves.toBeNull();
  });

  it('rejects a second user with the same email, in any case, as USER_EXISTS', async () => {
    const users = subject.create();
    await users.create(newUsers.build({ email: 'owner@example.test' }));

    const duplicate = users.create(newUsers.build({ email: 'OWNER@example.test' }));

    await expect(duplicate).rejects.toBeInstanceOf(ConflictError);
    await expect(duplicate).rejects.toMatchObject({ code: 'USER_EXISTS' });
  });

  it('owner-auth.AC18 — updatePassword() replaces the hash and records when', async () => {
    const users = subject.create();
    const created = await users.create(newUsers.build());
    const changedAt = new Date('2026-10-17T10:00:00.000Z');

    await expect(users.updatePassword(created.id, '$argon2id$new', changedAt)).resolves.toBe(true);

    await expect(users.findById(created.id)).resolves.toMatchObject({
      id: created.id,
      email: created.email,
      passwordHash: '$argon2id$new',
      passwordChangedAt: changedAt,
    });
  });

  it('updatePassword() answers false for an unknown or malformed id', async () => {
    const users = subject.create();
    const changedAt = new Date();

    await expect(
      users.updatePassword(new Types.ObjectId().toString(), '$argon2id$x', changedAt),
    ).resolves.toBe(false);
    await expect(users.updatePassword('nope', '$argon2id$x', changedAt)).resolves.toBe(false);
  });
});

/**
 * Repository tests for `users` against a real `mongod` (`constitution.md` → Per-layer
 * convention: repository tests hit a real datastore).
 */
import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError } from '../../core/errors/index.js';
import { MongoTestHarness, NewUserFactory } from '../../testing/index.js';
import { userModel } from './user.model.js';
import { UserRepository } from './user.repository.js';

let mongo: MongoTestHarness;
let users: UserRepository;
const newUsers = new NewUserFactory();

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  users = new UserRepository(mongo.connection);
  // Wait for the index build, so the unique-email case cannot race it.
  await userModel(mongo.connection.getConnection()).init();
});

afterEach(async () => {
  await mongo.reset();
});

afterAll(async () => {
  await mongo.stop();
});

describe('UserRepository', () => {
  it('owner-auth.AC13 — creates a user and returns it as a plain domain object', async () => {
    const input = newUsers.build();

    const created = await users.create(input);

    expect(created).toEqual({
      id: expect.any(String) as string,
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: 'member',
      createdAt: expect.any(Date) as Date,
      updatedAt: expect.any(Date) as Date,
    });
    expect(Object.keys(created)).not.toContain('_id');
  });

  it('owner-auth.IT23 — stores the email lower-cased and finds it in any case', async () => {
    const created = await users.create(newUsers.build({ email: 'Mixed.Case@Example.TEST' }));

    expect(created.email).toBe('mixed.case@example.test');
    await expect(users.findByEmail('MIXED.case@example.test')).resolves.toEqual(created);
  });

  it('answers null for an unknown email', async () => {
    await expect(users.findByEmail('nobody@example.test')).resolves.toBeNull();
  });

  it('finds by id, and answers null for an unknown or malformed id', async () => {
    const created = await users.create(newUsers.build());

    await expect(users.findById(created.id)).resolves.toEqual(created);
    await expect(users.findById(new Types.ObjectId().toString())).resolves.toBeNull();
    await expect(users.findById('not-an-object-id')).resolves.toBeNull();
  });

  it('rejects a second user with the same email, in any case, as USER_EXISTS', async () => {
    await users.create(newUsers.build({ email: 'owner@example.test' }));

    const duplicate = users.create(newUsers.build({ email: 'OWNER@example.test' }));

    await expect(duplicate).rejects.toBeInstanceOf(ConflictError);
    await expect(duplicate).rejects.toMatchObject({ code: 'USER_EXISTS' });
  });

  it('owner-auth.AC18 — updatePassword() replaces the hash and records when', async () => {
    const created = await users.create(newUsers.build());
    const changedAt = new Date('2026-10-17T10:00:00.000Z');

    await expect(users.updatePassword(created.id, '$argon2id$new', changedAt)).resolves.toBe(true);

    await expect(users.findById(created.id)).resolves.toMatchObject({
      passwordHash: '$argon2id$new',
      passwordChangedAt: changedAt,
    });
  });

  it('updatePassword() answers false for an unknown or malformed id', async () => {
    const changedAt = new Date();

    await expect(
      users.updatePassword(new Types.ObjectId().toString(), '$argon2id$x', changedAt),
    ).resolves.toBe(false);
    await expect(users.updatePassword('nope', '$argon2id$x', changedAt)).resolves.toBe(false);
  });

  it('declares a unique index on email', async () => {
    const indexes = await userModel(mongo.connection.getConnection()).listIndexes();

    expect(indexes).toContainEqual(
      expect.objectContaining({ key: { email: 1 }, unique: true }),
    );
  });
});

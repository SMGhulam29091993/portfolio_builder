/**
 * Public surface of the `auth` module: interfaces and types only
 * (`constitution.md` → Module boundaries). `owner-auth.T05` adds `IAuthGuard` and
 * `AuthContext`, the only things other modules will need.
 */
export type {
  AccessTokenSubject,
  IClock,
  IOtpHasher,
  IOtpReferenceStore,
  IOtpRepository,
  ISessionStore,
  IUserCreator,
  IUserPasswordWriter,
  IUserReader,
  IPasswordHasher,
  ISecureRandom,
  ITokenIssuer,
  VerifyAccessTokenOptions,
} from './auth.interface.js';
export type {
  AccessTokenClaims,
  AuthSession,
  NewUser,
  OtpIssue,
  OtpPurpose,
  OtpRecord,
  User,
} from './auth.types.js';

/**
 * Public surface of the `auth` module: interfaces and types only
 * (`constitution.md` → Module boundaries). `owner-auth.T05` adds `IAuthGuard` and
 * `AuthContext`, the only things other modules will need.
 */
export type {
  AccessTokenSubject,
  AuthorizeOptions,
  IAuthService,
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
  ISessionAuthorizer,
  ITokenIssuer,
  VerifyAccessTokenOptions,
} from './auth.interface.js';
export type {
  AccessTokenClaims,
  AuthorizedSession,
  AuthSession,
  NewUser,
  OtpIssue,
  OtpPurpose,
  OtpRecord,
  SessionCookies,
  SessionCredentials,
  SessionTokens,
  SignedInSession,
  User,
} from './auth.types.js';

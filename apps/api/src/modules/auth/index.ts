/**
 * Public surface of the `auth` module: interfaces and types only
 * (`constitution.md` → Module boundaries). `IAuthGuard` and `AuthContext` (`owner-auth.T05`)
 * are the only things other modules need: a `/cms` router takes the guard from the container
 * and its controller reads `req.auth`.
 */
export type {
  AccessTokenSubject,
  AuthorizeOptions,
  IAuthGuard,
  IAuthService,
  IClock,
  IMailSender,
  IOtpHasher,
  IOtpReferenceStore,
  IOwnerClaimPolicy,
  IOtpRepository,
  IPasswordResetService,
  IRegistrationService,
  ISessionStore,
  IOwnerLookup,
  IUserCreator,
  IUserPasswordWriter,
  IUserRegistrar,
  IUserReader,
  IPasswordHasher,
  ISecureRandom,
  ISessionAuthorizer,
  ISessionCookieWriter,
  ISessionStarter,
  ITokenIssuer,
  VerifyAccessTokenOptions,
} from './auth.interface.js';
export type {
  AccessTokenClaims,
  AuthContext,
  AuthorizedSession,
  AuthSession,
  MailMessage,
  NewUser,
  OtpIssue,
  OtpPurpose,
  OtpRecord,
  PendingUserUpdate,
  SessionCookies,
  SessionCredentials,
  SessionTokens,
  SignedInSession,
  User,
} from './auth.types.js';

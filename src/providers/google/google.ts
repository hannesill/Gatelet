import { google } from 'googleapis';
import type { OAuthConfig } from '../types.js';

export function buildGoogleAuth(credentials: Record<string, unknown>) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({
    access_token: credentials.access_token as string,
    // Omit refresh_token and expiry_date: this client has no client_id/secret,
    // so googleapis' built-in auto-refresh would fail with invalid_request.
    // Token refresh is handled by executeWithRefresh() which has proper credentials.
    token_type: credentials.token_type as string | undefined,
  });
  return auth;
}

export async function refreshGoogleTokens(
  credentials: Record<string, unknown>,
  oauthClientInfo: { clientId: string; clientSecret: string },
): Promise<{
  access_token: string | null | undefined;
  refresh_token: string | null | undefined;
  expiry_date: number | null | undefined;
  token_type: string | null | undefined;
}> {
  const auth = new google.auth.OAuth2(
    oauthClientInfo.clientId,
    oauthClientInfo.clientSecret,
  );
  auth.setCredentials({
    refresh_token: credentials.refresh_token as string,
  });
  const { credentials: newCreds } = await auth.refreshAccessToken();
  return {
    access_token: newCreds.access_token,
    refresh_token: newCreds.refresh_token ?? credentials.refresh_token as string,
    expiry_date: newCreds.expiry_date,
    token_type: newCreds.token_type,
  };
}

export function buildGoogleOAuthConfig(
  scopes: string[],
  discoverAccount: (accessToken: string) => Promise<string>,
): OAuthConfig {
  return {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes,
    // Google "installed app" (Desktop) OAuth — the client secret is not confidential by design.
    // Google's security model relies on redirect URI and user consent, not the secret.
    // See: https://developers.google.com/identity/protocols/oauth2/native-app
    builtinClientId: '1096469986430-ap9lls3vhlu25v87ae3c8i8s3dhgaaiu.apps.googleusercontent.com',
    builtinClientSecret: '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',
    envClientId: 'GOOGLE_CLIENT_ID',
    envClientSecret: 'GOOGLE_CLIENT_SECRET',
    settingsKeyPrefix: 'google',
    extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
    discoverAccount,
  };
}

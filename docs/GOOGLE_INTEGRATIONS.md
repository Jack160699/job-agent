# Google Workspace Integration Lifecycle

## Separation of concerns

- Supabase Auth handles Google sign-in for identity.
- `/api/google/oauth` handles Workspace product scopes (Gmail, Drive, Sheets, Calendar).

## Connection flow

1. User selects desired integrations in Settings before connecting.
2. Signed OAuth state binds the request to the authenticated user.
3. Tokens are encrypted at rest.
4. Refresh tokens are preserved across incremental grants.
5. Granted features are unioned across reconnects.
6. Disconnect locally deletes secrets and attempts provider token revocation.

## Health states

- `disconnected`
- `healthy`
- `missing_refresh_token`
- `expired`
- `error`

When refresh or API access fails with revoked credentials, users should reconnect from Settings.

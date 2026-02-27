---
title: Custom OAuth Apps
description: Register your own Google or Microsoft OAuth app for a seamless sign-in experience
---

Gatelet ships with built-in OAuth credentials that work out of the box but show an "unverified app" warning during sign-in. Registering your own OAuth app removes this warning and gives you full control over the credentials.

## Google (Calendar + Gmail)

### 1. Create an OAuth client

1. Go to the [Google Cloud Console — Credentials](https://console.cloud.google.com/apis/credentials)
2. Create a project (or select an existing one)
3. Click **Create Credentials → OAuth client ID**
4. Set Application type to **Desktop app**
5. Give it a name (e.g. "Gatelet") and click **Create**
6. Copy the **Client ID** and **Client Secret**

:::tip
Choosing the **Desktop app** type is important — it uses the "installed app" OAuth flow, which automatically allows any `http://localhost` redirect URI. No redirect URI configuration is needed.
:::

### 2. Enable APIs

In the same Google Cloud project, enable the APIs for the providers you plan to use:

1. Go to [APIs & Services → Library](https://console.cloud.google.com/apis/library)
2. Search for and enable:
   - **Google Calendar API** — required for the Google Calendar provider
   - **Gmail API** — required for the Gmail provider

### 3. Scopes (reference)

You don't need to configure scopes — Gatelet requests them automatically during the OAuth flow. For reference, the scopes requested are:

**Google Calendar:**
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.events`

**Gmail:**
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.compose`
- `https://www.googleapis.com/auth/gmail.modify`

## Microsoft (Outlook Calendar + Outlook Mail)

### 1. Register an application

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **New registration**
3. Set a name (e.g. "Gatelet")
4. Under **Supported account types**, select **Accounts in any organizational directory and personal Microsoft accounts**
5. Click **Register**
6. Copy the **Application (client) ID** from the overview page

### 2. Configure authentication

1. Go to **Authentication** in the sidebar
2. Click **Add a platform → Mobile and desktop applications**
3. Add the following redirect URI:
   ```
   http://localhost:4001/api/connections/oauth/callback
   ```
   If you changed `GATELET_ADMIN_PORT`, replace `4001` with your custom port. This single URI is shared by all Microsoft providers (Outlook Calendar, Outlook Mail, etc.).
4. Under **Advanced settings**, set **Allow public client flows** to **Yes**
5. Click **Save**

:::tip
Enabling "Allow public client flows" lets Gatelet use PKCE (Proof Key for Code Exchange) instead of a client secret. This is more secure for locally-hosted apps since there's no secret to protect.
:::

### 3. Add API permissions

1. Go to **API permissions** in the sidebar
2. Click **Add a permission → Microsoft Graph → Delegated permissions**
3. Add permissions for the providers you plan to use:

   **Outlook Calendar:**
   - `Calendars.ReadWrite`

   **Outlook Mail:**
   - `Mail.ReadWrite`
   - `Mail.Send`

   **Both providers also need:**
   - `User.Read`
   - `offline_access`

4. Click **Add permissions**

:::note
`MICROSOFT_CLIENT_SECRET` is optional. It's only needed if you register a confidential client instead of a public client. With public client flows enabled (recommended), Gatelet uses PKCE and no secret is required.
:::

## Enter credentials in Gatelet

Once you have your credentials, configure them in Gatelet using either method:

**Dashboard (recommended):** Go to **Settings → Integrations** and enter your Client ID and Client Secret.

**Environment variables:**

| Variable | Provider |
|---|---|
| `GOOGLE_CLIENT_ID` | Google (Calendar + Gmail) |
| `GOOGLE_CLIENT_SECRET` | Google (Calendar + Gmail) |
| `MICROSOFT_CLIENT_ID` | Microsoft (Outlook Calendar + Mail) |
| `MICROSOFT_CLIENT_SECRET` | Microsoft (Outlook Calendar + Mail) — optional |

Dashboard-configured credentials take precedence over environment variables.

After updating credentials, you'll need to re-create existing connections (disconnect and reconnect) since their refresh tokens are tied to the original OAuth client.

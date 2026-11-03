# Connected accounts

Jiko only interrupts when something is due. Connected accounts are where "due" comes from without the user typing it in.

| Provider | How it connects | What becomes an obligation | Source tag |
|---|---|---|---|
| Google Calendar | OAuth ("Connect Google") | every event in the next 30 days on the user's selected calendars, skipping cancelled, declined, working-location and out-of-office blocks | `google_calendar:<integration id>` |
| Gmail | the same OAuth consent | an inbox email whose subject or preview names a commitment (interview, deadline, exam, appointment...) **and** has a readable date | `gmail:<integration id>` |
| Canvas | a personal access token the user pastes | planner items (assignments, quizzes, discussions, course events) in the next 30 days; submitted, excused or marked-done work is closed, not nudged about | `canvas:<integration id>` |
| Any other calendar | an ICS link (`POST /calendars`) | events in the feed | `ics:<subscription id>` |

Users connect from the web setup page (`/setup`), the Mac onboarding step, or Settings on Mac and iPhone. All three use the same API:

```
GET    /integrations                    status + what this server can connect
POST   /integrations/google/start       { return: 'setup' | 'app' } -> { url }  (open it in a browser)
GET    /integrations/google/callback    Google redirects here; stores the account, starts the first sync
POST   /integrations/canvas             { base_url, token }  verifies, stores, syncs
POST   /integrations/:provider/sync     sync now
DELETE /integrations/:provider          disconnect (Google: also revokes); imported obligations stay
```

## How a sync works

`src/services/integrations/index.ts` `syncIntegration()`: unseal the credential, fetch, map to obligations, `ObligationRepository.upsertExternal()` keyed on `(source, external_ref)` so a re-sync updates in place. It runs right after connecting, on demand, and from the scheduler sweep every `refresh_minutes` (Google 30, Canvas 60). It never throws; the outcome lands on the row (`last_status`, `last_error`, counts).

- **Google tokens.** The refresh token is sealed in `secret_enc`; a short-lived access token is cached sealed in `access_token_enc`. A refresh that comes back `invalid_grant` (revoked, password changed, or the 7-day testing limit below) marks the row `needs_reauth`. The sweep then skips it and the apps show **Reconnect**.
- **Gmail.** Metadata only: subject, sender, and Gmail's one-line snippet. Bodies are never requested or stored. The first sync looks back 7 days; after that `cursor.gmail_after` holds the newest message time seen. Promotions, social and forums are excluded in the Gmail query, and mail from Google Calendar or Canvas is skipped because those are read directly. Rules live in `gmailExtract.ts`. They lean towards missing an email rather than nudging about a newsletter.
- **Canvas.** `GET /api/v1/planner/items`, following `Link: rel="next"` on the same host only. An item that later shows as submitted closes the matching obligation; an unsubmitted item never reopens one the user closed.

Credentials are sealed with AES-256-GCM under `JIKO_TOKEN_KEY` (`src/lib/secretBox.ts`). The key is not in the database, so a dump or backup alone does not give anyone's mailbox away. Nothing secret is ever returned by the API.

## Setting up Google (once per server)

Gmail read access is a **restricted** Google scope. Until the app passes Google's verification (a paid security assessment), it stays in **Testing**, which means:

- only Google accounts listed as **test users** can connect (up to 100);
- they see a "Google hasn't verified this app" screen and click **Continue**;
- **refresh tokens expire after 7 days**, so each person reconnects Google once a week. Jiko marks the account "needs reconnecting" when that happens.

That is fine for a two-person trial. Steps (Google Cloud console, November 2026 layout):

1. Go to <https://console.cloud.google.com/>, create a project named **Jiko**.
2. **APIs & Services → Library**: enable **Gmail API** and **Google Calendar API**.
3. **Google Auth Platform → Branding**: app name *Jiko*, your email as support and developer contact. Save.
4. **Audience**: user type **External**, publishing status **Testing**. Under **Test users**, add your Gmail address and your friend's.
5. **Data Access → Add or remove scopes**: add `.../auth/gmail.readonly` and `.../auth/calendar.readonly` (plus `openid` and `email`, usually pre-ticked). Save.
6. **Clients → Create client**: type **Web application**, name *Jiko server*. Under **Authorized redirect URIs**, add exactly
   `https://64-181-196-147.sslip.io/integrations/google/callback`
   (it must match `JIKO_PUBLIC_URL` + `/integrations/google/callback`). Create, then copy the **Client ID** and **Client secret**.
7. On the server, add to `/opt/jiko/jiko.env`:
   ```
   JIKO_TOKEN_KEY=<output of: openssl rand -hex 32>
   JIKO_PUBLIC_URL=https://64-181-196-147.sslip.io
   GOOGLE_CLIENT_ID=<client id>
   GOOGLE_CLIENT_SECRET=<client secret>
   ```
   then deploy (the deploy script applies migration `0005_integrations.sql` and restarts). `GET /integrations` reports `available.google: true` once all four are set.

**Keep `JIKO_TOKEN_KEY` stable and separate from backups.** Changing or losing it does not break anything else, but every connected account then fails to unseal and has to be reconnected.

If Google refuses the redirect URI or asks for an authorized domain, the `sslip.io` hostname is the problem: point a real domain at the box, change the one line in `/etc/caddy/Caddyfile` and `JIKO_PUBLIC_URL`, and use that domain in step 6.

## Canvas

No server setup. Each user creates a token in Canvas (**Account → Settings → Approved Integrations → + New Access Token**) and pastes it with their school's Canvas address. Some schools disable personal tokens; those users can add their Canvas **calendar feed** as an "another calendar" ICS link instead. That works, but it cannot tell submitted work from unsubmitted.

## Not done yet

- Gmail extraction is rules, not a model. An optional Claude pass over candidate emails (subject + snippet only) would read dates and commitments better; it is deliberately left for after the field notes show what the rules miss.
- Outlook / Microsoft 365 mail and calendar.
- No notification when Google needs reconnecting beyond the status in the apps and on `/setup`.

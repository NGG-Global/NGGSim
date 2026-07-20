# Supabase Edge Functions

Server-side functions for the voice integration. The ElevenLabs API key lives
here as a secret and is never exposed to the browser.

## Deploy (dashboard, no CLI required)

Supabase Dashboard → **Edge Functions** → **Deploy a new function** → **Via Editor**.
Name the function to match its folder, paste the contents of `index.ts`, and
**Deploy**. This repo is the source of truth; the dashboard editor is only the
deploy surface (it has no version history).

## Secrets

Set under Dashboard → **Edge Functions** → **Secrets**:

| Secret | Purpose |
|---|---|
| `ELEVENLABS_API_KEY` | ElevenLabs key, ElevenAgents **Read** scope. Server-side only. |
| `ELEVENLABS_AGENT_ID` | The base agent id (`agent_…`). |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically — do not add them.

## Functions

- `elevenlabs-signed-url` — validates a participant session capability and returns
  a short-lived ElevenLabs signed WebSocket URL. (Milestone 1.)

Planned next:
- `elevenlabs-conversation-init` — server-side conversation initiation webhook that
  returns the per-simulation character as overrides (keeps hidden info off the browser).
- `elevenlabs-postcall` — verified post-call webhook that stores the transcript/report.

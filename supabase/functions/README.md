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
| `ELEVENLABS_API_KEY` | ElevenLabs key, ElevenAgents **Read + Write** scope (write is required to mint a signed URL). Server-side only. |
| `ELEVENLABS_AGENT_ID` | The base agent id (`agent_…`). |
| `ELEVENLABS_VOICE_MALE` | Optional. ElevenLabs voice id used when the character's voice is male. |
| `ELEVENLABS_VOICE_FEMALE` | Optional. ElevenLabs voice id used when the character's voice is female. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do not add them. The service-role key is used only to read the full simulation server-side when building the character overrides.

## Functions

- `elevenlabs-signed-url` — validates a participant session capability and returns
  a short-lived ElevenLabs signed WebSocket URL. (Milestone 1.)

Planned next:
- `elevenlabs-conversation-init` — server-side conversation initiation webhook that
  returns the per-simulation character as overrides (keeps hidden info off the browser).
- `elevenlabs-postcall` — verified post-call webhook that stores the transcript/report.

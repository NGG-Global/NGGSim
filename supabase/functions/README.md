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

- `elevenlabs-signed-url` — validates a participant session capability, builds the
  per-simulation character overrides (service role), and returns a short-lived ElevenLabs
  call credential. "Verify JWT" OFF.

  The credential is a WebRTC `conversationToken` (`GET /v1/convai/conversation/token`)
  whenever ElevenLabs can mint one, and a signed WebSocket URL only as a fallback: the
  WebSocket transport has no reconnection logic in the SDK, so a participant whose network
  blinks is left with a call that cannot recover. Both transports send the same initiation
  payload, so the overrides and the `ngg_session_id` variable apply either way. See
  `docs/voice-call-reliability.md`.

  The system prompt opens and closes with a naming rule: the character's name is bound
  explicitly to the character ("this is your own name, never the participant's"), and the
  participant's first name — taken from the `fullName` participant field when the
  simulation collects it — is given as the only name the character may use for the
  person in front of it. When no name is collected, the character is told to address the
  participant without any name rather than reach for one. Only the first word of the
  typed name reaches the prompt, and only when it is shaped like a name, so a sentence
  typed into that field cannot ride into the system prompt.

  The prompt also carries a silence policy: wait quietly, at most one short check-in
  sentence, never repeat it, never hold a conversation alone. Without it the model fills
  dead air with "can you hear me?" and the repetition feeds itself, which reads as a stuck
  agent even when the real fault is a dropped socket or a suspended microphone.
- `elevenlabs-postcall` — post-call webhook. Verifies the ElevenLabs signature,
  matches the analysis to our session via the `ngg_session_id` dynamic variable, and
  stores the report. "Verify JWT" OFF. Extra secret: `ELEVENLABS_WEBHOOK_SECRET`.

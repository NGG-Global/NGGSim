// Supabase Edge Function: elevenlabs-signed-url
//
// Returns a short-lived ElevenLabs signed WebSocket URL for a VALID participant
// session. The ElevenLabs API key stays server-side and is never sent to the
// browser. Access is gated on the per-session capability the browser already
// holds (the accessToken minted by start_public_simulation_session), so an
// anonymous caller cannot burn ElevenLabs credits.
//
// Milestone 1: this returns the signed URL for the base agent only. The per-
// simulation character is injected later, server-side, by the conversation
// initiation webhook — never through the browser.
//
// Deploy: Supabase Dashboard -> Edge Functions -> Deploy a new function -> Via Editor.
// Secrets required (Dashboard -> Edge Functions -> Secrets):
//   ELEVENLABS_API_KEY   (secret; ElevenAgents Read key)
//   ELEVENLABS_AGENT_ID  (e.g. agent_...)
// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically by Supabase.

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*', // participant page is protected by the session capability, not by origin
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
  const ELEVENLABS_AGENT_ID = Deno.env.get('ELEVENLABS_AGENT_ID')
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
    return json({ error: 'server_not_configured' }, 500)
  }

  let payload: { sessionId?: string; accessToken?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const sessionId = (payload.sessionId ?? '').trim()
  const accessToken = (payload.accessToken ?? '').trim()
  if (!sessionId || !/^[a-f0-9]{64}$/.test(accessToken)) {
    return json({ error: 'invalid_session' }, 400)
  }

  // Validate the participant's session capability via the existing public RPC.
  // Returns the session row when the capability matches, otherwise null.
  const rpcResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_simulation_session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_session_id: sessionId, p_access_token: accessToken }),
  })
  if (!rpcResponse.ok) return json({ error: 'session_check_failed' }, 502)
  const session = await rpcResponse.json()
  if (!session) return json({ error: 'invalid_session' }, 403)

  // Ask ElevenLabs for a short-lived signed URL for the base agent.
  const signedResponse = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(ELEVENLABS_AGENT_ID)}`,
    { headers: { 'xi-api-key': ELEVENLABS_API_KEY } },
  )
  if (!signedResponse.ok) return json({ error: 'provider_error' }, 502)

  const data = await signedResponse.json().catch(() => null)
  const signedUrl = data && typeof data.signed_url === 'string' ? data.signed_url : null
  if (!signedUrl) return json({ error: 'provider_error' }, 502)

  return json({ signedUrl })
})

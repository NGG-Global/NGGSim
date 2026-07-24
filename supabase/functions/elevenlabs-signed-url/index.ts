// Supabase Edge Function: elevenlabs-signed-url
//
// Validates a participant session capability, then returns:
//   - a short-lived ElevenLabs signed WebSocket URL for the base agent, and
//   - `overrides` that turn the base agent into THIS simulation's character
//     (system prompt, first message, language, voice), built server-side.
//
// The ElevenLabs API key and the full simulation (incl. hidden info) stay on the
// server; only the built overrides are returned to the authorized participant.
//
// Secrets (Dashboard -> Edge Functions -> Secrets):
//   ELEVENLABS_API_KEY     (ElevenAgents Read + Write)
//   ELEVENLABS_AGENT_ID    (agent_...)
//   ELEVENLABS_VOICE_MALE   (optional ElevenLabs voice id for male characters)
//   ELEVENLABS_VOICE_FEMALE (optional ElevenLabs voice id for female characters)
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are injected automatically.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function line(label, value) {
  const v = text(value);
  return v ? `${label}: ${v}` : '';
}

// Build the Hebrew system prompt for the character from the full simulation.
function buildSystemPrompt(sim) {
  const c = sim.character ?? {};
  const s = sim.scenario ?? {};
  const b = sim.behavior ?? {};
  const f = sim.facilitator_configuration ?? {};
  const traits = Array.isArray(c.personalityTraits) ? c.personalityTraits.filter(Boolean).join(', ') : '';

  const parts = [
    'אתה מגלם דמות בסימולציית אימון בשפה העברית. דבר עברית בלבד, בגוף ראשון, והישאר תמיד בדמות. אל תגלה שאתה בינה מלאכותית. שמור על תגובות טבעיות, קצרות וזורמות כמו בשיחה מדוברת.',
    '',
    'הדמות שאתה מגלם:',
    line('שם', c.name),
    line('תפקיד', c.role),
    line('הקשר למשתתף', c.relationToParticipant),
    line('מצב רגשי בתחילת השיחה', c.initialEmotionalState),
    line('מאפייני אישיות', traits),
    line('מניעים', c.motivations),
    line('אינטרסים', c.interests),
    line('התנגדויות מרכזיות', c.objections),
    line('רגישויות', c.sensitivities),
    line('סגנון דיבור', c.speakingStyle),
    line('התנהגויות שיש להימנע מהן', c.avoidedBehaviors),
    '',
    'הסיטואציה:',
    line('סוג השיחה', s.conversationType),
    line('רקע', s.description),
    line('מה קרה לפני השיחה', s.priorEvents),
    '',
    line('מידע שאתה מוכן לחשוף בחופשיות', c.freelySharedInfo),
    line('מידע שתחשוף רק אם נוצרים התנאים המתאימים', c.conditionalInfo),
    line('מידע רגיש שאתה יודע אך אינך חושף ביוזמתך (חשוף רק אם נבנה אמון או נשאלת שאלה מתאימה, ולעולם לא באופן ישיר בתחילת השיחה)', s.hiddenInfo),
    '',
    'אופן ההתנהגות:',
    line('רמת קושי', b.difficulty),
    line('מידת התנגדות', b.resistance),
    b.canCalmDown ? 'אתה יכול להירגע במהלך השיחה אם המשתתף מגיב באמפתיה ובהקשבה.' : '',
    line('מה גורם לך להיפתח', b.openingTriggers),
    line('מה גורם להסלמה מצדך', b.escalationTriggers),
    line('סימנים לכך שהשיחה מתקדמת היטב ואתה יכול לרכך את עמדתך', b.successConditions),
    line('סימנים לכך שהשיחה אינה מתקדמת ואתה נעשה נוקשה יותר', b.failureConditions),
    line('כיצד השיחה יכולה להסתיים באופן טבעי', b.endingConditions),
    '',
    line('הנחיות נוספות מהמנחה', f.futureAgentPrompt),
  ];

  return parts.filter((p) => p !== '').join('\n');
}

function pickVoiceId(sim) {
  const gender = sim.character && sim.character.voiceGender === 'male' ? 'male' : 'female';
  const male = text(Deno.env.get('ELEVENLABS_VOICE_MALE'));
  const female = text(Deno.env.get('ELEVENLABS_VOICE_FEMALE'));
  return gender === 'male' ? male : female;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  const ELEVENLABS_AGENT_ID = Deno.env.get('ELEVENLABS_AGENT_ID');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
    return json({ error: 'server_not_configured' }, 500);
  }

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'invalid_body' }, 400); }
  const sessionId = (payload.sessionId ?? '').trim();
  const accessToken = (payload.accessToken ?? '').trim();
  if (!sessionId || !/^[a-f0-9]{64}$/.test(accessToken)) return json({ error: 'invalid_session' }, 400);

  // 1) Validate the participant session capability.
  const rpcResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_simulation_session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ p_session_id: sessionId, p_access_token: accessToken }),
  });
  if (!rpcResponse.ok) {
    const body = await rpcResponse.text().catch(() => '');
    console.error('session check RPC failed', rpcResponse.status, body.slice(0, 300));
    return json({ error: 'session_check_failed', detail: rpcResponse.status }, 502);
  }
  const session = await rpcResponse.json();
  if (!session || !session.simulation_id) return json({ error: 'invalid_session' }, 403);

  // 2) Build the character overrides from the full simulation (service role).
  let overrides;
  if (SERVICE_ROLE) {
    try {
      const simResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/simulations?id=eq.${session.simulation_id}&select=character,scenario,behavior,facilitator_configuration&limit=1`,
        { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
      );
      if (simResponse.ok) {
        const rows = await simResponse.json();
        const sim = Array.isArray(rows) ? rows[0] : null;
        if (sim) {
          const agent = { prompt: { prompt: buildSystemPrompt(sim) }, language: 'he' };
          const opening = sim.behavior && text(sim.behavior.openingLine);
          if (opening) agent.firstMessage = opening;
          overrides = { agent };
          const voiceId = pickVoiceId(sim);
          if (voiceId) overrides.tts = { voiceId };
        }
      } else {
        console.error('simulation fetch failed', simResponse.status);
      }
    } catch (buildError) {
      console.error('override build failed', String(buildError));
    }
  }

  // 3) Ask ElevenLabs for a short-lived signed URL for the base agent.
  const signedResponse = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(ELEVENLABS_AGENT_ID)}`,
    { headers: { 'xi-api-key': ELEVENLABS_API_KEY } },
  );
  if (!signedResponse.ok) {
    const body = await signedResponse.text().catch(() => '');
    console.error('ElevenLabs get-signed-url failed', signedResponse.status, body.slice(0, 500));
    return json({ error: 'provider_error', detail: signedResponse.status }, 502);
  }
  const data = await signedResponse.json().catch(() => null);
  const signedUrl = data && typeof data.signed_url === 'string' ? data.signed_url : null;
  if (!signedUrl) { console.error('ElevenLabs response missing signed_url'); return json({ error: 'provider_error', detail: 'no_signed_url' }, 502); }

  return json({ signedUrl, overrides });
});

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
//   ELEVENLABS_VOICE_MALE   (ElevenLabs voice id for male characters)
//   ELEVENLABS_VOICE_FEMALE (ElevenLabs voice id for female characters)
// Both voice ids are technically optional, but with either one missing that gender
// falls back to the base agent's voice and the distinction becomes inaudible.
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

// Returns null (not '') when there is no value, so that buildSystemPrompt can drop
// empty labels while keeping the intentional '' entries as blank separator lines.
function line(label, value) {
  const v = text(value);
  return v ? `${label}: ${v}` : null;
}

function firstName(value) {
  const v = text(value);
  return v ? v.split(/\s+/)[0] : '';
}

// The participant types this value into a public form, so it is untrusted text that
// would otherwise land inside the system prompt. Only the first name is used — a single
// short word cannot carry a smuggled instruction — and anything that is not shaped like
// a name is dropped, in which case the character is told it does not know the name.
const NAME_SHAPE = /^[\u0590-\u05FFa-zA-Z][\u0590-\u05FFa-zA-Z'\u05F3\u2019-]{0,23}$/;

function participantFirstName(value) {
  const candidate = firstName(value).replace(/[.,:;!?]+$/, '');
  return NAME_SHAPE.test(candidate) ? candidate : '';
}

// The character's own name is the only proper noun the model is handed, so whenever it
// reaches for a way to address the person in front of it, that name is the nearest thing
// available — which is exactly how a simulation ends up calling the participant by the
// character's name. Two things prevent it: the name is bound explicitly to the character
// ("this is YOUR name, not theirs"), and the participant's own first name is supplied as
// the only legitimate alternative. The rule is stated in first position, before the
// character details, and restated as the closing line of the prompt.
function namingLines(own, guest, pack) {
  const name = text(own);
  const first = firstName(name);
  return [
    'שמות בשיחה — הנחיה מחייבת שאין לחרוג ממנה:',
    name ? pack.ownName(name, first) : pack.noOwnName,
    guest ? pack.guestName(guest) : pack.noGuestName,
    pack.introduced,
    pack.otherNames,
  ].join('\n');
}

// `character.voiceGender` is the single switch that makes a character male or female,
// and it drives TWO things, not one:
//   1) the TTS voice id (see pickVoiceId), and
//   2) the grammatical gender of this entire prompt (see VOICE_PACKS).
// Hebrew marks gender on verbs, participles, adjectives and pronouns. A model that is
// addressed throughout in masculine forms ("אתה מגלם", "דבר", "אתה יודע") drifts into
// masculine self-reference even when the character is a woman. So every fixed sentence
// and every label is conjugated to the character's own gender, and the agreement rule
// is stated explicitly at the top of the prompt and restated at the end.
const VOICE_PACKS = {
  male: {
    intro:
      'אתה מגלם דמות בסימולציית אימון בשפה העברית. דבר עברית בלבד, בגוף ראשון, והישאר תמיד בדמות. אל תגלה שאתה בינה מלאכותית. שמור על תגובות טבעיות, קצרות וזורמות כמו בשיחה מדוברת.',
    genderRule: [
      'התאם דקדוקי — הנחיה מחייבת שאין לחרוג ממנה:',
      'הדמות שאתה מגלם היא גבר. דבר על עצמך תמיד בלשון זכר, בכל משפט ובכל זמן.',
      'השתמש בצורות זכר בכל התייחסות לעצמך: "אני חושב", "אני מרגיש", "אני יודע", "אני מבין", "אני לא מסכים", "אני מתוסכל", "אני בטוח", "הייתי צריך", "אני עושה", "אני מנסה".',
      'לעולם אל תשתמש בצורת נקבה כשאתה מדבר על עצמך.',
      'אם נסחפת בטעות לצורת נקבה, המשך מיד בצורת זכר. אל תתקן את עצמך בקול ואל תתייחס לכך.',
    ].join('\n'),
    characterHeader: 'הדמות שאתה מגלם:',
    freelySharedLabel: 'מידע שאתה מוכן לחשוף בחופשיות',
    conditionalLabel: 'מידע שתחשוף רק אם נוצרים התנאים המתאימים',
    hiddenLabel:
      'מידע רגיש שאתה יודע אך אינך חושף ביוזמתך (חשוף רק אם נבנה אמון או נשאלת שאלה מתאימה, ולעולם לא באופן ישיר בתחילת השיחה)',
    calmDown: 'אתה יכול להירגע במהלך השיחה אם המשתתף מגיב באמפתיה ובהקשבה.',
    successLabel: 'סימנים לכך שהשיחה מתקדמת היטב ואתה יכול לרכך את עמדתך',
    failureLabel: 'סימנים לכך שהשיחה אינה מתקדמת ואתה נעשה נוקשה יותר',
    addressing: [
      'פנייה למשתתף:',
      'אינך יודע אם המשתתף שמולך גבר או אישה, ואין להניח זאת. עד שהדבר מתברר מהשיחה עצמה, העדף פנייה ישירה וניטרלית.',
      'אם במהלך השיחה מתברר באיזו לשון המשתתף מדבר על עצמו, התאם את הפנייה אליו בהתאם.',
      'שדות ההנחיה שלהלן נכתבו עבור מנחה ולכן הם כוללים צורות עם לוכסן כמו "מנהל/ת" או "יודע/ת". אלה הנחיות בלבד ולא נוסח לדיבור. אל תקרא צורות כאלה בקול ואל תשתמש בהן בשיחה — בחר תמיד צורה אחת טבעית.',
    ].join('\n'),
    genderReminder: 'זכור לאורך כל השיחה: אתה גבר ומדבר על עצמך בלשון זכר בלבד.',
    naming: (own, guest) => namingLines(own, guest, {
      ownName: (name, first) => `"${name}" הוא שמך שלך, שם הדמות שאתה מגלם, ואתה מציג את עצמך בשם הזה.`
        + ` לעולם אל תפנה למשתתף בשם "${first}" ואל תשתמש בו כדי לתאר אותו — זה שמך, לא שמו.`,
      noOwnName: 'לדמות שאתה מגלם אין שם מוגדר. אל תמציא לעצמך שם.',
      guestName: (name) => `שם המשתתף שמולך הוא "${name}". זה השם היחיד שבו מותר לך לפנות אליו.`,
      noGuestName: 'שם המשתתף אינו ידוע לך. אל תמציא לו שם ואל תפנה אליו בשם כלשהו — פנה אליו ישירות, בלי שם.',
      introduced: 'אם המשתתף מציג את עצמו בשם, השתמש מכאן והלאה בשם שהוא אמר.',
      otherNames: 'כל שם נוסף שמופיע בהנחיות שלהלן שייך לך או לאדם שאינו נוכח בשיחה, ולא למשתתף.',
    }),
    nameReminder: (own, guest) => {
      const first = firstName(own);
      if (!first) return null;
      return `זכור: "${first}" הוא שמך שלך. ` + (guest ? `שם המשתתף הוא "${guest}".` : 'אל תפנה למשתתף בשם.');
    },
  },
  female: {
    intro:
      'את מגלמת דמות בסימולציית אימון בשפה העברית. דברי עברית בלבד, בגוף ראשון, והישארי תמיד בדמות. אל תגלי שאת בינה מלאכותית. שמרי על תגובות טבעיות, קצרות וזורמות כמו בשיחה מדוברת.',
    genderRule: [
      'התאם דקדוקי — הנחיה מחייבת שאין לחרוג ממנה:',
      'הדמות שאת מגלמת היא אישה. דברי על עצמך תמיד בלשון נקבה, בכל משפט ובכל זמן.',
      'השתמשי בצורות נקבה בכל התייחסות לעצמך: "אני חושבת", "אני מרגישה", "אני יודעת", "אני מבינה", "אני לא מסכימה", "אני מתוסכלת", "אני בטוחה", "הייתי צריכה", "אני עושה", "אני מנסה".',
      'לעולם אל תשתמשי בצורת זכר כשאת מדברת על עצמך.',
      'אם נסחפת בטעות לצורת זכר, המשיכי מיד בצורת נקבה. אל תתקני את עצמך בקול ואל תתייחסי לכך.',
    ].join('\n'),
    characterHeader: 'הדמות שאת מגלמת:',
    freelySharedLabel: 'מידע שאת מוכנה לחשוף בחופשיות',
    conditionalLabel: 'מידע שתחשפי רק אם נוצרים התנאים המתאימים',
    hiddenLabel:
      'מידע רגיש שאת יודעת אך אינך חושפת ביוזמתך (חשפי רק אם נבנה אמון או נשאלת שאלה מתאימה, ולעולם לא באופן ישיר בתחילת השיחה)',
    calmDown: 'את יכולה להירגע במהלך השיחה אם המשתתף מגיב באמפתיה ובהקשבה.',
    successLabel: 'סימנים לכך שהשיחה מתקדמת היטב ואת יכולה לרכך את עמדתך',
    failureLabel: 'סימנים לכך שהשיחה אינה מתקדמת ואת נעשית נוקשה יותר',
    // The character speaks about itself in its own gender, but it does NOT know the
    // participant's gender, and the facilitator's fields are written with slash forms
    // ("מנהל/ת", "יודע/ת") that must never be voiced as written.
    addressing: [
      'פנייה למשתתף:',
      'אינך יודעת אם המשתתף שמולך גבר או אישה, ואין להניח זאת. עד שהדבר מתברר מהשיחה עצמה, העדיפי פנייה ישירה וניטרלית.',
      'אם במהלך השיחה מתברר באיזו לשון המשתתף מדבר על עצמו, התאימי את הפנייה אליו בהתאם.',
      'שדות ההנחיה שלהלן נכתבו עבור מנחה ולכן הם כוללים צורות עם לוכסן כמו "מנהל/ת" או "יודע/ת". אלה הנחיות בלבד ולא נוסח לדיבור. אל תקראי צורות כאלה בקול ואל תשתמשי בהן בשיחה — בחרי תמיד צורה אחת טבעית.',
    ].join('\n'),
    genderReminder: 'זכרי לאורך כל השיחה: את אישה ומדברת על עצמך בלשון נקבה בלבד.',
    naming: (own, guest) => namingLines(own, guest, {
      ownName: (name, first) => `"${name}" הוא שמך שלך, שם הדמות שאת מגלמת, ואת מציגה את עצמך בשם הזה.`
        + ` לעולם אל תפני למשתתף בשם "${first}" ואל תשתמשי בו כדי לתאר אותו — זה שמך, לא שמו.`,
      noOwnName: 'לדמות שאת מגלמת אין שם מוגדר. אל תמציאי לעצמך שם.',
      guestName: (name) => `שם המשתתף שמולך הוא "${name}". זה השם היחיד שבו מותר לך לפנות אליו.`,
      noGuestName: 'שם המשתתף אינו ידוע לך. אל תמציאי לו שם ואל תפני אליו בשם כלשהו — פני אליו ישירות, בלי שם.',
      introduced: 'אם המשתתף מציג את עצמו בשם, השתמשי מכאן והלאה בשם שהוא אמר.',
      otherNames: 'כל שם נוסף שמופיע בהנחיות שלהלן שייך לך או לאדם שאינו נוכח בשיחה, ולא למשתתף.',
    }),
    nameReminder: (own, guest) => {
      const first = firstName(own);
      if (!first) return null;
      return `זכרי: "${first}" הוא שמך שלך. ` + (guest ? `שם המשתתף הוא "${guest}".` : 'אל תפני למשתתף בשם.');
    },
  },
};

function voicePack(sim) {
  return sim.character && sim.character.voiceGender === 'male' ? VOICE_PACKS.male : VOICE_PACKS.female;
}

// Build the Hebrew system prompt for the character from the full simulation.
// `participantName` is the name the participant typed on the landing page (may be empty
// for an anonymous simulation); only its sanitized first name reaches the prompt.
function buildSystemPrompt(sim, participantName) {
  const c = sim.character ?? {};
  const s = sim.scenario ?? {};
  const b = sim.behavior ?? {};
  const f = sim.facilitator_configuration ?? {};
  const g = voicePack(sim);
  const traits = Array.isArray(c.personalityTraits) ? c.personalityTraits.filter(Boolean).join(', ') : '';
  const guest = participantFirstName(participantName);

  const parts = [
    g.intro,
    '',
    g.naming(c.name, guest),
    '',
    g.genderRule,
    '',
    g.addressing,
    '',
    g.characterHeader,
    line('שמך', c.name),
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
    line(g.freelySharedLabel, c.freelySharedInfo),
    line(g.conditionalLabel, c.conditionalInfo),
    line(g.hiddenLabel, s.hiddenInfo),
    '',
    'אופן ההתנהגות:',
    line('רמת קושי', b.difficulty),
    line('מידת התנגדות', b.resistance),
    b.canCalmDown ? g.calmDown : null,
    line('מה גורם לך להיפתח', b.openingTriggers),
    line('מה גורם להסלמה מצדך', b.escalationTriggers),
    line(g.successLabel, b.successConditions),
    line(g.failureLabel, b.failureConditions),
    line('כיצד השיחה יכולה להסתיים באופן טבעי', b.endingConditions),
    '',
    line('הנחיות נוספות מהמנחה', f.futureAgentPrompt),
    '',
    g.genderReminder,
    g.nameReminder(c.name, guest),
  ];

  // Drop empty labels, keep the '' separators, and collapse the runs of blank lines
  // that appear when a whole section was left unfilled.
  return parts.filter((p) => p !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Without both secrets configured, every character falls back to the base agent's
// voice and the male/female distinction becomes inaudible — so log the gap loudly.
function pickVoiceId(sim) {
  const gender = sim.character && sim.character.voiceGender === 'male' ? 'male' : 'female';
  const male = text(Deno.env.get('ELEVENLABS_VOICE_MALE'));
  const female = text(Deno.env.get('ELEVENLABS_VOICE_FEMALE'));
  const voiceId = gender === 'male' ? male : female;
  if (!voiceId) {
    console.warn(`no voice id configured for ${gender} character; falling back to the base agent voice`);
  }
  return voiceId;
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
          // `details` is keyed by participant-field type; `fullName` is absent when the
          // simulation collects no name, and the prompt then tells the character so.
          const participantName = session.participant && session.participant.details
            ? session.participant.details.fullName
            : '';
          const agent = { prompt: { prompt: buildSystemPrompt(sim, participantName) }, language: 'he' };
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

// Exported for unit tests; the Edge Function entry point is the Deno.serve handler above.
export { buildSystemPrompt, participantFirstName };

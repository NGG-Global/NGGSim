import { createBlankSimulation } from './defaults'
import type { Simulation, SimulationReport, SimulationSession } from '../types/simulation'

export const DEMO_PUBLISHED_TOKEN = 'demo-feedback-7b3e91'

export function createDemoSimulations(): Simulation[] {
  const published = createBlankSimulation('sim-demo-feedback')
  published.title = 'שיחת משוב עם עובד מתנגד'
  published.status = 'published'
  published.publicToken = DEMO_PUBLISHED_TOKEN
  published.publishedAt = '2026-07-14T08:30:00.000Z'
  published.updatedAt = '2026-07-14T08:30:00.000Z'
  published.attemptCount = 3
  published.shareLink = {
    token: DEMO_PUBLISHED_TOKEN,
    url: `http://localhost:5173/simulation/${DEMO_PUBLISHED_TOKEN}`,
    createdAt: published.publishedAt,
    isActive: true,
  }
  published.organization = {
    clientName: 'אופק טכנולוגיות',
    programName: 'מנהלים מצמיחים 2026',
    audience: 'מנהלי צוותים חדשים',
    context: 'הארגון מטמיע שגרת משוב רבעונית ומבקש לתרגל שיחות מורכבות בגישה עניינית ואמפתית.',
    showOrganizationToParticipant: true,
  }
  published.scenario = {
    conversationType: 'שיחת משוב',
    description: 'נועם, איש צוות מנוסה, דוחה משימות תיעוד ומגיב בהתגוננות למשוב בנושא.',
    priorEvents: 'שתי משימות תיעוד הוגשו באיחור בחודש האחרון, ונשלחה תזכורת כללית לצוות.',
    participantGoal: 'להציג את הפער באופן ברור, להבין את נקודת המבט של נועם ולהסכים על צעד המשך מדיד.',
    participantKnownInfo: 'נועם מקצועי ומוערך, אך עומס העבודה שלו גדל לאחרונה.',
    hiddenInfo: 'נועם מטפל בהורה חולה ואינו רוצה לשתף בכך מיוזמתו. אין לחשוף מידע זה למשתתף.',
  }
  published.character = {
    name: 'נועם לוי',
    role: 'מפתח בכיר',
    relationToParticipant: 'עובד ישיר בצוות',
    personalityTraits: ['ענייני', 'מתגונן', 'ישיר'],
    initialEmotionalState: 'דרוך וחושש מביקורת לא הוגנת',
    interests: 'לשמור על עצמאות מקצועית ועל ההערכה כלפיו',
    motivations: 'להצליח בעבודה בלי לחשוף את הקושי האישי',
    objections: 'הטענה שהתיעוד חשוב יותר מאיכות הפיתוח',
    sensitivities: 'השוואה לעובדים אחרים והטלת ספק במחויבות שלו',
    freelySharedInfo: 'העומס בצוות עלה ושעות העבודה ארוכות',
    conditionalInfo: 'אם תישאל שאלה פתוחה ותיווצר תחושת ביטחון, ישתף בקושי משפחתי כללי.',
    speakingStyle: 'קצר, ישיר ולעיתים ציני',
    avoidedBehaviors: 'לא לחשוף מיד את המידע המשפחתי ולא להסכים לכל הצעה ללא בירור.',
    voiceGender: 'male',
  }
  published.behavior = {
    difficulty: 'מאתגר',
    resistance: 'גבוהה',
    canCalmDown: true,
    openingTriggers: 'הכרה בתרומה המקצועית, שאלות פתוחות והפרדה בין האדם להתנהגות.',
    escalationTriggers: 'האשמות, איומים או השוואה לחברי צוות אחרים.',
    successConditions: 'המשתתף מתאר עובדות, מקשיב לסיבה ומסכם צעד מדיד עם מועד בדיקה.',
    failureConditions: 'השיחה מסתיימת באיום, בהאשמה אישית או ללא צעד המשך.',
    recommendedMinutes: 8,
    openingLine: 'אני מניח שהזמנת אותי בגלל התיעוד. בעיניי זה פשוט לא הדבר הכי דחוף כרגע.',
    endingConditions: 'הסכמה על צעד המשך, הסלמה חריפה או בחירה של המשתתף לסיים.',
  }
  published.participantBrief = {
    title: 'שיחת משוב ממוקדת עם נועם',
    shortDescription: 'תרגול שיחת משוב עם עובד מקצועי שמתנגד להתמקדות בתיעוד.',
    participantRole: 'מנהל/ת הצוות של נועם',
    situationDescription: 'בחודש האחרון שתי משימות תיעוד של נועם הוגשו באיחור. זו שיחה אישית ראשונה בנושא.',
    conversationGoal: 'להציג את הפער, להבין מה עומד מאחוריו ולהגיע להסכמה מעשית להמשך.',
    allowedInformation: 'נועם עובד מקצועי ומוערך. עומס העבודה בצוות עלה לאחרונה.',
    estimatedMinutes: 8,
    technicalInstructions: 'מצאו מקום שקט. לחצו על כפתור המיקרופון המדומה כדי להתקדם בין מצבי השיחה.',
    consentText: 'קראתי את התדריך ואני מוכן/ה להתחיל את הסימולציה.',
    showFeedback: true,
    allowRetry: true,
  }
  published.facilitatorConfiguration = {
    internalNotes: 'לבחון במיוחד מעבר מעובדות לפרשנות ויכולת להישאר סקרן מול התנגדות.',
    futureAgentPrompt: 'גלם את נועם. שמור על התנגדות גבוהה בתחילה והיפתח רק לאחר הכרה ושאלה פתוחה.',
  }
  published.learningObjectives = [
    {
      id: 'objective-listening',
      name: 'הקשבה פעילה',
      description: 'זיהוי נקודת המבט והרגש שמאחורי ההתנגדות.',
      weight: 40,
      metric: {
        id: 'metric-listening',
        name: 'שאלות פתוחות ושיקוף',
        successMeasure: 'לפחות שתי שאלות פתוחות ושיקוף אחד לפני הצעת פתרון.',
        visibleToParticipant: false,
        facilitatorOnly: true,
      },
    },
    {
      id: 'objective-clarity',
      name: 'בהירות והסכמה',
      description: 'הצגת הפער והגדרת צעד המשך מדיד.',
      weight: 60,
      metric: {
        id: 'metric-clarity',
        name: 'עובדות וצעד המשך',
        successMeasure: 'הצגת שתי דוגמאות עובדתיות וסיכום פעולה עם תאריך.',
        visibleToParticipant: false,
        facilitatorOnly: true,
      },
    },
  ]

  const draft = createBlankSimulation('sim-demo-change')
  draft.title = 'שיחת שינוי ארגוני'
  draft.updatedAt = '2026-07-17T13:20:00.000Z'
  draft.organization.clientName = 'קבוצת פסגה'
  draft.organization.programName = 'הובלת שינוי'
  draft.scenario.conversationType = 'שיחת שינוי ארגוני'
  draft.scenario.description = 'הצגת שינוי מבני לעובדת ותיקה שחוששת מאובדן השפעה.'
  draft.character.name = 'מיכל'
  draft.character.role = 'מנהלת תחום'
  draft.behavior.difficulty = 'בינוני'
  draft.participantBrief.title = 'שיחה על שינוי במבנה הצוות'
  draft.participantBrief.shortDescription = 'תרגול הצגת שינוי והקשבה לחששות.'
  draft.participantBrief.participantRole = 'מנהל/ת המחלקה'
  draft.participantBrief.situationDescription = draft.scenario.description
  draft.participantBrief.conversationGoal = 'להציג את השינוי ולהבין את החששות המרכזיים.'
  draft.attemptCount = 0

  return [published, draft]
}

export function createDemoSessions(): SimulationSession[] {
  return [
    {
      id: 'session-demo-1',
      simulationId: 'sim-demo-feedback',
      publicToken: DEMO_PUBLISHED_TOKEN,
      participant: {
        id: 'participant-demo-1',
        simulationId: 'sim-demo-feedback',
        details: { fullName: 'יעל כהן', role: 'מנהלת צוות' },
        createdAt: '2026-07-15T07:58:00.000Z',
      },
      startedAt: '2026-07-15T08:00:00.000Z',
      endedAt: '2026-07-15T08:07:24.000Z',
      durationSeconds: 444,
      status: 'completed',
      conversationState: 'listening',
      transcript: [
        { id: 't1', speaker: 'character', text: 'אני מניח שהזמנת אותי בגלל התיעוד.', timestampSeconds: 2 },
        { id: 't2', speaker: 'participant', text: 'נכון, ואני רוצה קודם להבין איך אתה רואה את התקופה האחרונה.', timestampSeconds: 18 },
        { id: 't3', speaker: 'character', text: 'העומס עלה מאוד, והתיעוד תמיד נדחק לסוף.', timestampSeconds: 31 },
      ],
    },
  ]
}

export function createDemoReports(): SimulationReport[] {
  return [
    {
      id: 'report-demo-1',
      sessionId: 'session-demo-1',
      summary: 'השיחה נפתחה בסקרנות ובהקשבה. הוצגו העובדות ונקבע צעד המשך, אך היה אפשר לנסח את הציפייה באופן חד יותר.',
      scores: { 'הקשבה פעילה': 4, 'בהירות המסר': 3, אמפתיה: 5, 'סיכום צעדים': 4 },
      strengths: ['שאלה פתוחה בתחילת השיחה', 'שיקוף הקושי ללא שיפוט', 'שמירה על טון יציב'],
      improvements: ['לציין את שתי הדוגמאות העובדתיות מוקדם יותר', 'להגדיר מועד מעקב מדויק'],
    },
  ]
}

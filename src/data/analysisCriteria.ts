// The universal analysis rubric. Each id MUST match the criterion id configured on
// the ElevenLabs agent (returned verbatim as `criteria_id` in the post-call webhook),
// and the Hebrew labels here MUST stay in sync with CRITERIA_LABELS_HE in
// supabase/functions/elevenlabs-postcall/index.ts. A facilitator picks a subset of
// these per simulation; the webhook then filters the analysis to the chosen ids.

export interface AnalysisCriterion {
  id: string
  label: string
  description: string
}

export const ANALYSIS_CRITERIA: AnalysisCriterion[] = [
  {
    id: 'situation_reading_and_diagnosis',
    label: 'קריאת מצב ואבחון',
    description: 'זיהוי הצורך, ההקשר והרגש של הצד השני והבנת שורש הנושא.',
  },
  {
    id: 'listening_and_empathy',
    label: 'הקשבה ואמפתיה',
    description: 'הקשבה פעילה, שיקוף רגשות והכרה בעמדת הצד השני.',
  },
  {
    id: 'clarity_and_assertiveness',
    label: 'בהירות ואסרטיביות',
    description: 'העברת מסר ברור וישיר תוך שמירה על כבוד ועמידה על העיקר.',
  },
  {
    id: 'process_management',
    label: 'ניהול תהליך',
    description: 'פתיחה, הובלת השיחה בצורה מסודרת וסגירה עם צעדי המשך.',
  },
  {
    id: 'adaptability_and_responsiveness',
    label: 'הסתגלות ותגובתיות',
    description: 'התאמת הגישה בזמן אמת לתגובות ולשינויים במהלך השיחה.',
  },
]

export const ANALYSIS_CRITERIA_IDS: string[] = ANALYSIS_CRITERIA.map((criterion) => criterion.id)

const LABEL_BY_ID = new Map(ANALYSIS_CRITERIA.map((criterion) => [criterion.id, criterion.label]))

/** Hebrew label for a criterion id, falling back to a humanised slug for unknown ids. */
export function analysisCriterionLabel(id: string): string {
  return LABEL_BY_ID.get(id) ?? id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
}

import type { Simulation, SimulationReport, SimulationSession } from '../../types/simulation'

export const SCORE_MAX = 5

export type ScoreTier = 'strong' | 'medium' | 'weak'

/** Status tier for a criterion score. Always paired with a text label in the UI, so
 * meaning is never carried by colour alone. */
export function scoreTier(score: number, max = SCORE_MAX): ScoreTier {
  const ratio = max > 0 ? score / max : 0
  if (ratio >= 0.8) return 'strong'
  if (ratio >= 0.6) return 'medium'
  return 'weak'
}

export const TIER_META: Record<ScoreTier, { label: string; color: string; bg: string; text: string }> = {
  strong: { label: 'חזק', color: '#059669', bg: '#ecfdf5', text: '#047857' },
  medium: { label: 'בינוני', color: '#d97706', bg: '#fffbeb', text: '#b45309' },
  weak: { label: 'לשיפור', color: '#dc2626', bg: '#fef2f2', text: '#b91c1c' },
}

export function averageScore(scores: Record<string, number>): number {
  const values = Object.values(scores)
  if (!values.length) return 0
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

/** Average score per criterion across every report that has scores. */
export function cohortCriteriaAverages(reports: Array<SimulationReport | null>): Array<{ label: string; score: number; count: number }> {
  const totals = new Map<string, { sum: number; count: number }>()
  for (const report of reports) {
    if (!report) continue
    for (const [label, score] of Object.entries(report.scores)) {
      if (typeof score !== 'number') continue
      const current = totals.get(label) ?? { sum: 0, count: 0 }
      current.sum += score
      current.count += 1
      totals.set(label, current)
    }
  }
  return Array.from(totals.entries()).map(([label, { sum, count }]) => ({
    label,
    score: Math.round((sum / count) * 10) / 10,
    count,
  }))
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'שם מלא',
  email: 'כתובת אימייל',
  employeeId: 'מספר עובד',
  role: 'תפקיד',
  department: 'מחלקה',
  cohort: 'קבוצה או מחזור',
  custom: 'שדה נוסף',
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
}

function dateLabel(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function slug(value: string): string {
  return (value || 'report').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 60)
}

/** Build a self-contained, RTL, print-ready HTML document for one session. */
export function buildSessionReportHtml(simulation: Simulation, session: SimulationSession, report: SimulationReport | null): string {
  const participantName = session.participant.details.fullName || 'משתתף אנונימי'
  const extraDetails = Object.entries(session.participant.details)
    .filter(([key, value]) => key !== 'fullName' && value)
    .map(([key, value]) => `<tr><th>${escapeHtml(FIELD_LABELS[key] ?? key)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('')

  const scores = report ? Object.entries(report.scores) : []
  const overall = report && scores.length ? averageScore(report.scores) : null

  const scoreRows = scores.map(([label, score]) => {
    const meta = TIER_META[scoreTier(score)]
    const pct = Math.min(100, (score / SCORE_MAX) * 100)
    return `<div class="crit">
      <div class="crit-head"><span>${escapeHtml(label)}</span><span class="crit-score" style="color:${meta.color}">${score}/${SCORE_MAX} · ${meta.label}</span></div>
      <div class="bar"><span style="width:${pct}%;background:${meta.color}"></span></div>
    </div>`
  }).join('')

  const listBlock = (title: string, items: string[]) => items.length
    ? `<div class="list"><h3>${escapeHtml(title)}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
    : ''

  const transcript = session.transcript.length
    ? session.transcript.map((entry) => {
        const who = entry.speaker === 'participant' ? 'המשתתף/ת' : (simulation.character.name || 'הדמות')
        return `<div class="turn turn-${entry.speaker === 'participant' ? 'p' : 'c'}"><div class="turn-meta">${escapeHtml(who)} · ${clock(entry.timestampSeconds)}</div><div>${escapeHtml(entry.text)}</div></div>`
      }).join('')
    : '<p class="muted">אין תמלול לניסיון זה.</p>'

  const generatedAt = new Intl.DateTimeFormat('he-IL', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())

  return `<!doctype html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>דוח סימולציה — ${escapeHtml(participantName)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: 'Heebo','Assistant','Segoe UI','Arial Hebrew',Arial,sans-serif; color:#15151f; margin:0; background:#f4f4f6; }
  .page { max-width: 820px; margin: 0 auto; padding: 32px 24px 64px; }
  header { border-bottom: 3px solid #ec2a8c; padding-bottom: 16px; margin-bottom: 24px; }
  .eyebrow { color:#ec2a8c; font-weight:800; font-size:13px; margin:0; }
  h1 { font-size: 26px; margin: 4px 0 2px; }
  h2 { font-size: 18px; margin: 32px 0 12px; }
  h3 { font-size: 15px; margin: 0 0 8px; }
  .sub { color:#5b726c; margin:2px 0; font-size:14px; }
  section { background:#fff; border:1px solid #e3e9e6; border-radius:16px; padding:20px 22px; margin-top:16px; }
  table.meta { width:100%; border-collapse:collapse; font-size:14px; }
  table.meta th { text-align:right; color:#66756f; font-weight:700; padding:4px 0; width:140px; vertical-align:top; }
  table.meta td { padding:4px 0; }
  .overall { display:flex; align-items:center; gap:16px; }
  .overall .num { font-size:40px; font-weight:900; line-height:1; }
  .overall .max { color:#6a807a; font-weight:700; font-size:14px; }
  .crit { margin:14px 0; }
  .crit-head { display:flex; justify-content:space-between; font-size:14px; font-weight:700; margin-bottom:6px; }
  .crit-score { font-variant-numeric: tabular-nums; }
  .bar { height:9px; background:#eef1f0; border-radius:999px; overflow:hidden; }
  .bar span { display:block; height:100%; border-radius:999px; }
  .lists { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .list ul { margin:0; padding-inline-start:18px; }
  .list li { margin:6px 0; line-height:1.6; font-size:14px; }
  .turn { max-width:85%; padding:10px 14px; border-radius:14px; margin:8px 0; font-size:14px; line-height:1.6; }
  .turn-meta { font-size:12px; font-weight:700; opacity:.65; margin-bottom:2px; }
  .turn-p { background:#ec2a8c; color:#fff; margin-inline-start:auto; }
  .turn-c { background:#eef2ef; color:#15151f; margin-inline-end:auto; }
  .muted { color:#6a807a; font-size:14px; }
  footer { margin-top:32px; text-align:center; color:#8a938f; font-size:12px; }
  .confidential { color:#b91c1c; font-weight:700; }
  @media print { body { background:#fff; } section { break-inside: avoid; } .page { padding:0; } }
</style>
</head>
<body>
<div class="page">
  <header>
    <p class="eyebrow">דוח סימולציה — NGG שיח</p>
    <h1>${escapeHtml(simulation.title || 'סימולציה')}</h1>
    <p class="sub">${escapeHtml(participantName)}</p>
  </header>

  <section>
    <h3>פרטי הניסיון</h3>
    <table class="meta">
      <tr><th>התחלה</th><td>${escapeHtml(dateLabel(session.startedAt))}</td></tr>
      <tr><th>סיום</th><td>${escapeHtml(dateLabel(session.endedAt))}</td></tr>
      <tr><th>משך</th><td>${escapeHtml(clock(session.durationSeconds))} דקות</td></tr>
      <tr><th>סטטוס</th><td>${session.status === 'completed' ? 'הושלם' : 'בתהליך'}</td></tr>
      ${extraDetails}
    </table>
  </section>

  ${report ? `<section>
    <h3>סיכום</h3>
    <p style="line-height:1.7;margin:0;color:#405b55">${escapeHtml(report.summary || 'אין סיכום זמין.')}</p>
  </section>` : ''}

  ${overall !== null ? `<section>
    <h3>ציון כולל</h3>
    <div class="overall"><span class="num" style="color:${TIER_META[scoreTier(overall)].color}">${overall}</span><span class="max">מתוך ${SCORE_MAX}</span></div>
    <h3 style="margin-top:20px">ציונים לפי קריטריון</h3>
    ${scoreRows}
  </section>` : ''}

  ${report && (report.strengths.length || report.improvements.length) ? `<section>
    <div class="lists">
      ${listBlock('נקודות חוזקה', report.strengths)}
      ${listBlock('נקודות לשיפור', report.improvements)}
    </div>
  </section>` : ''}

  <section>
    <h3>תמלול השיחה</h3>
    ${transcript}
  </section>

  <footer>
    <p class="confidential">מסמך פנימי — לשימוש צוות NGG בלבד. אין להפיץ מחוץ לארגון.</p>
    <p>הופק בתאריך ${escapeHtml(generatedAt)}</p>
  </footer>
</div>
</body>
</html>`
}

/** Trigger a browser download of the session report as a self-contained HTML file. */
export function downloadSessionReport(simulation: Simulation, session: SimulationSession, report: SimulationReport | null): void {
  const html = buildSessionReportHtml(simulation, session, report)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const name = session.participant.details.fullName || 'משתתף'
  const today = new Intl.DateTimeFormat('en-CA').format(new Date()) // yyyy-mm-dd
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${slug(simulation.title)}-${slug(name)}-${today}.html`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

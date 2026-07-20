// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_PUBLISHED_TOKEN } from '../data/demoData'
import { getParticipantSimulationByToken, startParticipantSession } from '../services/participantSimulationService'
import { resetDemoStorage, simulationRepository } from './localSimulationRepository'

describe('localSimulationRepository', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetDemoStorage()
  })

  it('returns a strictly reduced participant view without internal data', async () => {
    const result = await getParticipantSimulationByToken(simulationRepository, DEMO_PUBLISHED_TOKEN)
    expect(result.state).toBe('available')
    if (result.state !== 'available') return

    expect(result.simulation.title).toBe('שיחת משוב עם עובד מתנגד')
    expect(result.simulation).not.toHaveProperty('behavior')
    expect(result.simulation).not.toHaveProperty('learningObjectives')
    expect(result.simulation).not.toHaveProperty('facilitatorConfiguration')
    expect(result.simulation).not.toHaveProperty('scenario.hiddenInfo')
    expect(result.simulation.character).toEqual({ name: 'נועם לוי', role: 'מפתח בכיר' })
  })

  it('publishes a valid draft with an unpredictable token and public link', async () => {
    const draft = await simulationRepository.create()
    const updated = await simulationRepository.update(draft.id, {
      title: 'בדיקת פרסום',
      scenario: { ...draft.scenario, description: 'שיחה על פער בביצועים' },
      character: { ...draft.character, name: 'דמות בדיקה' },
      participantBrief: {
        ...draft.participantBrief,
        title: 'תדריך לבדיקה',
        shortDescription: 'תיאור קצר וממוקד',
        participantRole: 'מנהל/ת',
        conversationGoal: 'להגיע להסכמה',
      },
    })
    const published = await simulationRepository.publish(updated.id)

    expect(published.status).toBe('published')
    expect(published.publicToken).toMatch(/^[a-z0-9]{20,}$/)
    expect(published.shareLink?.url).toContain(`/simulation/${published.publicToken}`)
    expect((await getParticipantSimulationByToken(simulationRepository, published.publicToken!)).state).toBe('available')
  })

  it('revokes the old public token when publication is cancelled', async () => {
    const demo = (await simulationRepository.list()).find((simulation) => simulation.publicToken === DEMO_PUBLISHED_TOKEN)!
    await simulationRepository.unpublish(demo.id)
    expect(await getParticipantSimulationByToken(simulationRepository, DEMO_PUBLISHED_TOKEN)).toEqual({ state: 'unavailable', reason: 'unpublished' })
  })

  it('saves and completes a demo session', async () => {
    const session = await startParticipantSession(simulationRepository, DEMO_PUBLISHED_TOKEN, { fullName: 'בדיקת משתמש' })
    const completed = await simulationRepository.completeSession(session.id, 73, [
      { id: 'entry-1', speaker: 'participant', text: 'שלום', timestampSeconds: 3 },
    ])

    expect(completed.status).toBe('completed')
    expect(completed.durationSeconds).toBe(73)
    expect((await simulationRepository.getReport(session.id))?.scores).toBeDefined()
  })

  it('persists the character voice selection through create, update and reload', async () => {
    const draft = await simulationRepository.create()
    expect(draft.character.voiceGender).toBe('female')

    const updated = await simulationRepository.update(draft.id, {
      character: { ...draft.character, voiceGender: 'male' },
    })
    expect(updated.character.voiceGender).toBe('male')

    const reloaded = await simulationRepository.getById(draft.id)
    expect(reloaded?.character.voiceGender).toBe('male')
  })

  it('collapses duplicate session starts that share an idempotency key', async () => {
    const key = 'attempt-abc123def456'
    const first = await startParticipantSession(simulationRepository, DEMO_PUBLISHED_TOKEN, { fullName: 'בדיקה' }, key)
    const countAfterFirst = (await simulationRepository.listSessions(first.simulationId)).length

    const second = await startParticipantSession(simulationRepository, DEMO_PUBLISHED_TOKEN, { fullName: 'בדיקה' }, key)
    expect(second.id).toBe(first.id)
    expect((await simulationRepository.listSessions(first.simulationId)).length).toBe(countAfterFirst)

    const fresh = await startParticipantSession(simulationRepository, DEMO_PUBLISHED_TOKEN, { fullName: 'בדיקה' }, 'different-xyz789012')
    expect(fresh.id).not.toBe(first.id)
    expect((await simulationRepository.listSessions(first.simulationId)).length).toBe(countAfterFirst + 1)
  })

  it('creates a distinct attempt for each start when no idempotency key is supplied', async () => {
    const first = await startParticipantSession(simulationRepository, DEMO_PUBLISHED_TOKEN, { fullName: 'בדיקה' })
    const second = await startParticipantSession(simulationRepository, DEMO_PUBLISHED_TOKEN, { fullName: 'בדיקה' })
    expect(second.id).not.toBe(first.id)
  })

  it('marks replaced and deleted tokens with a friendly reason', async () => {
    const demo = (await simulationRepository.list()).find((simulation) => simulation.publicToken === DEMO_PUBLISHED_TOKEN)!
    const regenerated = await simulationRepository.regeneratePublicToken(demo.id)
    expect(await getParticipantSimulationByToken(simulationRepository, DEMO_PUBLISHED_TOKEN)).toEqual({ state: 'unavailable', reason: 'replaced' })

    await simulationRepository.remove(regenerated.id)
    expect(await getParticipantSimulationByToken(simulationRepository, regenerated.publicToken!)).toEqual({ state: 'unavailable', reason: 'deleted' })
  })
})

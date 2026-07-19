import type { Simulation } from '../types/simulation'

export function validatePublishable(simulation: Simulation): void {
  if (!simulation.title.trim()) throw new Error('יש להזין שם לסימולציה לפני הפרסום.')
  const brief = simulation.participantBrief
  if (!brief.title.trim() || !brief.shortDescription.trim() || !brief.participantRole.trim() || !brief.conversationGoal.trim()) {
    throw new Error('יש להשלים את תדריך המשתתף לפני הפרסום.')
  }
  if (!simulation.scenario.description.trim()) throw new Error('יש להשלים את תיאור הסיטואציה לפני הפרסום.')
  if (!simulation.character.name.trim()) throw new Error('יש להגדיר שם לדמות לפני הפרסום.')
}


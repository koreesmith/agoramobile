import type { ComponentType } from 'react'

// AMOBILE-202: shared shapes for the getting started wizard (AMOBILE-201),
// the mobile counterpart of web's components/welcome/types.ts.

export type StepId = 'welcome' | 'profile' | 'privacy' | 'bluesky' | 'fediverse' | 'people' | 'done'

// The parts of GET /api/instance the wizard uses (AGORA-387). Older servers
// leave out the network switches and domain, which reads as both networks
// off: those steps are simply skipped.
export interface InstanceInfo {
  instance_name?: string
  logo_url?: string
  user_invites_enabled?: string
  domain?: string
  activitypub_enabled?: boolean
  atproto_enabled?: boolean
}

// What one step did that a later one reports back.
export interface WizardNotes {
  domainReminder: boolean
  requestsSent: number
  follows: number
  groupsJoined: number
}

// Where finishing leaves for.
export type FinishTo = 'feed'

export interface StepProps {
  current: StepId
  // The steps this instance shows, in order: a network the admin turned off
  // has no step.
  steps: { id: StepId; label: string }[]
  instance: InstanceInfo
  // Fresh GET /auth/me (see useMe). Steps that change a setting refetch it,
  // so the recap at the end reads what was saved.
  me: any
  notes: WizardNotes
  setNotes: (update: Partial<WizardNotes> | ((n: WizardNotes) => Partial<WizardNotes>)) => void
  next: () => void
  back: () => void
  goTo: (id: StepId) => void
  // Marks onboarding complete and leaves. Used by finishing and by every
  // kind of skip.
  finish: (to?: FinishTo) => void
  finishing: boolean
}

export interface StepDef {
  id: StepId
  label: string
  Component: ComponentType<StepProps>
}

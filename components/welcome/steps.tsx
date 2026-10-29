import type { StepDef } from './types'
import WelcomeStep from './WelcomeStep'
import ProfileStep from './ProfileStep'
import PrivacyStep from './PrivacyStep'
import { BlueskyStep, FediverseStep } from './NetworkStep'
import FindPeopleStep from './FindPeopleStep'
import AllSetStep from './AllSetStep'

// AMOBILE-202: the wizard's steps, in order. The welcome screen leaves out
// the network steps the instance has turned off.
export const ALL_STEPS: StepDef[] = [
  { id: 'welcome',   label: 'Welcome',      Component: WelcomeStep },
  { id: 'profile',   label: 'Your profile', Component: ProfileStep },
  { id: 'privacy',   label: 'Privacy',      Component: PrivacyStep },
  { id: 'bluesky',   label: 'Bluesky',      Component: BlueskyStep },
  { id: 'fediverse', label: 'Fediverse',    Component: FediverseStep },
  { id: 'people',    label: 'Find people',  Component: FindPeopleStep },
  { id: 'done',      label: 'All set',      Component: AllSetStep },
]

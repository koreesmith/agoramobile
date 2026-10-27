import type { StepDef, StepProps } from './types'
import { StepFooter, StepHeader, StepScroll } from './parts'
import WelcomeStep from './WelcomeStep'
import ProfileStep from './ProfileStep'
import PrivacyStep from './PrivacyStep'
import { BlueskyStep, FediverseStep } from './NetworkStep'

// AMOBILE-202: the wizard's steps, in order. Each one is built by its own
// story (AMOBILE-203 to 205); until then a placeholder stands in for it.

function PlaceholderStep({ current, steps, next, back, finish, finishing }: StepProps) {
  const label = steps.find(s => s.id === current)?.label ?? ''
  const first = current === steps[0]?.id
  const last = current === steps[steps.length - 1]?.id
  return (
    <>
      <StepScroll>
        <StepHeader title={label}>This step is on its way.</StepHeader>
      </StepScroll>
      <StepFooter onBack={first ? undefined : back} busy={finishing}
        onContinue={last ? () => finish('feed') : next} continueLabel={last ? 'Finish' : 'Continue'} />
    </>
  )
}

export const ALL_STEPS: StepDef[] = [
  { id: 'welcome',   label: 'Welcome',      Component: WelcomeStep },
  { id: 'profile',   label: 'Your profile', Component: ProfileStep },
  { id: 'privacy',   label: 'Privacy',      Component: PrivacyStep },
  { id: 'bluesky',   label: 'Bluesky',      Component: BlueskyStep },
  { id: 'fediverse', label: 'Fediverse',    Component: FediverseStep },
  { id: 'people',    label: 'Find people',  Component: PlaceholderStep },
  { id: 'done',      label: 'All set',      Component: PlaceholderStep },
]

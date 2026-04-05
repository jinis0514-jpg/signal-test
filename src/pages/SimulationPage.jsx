import SignalPage from './SignalPage'

export default function SimulationPage({
  initialStrategyId,
  user,
  onStartTrial,
  onSubscribe,
  userStrategies = [],
  currentUser = null,
  onNavigate,
}) {
  return (
    <SignalPage
      initialStrategyId={initialStrategyId}
      user={user}
      onStartTrial={onStartTrial}
      onSubscribe={onSubscribe}
      userStrategies={userStrategies}
      currentUser={currentUser}
      onNavigate={onNavigate}
    />
  )
}

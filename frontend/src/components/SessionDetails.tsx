import { useState, useEffect, useMemo } from 'react'
import { Card, CardBody, CardHeader, Chip, Tabs, Tab, Spinner, Button } from '@heroui/react'
import { FiRefreshCw, FiRadio, FiGitBranch, FiList, FiPlay, FiRotateCcw, FiTrash2, FiLayers } from 'react-icons/fi'
import { useSession, useSessionEvents, useDeleteSession } from '@/hooks/use-sessions'
import { useEventStream } from '@/hooks/use-event-stream'
import { useRunScenario } from '@/hooks/use-scenarios'
import { useThreadActivity } from '@/hooks/use-thread-activity'
import { CoroutineTree } from './CoroutineTree'
import { CoroutineTreeGraph } from './CoroutineTreeGraph'
import { EventsList } from './EventsList'
import { JobStateDisplay } from './JobStateDisplay'
import { StructuredConcurrencyInfo } from './StructuredConcurrencyInfo'
import { ThreadTimeline } from './ThreadTimeline'
import { DispatcherOverview } from './DispatcherOverview'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from '@tanstack/react-router'
import type { JobStateChangedEvent } from '@/types/api'

interface SessionDetailsProps {
  sessionId: string
  scenarioId?: string
  scenarioName?: string
}

export function SessionDetails({ sessionId, scenarioId, scenarioName }: SessionDetailsProps) {
  const { data: session, isLoading, refetch } = useSession(sessionId)
  const { data: storedEvents } = useSessionEvents(sessionId)
  const { data: threadActivity } = useThreadActivity(sessionId)
  const [streamEnabled, setStreamEnabled] = useState(false)
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const { events: liveEvents, isConnected, clearEvents } = useEventStream(sessionId, streamEnabled)
  const runScenario = useRunScenario()
  const deleteSession = useDeleteSession()
  const navigate = useNavigate()

  const allEvents = streamEnabled ? liveEvents : storedEvents || []
  const hasScenario = !!scenarioId
  const hasStarted = session ? session.coroutineCount > 0 : false

  // Track job states from JobStateChanged events
  const jobStates = useMemo(() => {
    const states = new Map<string, JobStateChangedEvent>()
    allEvents.forEach(event => {
      if (event.kind === 'JobStateChanged') {
        const jobEvent = event as JobStateChangedEvent
        states.set(jobEvent.jobId, jobEvent)
      }
    })
    return states
  }, [allEvents])

  // Auto-refresh session data when SSE is active and new events arrive
  useEffect(() => {
    if (streamEnabled && liveEvents.length > 0) {
      // Refetch session data when new events arrive
      const timer = setTimeout(() => {
        refetch()
      }, 200) // Small debounce to avoid too many requests

      return () => clearTimeout(timer)
    }
  }, [streamEnabled, liveEvents.length, refetch])

  // Auto-refresh interval when live stream is active
  useEffect(() => {
    if (streamEnabled && autoRefresh) {
      const interval = setInterval(() => {
        refetch()
      }, 500) // Refresh every 500ms for smooth real-time updates

      return () => clearInterval(interval)
    }
  }, [streamEnabled, autoRefresh, refetch])

  // Enable auto-refresh when stream is enabled
  useEffect(() => {
    if (streamEnabled) {
      setAutoRefresh(true)
    } else {
      setAutoRefresh(false)
    }
  }, [streamEnabled])

  // Auto-enable live stream when scenario is present
  useEffect(() => {
    if (hasScenario && !streamEnabled) {
      setStreamEnabled(true)
    }
  }, [hasScenario, streamEnabled])

  const handleRunScenario = async () => {
    if (!scenarioId) return
    
    try {
      await runScenario.mutateAsync({ scenarioId, sessionId })
      // Refetch immediately after running
      setTimeout(() => refetch(), 500)
    } catch {
      // Error is handled by the mutation's error state
    }
  }

  const handleReset = async () => {
    if (!confirm('Reset this session? This will clear all coroutines and start fresh.')) {
      return
    }

    try {
      // Delete current session
      await deleteSession.mutateAsync(sessionId)
      
      // Navigate back to scenarios or create new session
      if (hasScenario) {
        navigate({ to: '/scenarios' })
      } else {
        navigate({ to: '/sessions' })
      }
    } catch {
      // Error is handled by the mutation's error state
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!session) {
    return (
      <Card>
        <CardBody>
          <p className="text-center text-danger">Session not found</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Session Details</h1>
              {hasScenario && scenarioName && (
                <Chip color="primary" variant="bordered" size="lg">
                  {scenarioName}
                </Chip>
              )}
            </div>
            <p className="font-mono text-sm text-default-500">{sessionId}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <Chip color="primary" variant="flat">
                {session.coroutineCount} coroutines
              </Chip>
              <Chip color="secondary" variant="flat">
                {session.eventCount} events
              </Chip>
            </div>
            <Button
              isIconOnly
              variant="flat"
              onPress={() => refetch()}
            >
              <FiRefreshCw />
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                color={streamEnabled ? 'success' : 'default'}
                variant={streamEnabled ? 'flat' : 'bordered'}
                startContent={<FiRadio />}
                onPress={() => {
                  if (streamEnabled) {
                    clearEvents()
                  }
                  setStreamEnabled(!streamEnabled)
                }}
              >
                {streamEnabled ? 'Live Stream Active' : 'Enable Live Stream'}
              </Button>
              {streamEnabled && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2"
                  >
                    <Chip
                      color={isConnected ? 'success' : 'warning'}
                      variant="dot"
                    >
                      {isConnected ? 'Connected' : 'Connecting...'}
                    </Chip>
                    {autoRefresh && (
                      <Chip color="primary" variant="flat" size="sm">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          className="inline-block"
                        >
                          🔄
                        </motion.span>
                        Auto-updating
                      </Chip>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewMode === 'graph' ? 'flat' : 'light'}
                color={viewMode === 'graph' ? 'primary' : 'default'}
                startContent={<FiGitBranch />}
                onPress={() => setViewMode('graph')}
              >
                Graph View
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'flat' : 'light'}
                color={viewMode === 'list' ? 'primary' : 'default'}
                startContent={<FiList />}
                onPress={() => setViewMode('list')}
              >
                List View
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Scenario Control Panel */}
      {hasScenario && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="mb-1 text-lg font-semibold">Scenario Controls</h3>
                <p className="text-sm text-default-500">
                  {hasStarted 
                    ? 'Scenario is running or has completed' 
                    : 'Ready to run the scenario'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  color="primary"
                  size="lg"
                  startContent={<FiPlay />}
                  onPress={handleRunScenario}
                  isLoading={runScenario.isPending}
                  isDisabled={hasStarted}
                >
                  {hasStarted ? 'Scenario Running' : 'Run Scenario'}
                </Button>
                <Button
                  color="warning"
                  size="lg"
                  variant="flat"
                  startContent={<FiRotateCcw />}
                  onPress={handleReset}
                  isLoading={deleteSession.isPending}
                >
                  Reset
                </Button>
                <Button
                  color="danger"
                  size="lg"
                  variant="light"
                  startContent={<FiTrash2 />}
                  onPress={handleReset}
                  isLoading={deleteSession.isPending}
                >
                  Clear
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Structured Concurrency Info - Show when session has coroutines */}
      {session.coroutineCount > 0 && <StructuredConcurrencyInfo />}

      {/* Tabs */}
      <Tabs aria-label="Session tabs" variant="bordered" fullWidth>
        <Tab key="tree" title="Coroutine Visualization">
          <Card>
            <CardBody className="overflow-auto">
              {viewMode === 'graph' ? (
                <CoroutineTreeGraph coroutines={session.coroutines} />
              ) : (
                <CoroutineTree coroutines={session.coroutines} />
              )}
            </CardBody>
          </Card>
        </Tab>
        <Tab key="job-states" title={`Job States (${jobStates.size})`}>
          <Card>
            <CardBody>
              <JobStateDisplay jobStates={jobStates} />
            </CardBody>
          </Card>
        </Tab>
        <Tab key="events" title={`Events (${allEvents.length})`}>
          <Card>
            <CardBody>
              <EventsList events={allEvents} />
            </CardBody>
          </Card>
        </Tab>
        <Tab key="threads" title="Thread Activity">
          {threadActivity ? (
            <ThreadTimeline threadActivity={threadActivity} />
          ) : (
            <Card>
              <CardBody>
                <div className="text-center text-default-400 py-4">
                  <Spinner size="sm" className="mb-2" />
                  <p>Loading thread activity...</p>
                </div>
              </CardBody>
            </Card>
          )}
        </Tab>
        <Tab 
          key="dispatchers" 
          title={
            <div className="flex items-center gap-2">
              <FiLayers />
              <span>Dispatchers</span>
            </div>
          }
        >
          <div className="py-4">
            <DispatcherOverview sessionId={sessionId} />
          </div>
        </Tab>
      </Tabs>
    </div>
  )
}


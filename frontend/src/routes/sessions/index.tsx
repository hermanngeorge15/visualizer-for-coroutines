import { createFileRoute, Link } from '@tanstack/react-router'
import { Button, Card, CardBody, Chip, Spinner } from '@heroui/react'
import { FiPlus, FiTrash2, FiEye } from 'react-icons/fi'
import { Layout } from '@/components/Layout'
import { useSessions, useCreateSession, useDeleteSession } from '@/hooks/use-sessions'
import { useState } from 'react'

export const Route = createFileRoute('/sessions/')({
  component: SessionsPage,
})

function SessionsPage() {
  const { data: sessions, isLoading } = useSessions()
  const createSession = useCreateSession()
  const deleteSession = useDeleteSession()
  const [sessionName, setSessionName] = useState('')

  const handleCreate = () => {
    const name = sessionName.trim() || undefined
    createSession.mutate(name)
    setSessionName('')
  }

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm('Delete this session?')) {
      deleteSession.mutate(sessionId)
    }
  }

  return (
    <Layout>
      <div className="container-custom py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Sessions</h1>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Session name (optional)"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="rounded-lg border border-default-300 px-4 py-2"
            />
            <Button
              color="primary"
              startContent={<FiPlus />}
              onPress={handleCreate}
              isLoading={createSession.isPending}
            >
              Create Session
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-center text-default-500">
                No sessions yet. Create a new session to start tracking coroutines.
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map(session => (
              <Card key={session.sessionId} isPressable isHoverable>
                <CardBody>
                  <Link
                    to="/sessions/$sessionId"
                    params={{ sessionId: session.sessionId }}
                    className="block"
                  >
                    <div className="mb-3">
                      <div className="mb-1 font-mono text-xs text-default-500">
                        {session.sessionId}
                      </div>
                      <Chip color="primary" size="sm" variant="flat">
                        {session.coroutineCount} coroutines
                      </Chip>
                    </div>
                    <div className="flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="light"
                        startContent={<FiEye />}
                        as="span"
                      >
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="light"
                        isIconOnly
                        onPress={e => handleDelete(session.sessionId, e as any)}
                      >
                        <FiTrash2 />
                      </Button>
                    </div>
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}


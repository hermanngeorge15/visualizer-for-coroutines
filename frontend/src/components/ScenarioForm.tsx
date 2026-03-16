import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input, Select, SelectItem } from '@heroui/react'
import type { Scenario } from '@/types/api'
import { useSessions } from '@/hooks/use-sessions'

const scenarioFormSchema = z.object({
  sessionId: z.string().optional(),
  depth: z.string().optional(),
})

type ScenarioFormData = z.infer<typeof scenarioFormSchema>

interface ScenarioFormProps {
  scenario: Scenario
  onSubmit: (data: { sessionId?: string; params?: Record<string, string> }) => void
  isSubmitting?: boolean
}

export function ScenarioForm({ scenario, onSubmit, isSubmitting }: ScenarioFormProps) {
  const { data: sessions } = useSessions()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ScenarioFormData>({
    resolver: zodResolver(scenarioFormSchema),
  })

  const onFormSubmit = (data: ScenarioFormData) => {
    const params: Record<string, string> = {}
    if (data.depth) {
      params.depth = data.depth
    }

    onSubmit({
      sessionId: data.sessionId || undefined,
      params: Object.keys(params).length > 0 ? params : undefined,
    })
  }

  const needsDepthParam = scenario.id === 'deep-nesting'

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <Select
        label="Session (optional)"
        placeholder="Create new session"
        {...register('sessionId')}
        errorMessage={errors.sessionId?.message}
      >
        {sessions?.map(session => (
          <SelectItem key={session.sessionId} value={session.sessionId}>
            {session.sessionId} ({session.coroutineCount} coroutines)
          </SelectItem>
        )) || []}
      </Select>

      {needsDepthParam && (
        <Input
          type="number"
          label="Nesting Depth"
          placeholder="5"
          min={1}
          max={20}
          {...register('depth')}
          errorMessage={errors.depth?.message}
        />
      )}

      <Button
        type="submit"
        color="primary"
        fullWidth
        isLoading={isSubmitting}
      >
        Run Scenario
      </Button>
    </form>
  )
}


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export function useScenarios() {
  return useQuery({
    queryKey: ['scenarios'],
    queryFn: () => apiClient.listScenarios(),
  })
}

export function useRunScenario() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      scenarioId,
      sessionId,
      params,
    }: {
      scenarioId: string
      sessionId?: string
      params?: Record<string, string>
    }) => apiClient.runScenario(scenarioId, sessionId, params),
    onSuccess: (data) => {
      // Invalidate the session that was used/created
      queryClient.invalidateQueries({ queryKey: ['sessions', data.sessionId] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}


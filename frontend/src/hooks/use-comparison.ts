import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

/**
 * Fetches a side-by-side comparison of two sessions via GET /api/compare.
 * The query is only enabled when both session IDs are provided and non-empty.
 */
export function useComparison(sessionA: string | undefined, sessionB: string | undefined) {
  return useQuery({
    queryKey: ['comparison', sessionA, sessionB],
    queryFn: () => apiClient.compareSessions(sessionA!, sessionB!),
    enabled: !!sessionA && !!sessionB && sessionA !== sessionB,
  })
}

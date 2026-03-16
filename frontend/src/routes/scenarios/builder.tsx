import { createFileRoute } from '@tanstack/react-router'
import { Layout } from '@/components/Layout'
import { ScenarioBuilder } from '@/components/ScenarioBuilder'

export const Route = createFileRoute('/scenarios/builder')({
  component: ScenarioBuilderPage,
})

function ScenarioBuilderPage() {
  return (
    <Layout>
      <ScenarioBuilder />
    </Layout>
  )
}


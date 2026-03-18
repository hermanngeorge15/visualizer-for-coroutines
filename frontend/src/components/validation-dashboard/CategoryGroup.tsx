import { Accordion, AccordionItem } from '@heroui/react'
import { FindingCard } from './FindingCard'
import type { RuleFinding } from './types'

interface CategoryGroupProps {
  findings: RuleFinding[]
}

const categoryLabels: Record<string, string> = {
  LIFECYCLE: 'Lifecycle',
  STRUCTURED_CONCURRENCY: 'Structured Concurrency',
  PERFORMANCE: 'Performance',
  THREADING: 'Threading',
  EXCEPTION_HANDLING: 'Exception Handling',
  RESOURCE_MANAGEMENT: 'Resource Management',
}

export function CategoryGroup({ findings }: CategoryGroupProps) {
  const grouped = findings.reduce(
    (acc, finding) => {
      const cat = finding.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(finding)
      return acc
    },
    {} as Record<string, RuleFinding[]>
  )

  const categories = Object.keys(grouped).sort()

  return (
    <Accordion variant="splitted" selectionMode="multiple" defaultExpandedKeys={categories}>
      {categories.map(category => (
        <AccordionItem
          key={category}
          title={
            <span className="text-sm font-medium">
              {categoryLabels[category] ?? category} ({grouped[category]!.length})
            </span>
          }
        >
          <div className="space-y-2">
            {grouped[category]!.map((finding, i) => (
              <FindingCard key={`${finding.ruleId}-${i}`} finding={finding} />
            ))}
          </div>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

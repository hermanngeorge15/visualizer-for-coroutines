import { Card, CardBody, CardHeader, Divider } from '@heroui/react'
import { FiCode, FiBookOpen } from 'react-icons/fi'

interface SuggestionViewProps {
  title: string
  description: string
  codeSnippet?: string | null
  documentation?: string | null
}

export function SuggestionView({ title, description, codeSnippet, documentation }: SuggestionViewProps) {
  return (
    <Card shadow="none" className="border border-primary-100 bg-primary-50/30">
      <CardHeader className="pb-1">
        <span className="text-sm font-medium text-primary-700">{title}</span>
      </CardHeader>
      <Divider />
      <CardBody className="pt-2 space-y-2">
        <p className="text-sm text-default-600">{description}</p>

        {codeSnippet && (
          <div className="bg-default-100 rounded-lg p-3">
            <div className="flex items-center gap-1 text-xs text-default-400 mb-1">
              <FiCode size={12} />
              <span>Suggested fix</span>
            </div>
            <pre className="text-xs font-mono text-default-700 whitespace-pre-wrap">
              {codeSnippet}
            </pre>
          </div>
        )}

        {documentation && (
          <div className="flex items-center gap-1 text-xs text-primary-600">
            <FiBookOpen size={12} />
            <a href={documentation} target="_blank" rel="noopener noreferrer" className="hover:underline">
              Documentation
            </a>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

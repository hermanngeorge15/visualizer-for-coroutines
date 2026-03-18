import { FiArrowRight } from 'react-icons/fi'

interface AntiPatternSuggestionProps {
  suggestion: string
}

export function AntiPatternSuggestion({ suggestion }: AntiPatternSuggestionProps) {
  return (
    <div className="flex items-start gap-1.5 mt-1.5 text-xs text-primary-600 bg-primary-50 rounded px-2 py-1.5">
      <FiArrowRight size={12} className="mt-0.5 shrink-0" />
      <span>{suggestion}</span>
    </div>
  )
}

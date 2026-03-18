export interface RuleFinding {
  ruleId: string
  ruleName: string
  severity: 'ERROR' | 'WARNING' | 'INFO'
  category: string
  message: string
  suggestion: string
  affectedEntities: string[]
  eventSeq?: number | null
  coroutineId?: string | null
}

export interface ValidationReport {
  sessionId: string
  findings: RuleFinding[]
  score: number
  summary: {
    errors: number
    warnings: number
    info: number
    total: number
  }
}

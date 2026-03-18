import { useState, useMemo } from 'react'
import { Card, CardBody, CardHeader, Divider, Spinner } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeSlideUp } from '@/lib/animation-variants'
import { ValidationScoreCard } from './ValidationScoreCard'
import { SeverityFilter } from './SeverityFilter'
import { CategoryGroup } from './CategoryGroup'
import type { RuleFinding } from './types'

interface ValidationDashboardProps {
  findings: RuleFinding[]
  isLoading?: boolean
}

function computeScore(findings: RuleFinding[]): number {
  if (findings.length === 0) return 100
  const errors = findings.filter(f => f.severity === 'ERROR').length
  const warnings = findings.filter(f => f.severity === 'WARNING').length
  // Each error costs 10 points, each warning costs 3 points, max 100
  return Math.max(0, 100 - errors * 10 - warnings * 3)
}

export function ValidationDashboard({ findings, isLoading }: ValidationDashboardProps) {
  const [activeSeverities, setActiveSeverities] = useState<Set<string>>(
    new Set(['ERROR', 'WARNING', 'INFO'])
  )

  const counts = useMemo(() => ({
    errors: findings.filter(f => f.severity === 'ERROR').length,
    warnings: findings.filter(f => f.severity === 'WARNING').length,
    info: findings.filter(f => f.severity === 'INFO').length,
  }), [findings])

  const filteredFindings = useMemo(
    () => findings.filter(f => activeSeverities.has(f.severity)),
    [findings, activeSeverities]
  )

  const score = useMemo(() => computeScore(findings), [findings])

  const handleToggle = (severity: string) => {
    setActiveSeverities(prev => {
      const next = new Set(prev)
      if (next.has(severity)) {
        next.delete(severity)
      } else {
        next.add(severity)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner label="Running validation..." />
      </div>
    )
  }

  return (
    <motion.div
      variants={fadeSlideUp}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <ValidationScoreCard
        score={score}
        errors={counts.errors}
        warnings={counts.warnings}
        info={counts.info}
        total={findings.length}
      />

      <Card>
        <CardHeader className="flex items-center justify-between">
          <span className="font-semibold">Findings</span>
          <SeverityFilter
            counts={counts}
            active={activeSeverities}
            onToggle={handleToggle}
          />
        </CardHeader>
        <Divider />
        <CardBody>
          <AnimatePresence mode="wait">
            {filteredFindings.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center text-default-400 py-8"
              >
                {findings.length === 0
                  ? 'No issues found — your coroutines look great!'
                  : 'No findings match the current filter.'}
              </motion.div>
            ) : (
              <motion.div
                key="findings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <CategoryGroup findings={filteredFindings} />
              </motion.div>
            )}
          </AnimatePresence>
        </CardBody>
      </Card>
    </motion.div>
  )
}

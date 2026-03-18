import { Card, CardBody, CardHeader, Chip, Divider } from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiAlertTriangle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi'
import { fadeSlideUp } from '@/lib/animation-variants'
import type { AntiPatternDetected, AntiPatternSeverity } from '@/hooks/use-anti-patterns'
import { AntiPatternSuggestion } from './AntiPatternSuggestion'

interface AntiPatternOverlayProps {
  patterns: AntiPatternDetected[]
  isOpen: boolean
  onClose: () => void
}

const severityOrder: AntiPatternSeverity[] = ['ERROR', 'WARNING', 'INFO']
const severityLabels: Record<AntiPatternSeverity, string> = {
  ERROR: 'Errors',
  WARNING: 'Warnings',
  INFO: 'Info',
}
const severityIcons: Record<AntiPatternSeverity, typeof FiAlertCircle> = {
  ERROR: FiAlertCircle,
  WARNING: FiAlertTriangle,
  INFO: FiInfo,
}
const severityColors: Record<AntiPatternSeverity, 'danger' | 'warning' | 'primary'> = {
  ERROR: 'danger',
  WARNING: 'warning',
  INFO: 'primary',
}

export function AntiPatternOverlay({ patterns, isOpen, onClose }: AntiPatternOverlayProps) {
  const grouped = severityOrder.reduce(
    (acc, sev) => {
      acc[sev] = patterns.filter(p => p.severity === sev)
      return acc
    },
    {} as Record<AntiPatternSeverity, AntiPatternDetected[]>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={fadeSlideUp}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-2xl p-4"
        >
          <Card className="shadow-lg">
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiAlertTriangle className="text-warning" />
                <span className="font-semibold">
                  Anti-Pattern Findings ({patterns.length})
                </span>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-default-100 rounded">
                <FiX size={18} />
              </button>
            </CardHeader>
            <Divider />
            <CardBody className="max-h-80 overflow-y-auto space-y-3">
              {severityOrder.map(severity => {
                const items = grouped[severity]
                if (items.length === 0) return null
                const Icon = severityIcons[severity]
                return (
                  <div key={severity}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={14} />
                      <span className="text-sm font-medium">
                        {severityLabels[severity]} ({items.length})
                      </span>
                    </div>
                    {items.map((pattern, i) => (
                      <Card key={i} className="mb-2" shadow="none" isBlurred>
                        <CardBody className="py-2 px-3">
                          <div className="flex items-start gap-2">
                            <Chip
                              size="sm"
                              variant="flat"
                              color={severityColors[severity]}
                            >
                              {pattern.patternType.replace(/_/g, ' ')}
                            </Chip>
                          </div>
                          <p className="text-sm text-default-600 mt-1">
                            {pattern.description}
                          </p>
                          <AntiPatternSuggestion suggestion={pattern.suggestion} />
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                )
              })}
            </CardBody>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

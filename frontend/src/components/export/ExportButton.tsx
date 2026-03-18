import { useCallback, useState, type RefObject } from 'react'
import { Button } from '@heroui/react'
import { FiCamera } from 'react-icons/fi'
import { exportToPng } from '@/lib/export-png'

interface ExportButtonProps {
  /** Ref to the DOM element that should be captured */
  targetRef: RefObject<HTMLElement | null>
  /** Optional custom filename for the downloaded PNG */
  filename?: string
  /** Optional className for the button */
  className?: string
}

export function ExportButton({ targetRef, filename, className }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = useCallback(async () => {
    if (!targetRef.current) return

    setIsExporting(true)
    try {
      await exportToPng(targetRef.current, filename)
    } catch (error) {
      console.error('PNG export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }, [targetRef, filename])

  return (
    <Button
      size="sm"
      variant="flat"
      className={className}
      isLoading={isExporting}
      onPress={handleExport}
      startContent={!isExporting ? <FiCamera /> : undefined}
      aria-label="Export as PNG"
    >
      Export PNG
    </Button>
  )
}

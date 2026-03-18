import { useState, useEffect } from 'react'

/**
 * Hook to detect forced-colors (Windows High Contrast) mode.
 */
export function useHighContrast(): boolean {
  const [isHighContrast, setIsHighContrast] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(forced-colors: active)').matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(forced-colors: active)')

    const handleChange = (event: MediaQueryListEvent) => {
      setIsHighContrast(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return isHighContrast
}

/**
 * Returns Tailwind classes adjusted for high contrast mode.
 * Replaces subtle color differences with solid borders/backgrounds.
 */
export function useHighContrastClasses(classes: {
  normal: string
  highContrast: string
}): string {
  const isHighContrast = useHighContrast()
  return isHighContrast ? classes.highContrast : classes.normal
}

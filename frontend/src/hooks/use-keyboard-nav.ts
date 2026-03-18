import { useState, useCallback, useMemo } from 'react'
import type React from 'react'

interface UseKeyboardNavOptions {
  itemCount: number
  onSelect?: (index: number) => void
  orientation?: 'vertical' | 'horizontal'
}

interface ItemProps {
  tabIndex: number
  role: string
  'aria-selected': boolean
  onKeyDown: (e: React.KeyboardEvent) => void
  onFocus: () => void
}

interface ListProps {
  role: string
  'aria-label': string
  'aria-activedescendant'?: string
}

interface UseKeyboardNavReturn {
  activeIndex: number
  setActiveIndex: (index: number) => void
  getItemProps: (index: number) => ItemProps
  listProps: ListProps
}

/**
 * Enables keyboard navigation for list-like components.
 * Arrow Up/Down (or Left/Right for horizontal) moves focus, Enter activates, Escape blurs.
 */
export function useKeyboardNav(options: UseKeyboardNavOptions): UseKeyboardNavReturn {
  const { itemCount, onSelect, orientation = 'vertical' } = options
  const [activeIndex, setActiveIndex] = useState(-1)

  const handleKeyDown = useCallback(
    (index: number) => (e: React.KeyboardEvent) => {
      const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
      const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'

      switch (e.key) {
        case nextKey: {
          e.preventDefault()
          const next = Math.min(index + 1, itemCount - 1)
          setActiveIndex(next)
          const nextEl = (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)
          nextEl?.focus()
          break
        }
        case prevKey: {
          e.preventDefault()
          const prev = Math.max(index - 1, 0)
          setActiveIndex(prev)
          const prevEl = (e.currentTarget.parentElement?.children[prev] as HTMLElement | undefined)
          prevEl?.focus()
          break
        }
        case 'Home': {
          e.preventDefault()
          setActiveIndex(0)
          const firstEl = (e.currentTarget.parentElement?.children[0] as HTMLElement | undefined)
          firstEl?.focus()
          break
        }
        case 'End': {
          e.preventDefault()
          const lastIdx = itemCount - 1
          setActiveIndex(lastIdx)
          const lastEl = (e.currentTarget.parentElement?.children[lastIdx] as HTMLElement | undefined)
          lastEl?.focus()
          break
        }
        case 'Enter':
        case ' ': {
          e.preventDefault()
          onSelect?.(index)
          break
        }
        case 'Escape': {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).blur()
          setActiveIndex(-1)
          break
        }
      }
    },
    [itemCount, onSelect, orientation],
  )

  const getItemProps = useCallback(
    (index: number): ItemProps => ({
      tabIndex: index === activeIndex || (activeIndex === -1 && index === 0) ? 0 : -1,
      role: 'option',
      'aria-selected': index === activeIndex,
      onKeyDown: handleKeyDown(index),
      onFocus: () => setActiveIndex(index),
    }),
    [activeIndex, handleKeyDown],
  )

  const listProps: ListProps = useMemo(
    () => ({
      role: 'listbox',
      'aria-label': 'Navigable list',
      ...(activeIndex >= 0 ? { 'aria-activedescendant': `item-${activeIndex}` } : {}),
    }),
    [activeIndex],
  )

  return { activeIndex, setActiveIndex, getItemProps, listProps }
}

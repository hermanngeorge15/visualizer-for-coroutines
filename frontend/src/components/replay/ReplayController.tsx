/**
 * ReplayController — control bar for event replay
 *
 * Provides play/pause, step-through, reset, speed selector,
 * a progress slider, and event counter.
 */

import { Button, Slider, ButtonGroup, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react'
import { motion } from 'framer-motion'
import { FiPlay, FiPause, FiSkipBack, FiSkipForward, FiRotateCcw } from 'react-icons/fi'
import type { UseReplayReturn } from '@/hooks/use-replay'

interface ReplayControllerProps {
  replay: UseReplayReturn
}

const SPEED_OPTIONS = [
  { key: '0.5', label: '0.5x' },
  { key: '1', label: '1x' },
  { key: '2', label: '2x' },
  { key: '5', label: '5x' },
]

export function ReplayController({ replay }: ReplayControllerProps) {
  const {
    isPlaying,
    currentIndex,
    speed,
    progress,
    totalEvents,
    play,
    pause,
    stepForward,
    stepBack,
    reset,
    seekTo,
    setSpeed,
  } = replay

  const isEmpty = totalEvents === 0

  return (
    <motion.div
      className="flex flex-col gap-3 rounded-lg bg-content1 p-4 shadow-sm"
      data-testid="replay-controller"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Progress slider */}
      <div className="flex items-center gap-3">
        <Slider
          aria-label="Replay progress"
          size="sm"
          step={1}
          minValue={0}
          maxValue={Math.max(totalEvents - 1, 0)}
          value={currentIndex}
          onChange={value => {
            const idx = Array.isArray(value) ? value[0] ?? 0 : value
            seekTo(idx)
          }}
          isDisabled={isEmpty}
          className="flex-1"
          color="primary"
        />
        <span className="min-w-[100px] text-right font-mono text-xs text-default-500">
          Event {isEmpty ? 0 : currentIndex + 1} / {totalEvents}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <ButtonGroup size="sm" variant="flat">
          <Button
            isIconOnly
            aria-label="Reset"
            onPress={reset}
            isDisabled={isEmpty}
          >
            <FiRotateCcw className="h-4 w-4" />
          </Button>
          <Button
            isIconOnly
            aria-label="Step back"
            onPress={stepBack}
            isDisabled={isEmpty || currentIndex === 0}
          >
            <FiSkipBack className="h-4 w-4" />
          </Button>
          <Button
            isIconOnly
            aria-label={isPlaying ? 'Pause' : 'Play'}
            color="primary"
            onPress={isPlaying ? pause : play}
            isDisabled={isEmpty}
          >
            {isPlaying ? (
              <FiPause className="h-4 w-4" />
            ) : (
              <FiPlay className="h-4 w-4" />
            )}
          </Button>
          <Button
            isIconOnly
            aria-label="Step forward"
            onPress={stepForward}
            isDisabled={isEmpty || currentIndex >= totalEvents - 1}
          >
            <FiSkipForward className="h-4 w-4" />
          </Button>
        </ButtonGroup>

        {/* Speed selector */}
        <Dropdown>
          <DropdownTrigger>
            <Button size="sm" variant="bordered">
              {speed}x
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Playback speed"
            selectionMode="single"
            selectedKeys={new Set([String(speed)])}
            onSelectionChange={keys => {
              const selected = Array.from(keys)[0]
              if (selected) setSpeed(Number(selected))
            }}
          >
            {SPEED_OPTIONS.map(opt => (
              <DropdownItem key={opt.key}>{opt.label}</DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
      </div>

      {/* Progress indicator bar (visual only) */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-default-200">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

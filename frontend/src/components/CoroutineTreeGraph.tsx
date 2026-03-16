import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { Button, Chip } from '@heroui/react'
import type { CoroutineNode } from '@/types/api'
import { buildCoroutineTree } from '@/lib/utils'
import { FiCircle, FiCheckCircle, FiXCircle, FiLoader, FiClock, FiPause, FiAlertCircle, FiZoomIn, FiZoomOut, FiMaximize, FiLock, FiUnlock } from 'react-icons/fi'

interface CoroutineTreeGraphProps {
  coroutines: CoroutineNode[]
}

interface TreeNode extends CoroutineNode {
  children: TreeNode[]
}

// Helper function to check if a coroutine is running
const isRunning = (state: string) => state === 'ACTIVE' || state === 'WAITING_FOR_CHILDREN'

export function CoroutineTreeGraph({ coroutines }: CoroutineTreeGraphProps) {
  const tree = useMemo(() => buildCoroutineTree(coroutines), [coroutines])
  const activeCount = useMemo(
    () => coroutines.filter(c => isRunning(c.state)).length,
    [coroutines]
  )
  const [isLocked, setIsLocked] = useState(true)

  if (coroutines.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-default-400">
        No coroutines in this session yet.
      </div>
    )
  }

  return (
    <div className="relative min-h-[600px] w-full border border-default-200 rounded-lg bg-default-50">
      <TransformWrapper
        initialScale={1}
        minScale={0.3}
        maxScale={2}
        centerOnInit
        limitToBounds={false}
        panning={{ disabled: isLocked }}
        wheel={{ step: 0.1, disabled: isLocked }}
        doubleClick={{ disabled: isLocked }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* Pan/Zoom Controls */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              {/* Lock/Unlock Button */}
              <Button
                isIconOnly
                size="sm"
                variant={isLocked ? 'flat' : 'solid'}
                color={isLocked ? 'warning' : 'success'}
                onPress={() => setIsLocked(!isLocked)}
                title={isLocked ? 'Unlock Pan/Zoom' : 'Lock Pan/Zoom'}
              >
                {isLocked ? <FiLock /> : <FiUnlock />}
              </Button>
              
              {/* Divider */}
              <div className="w-px bg-default-300" />
              
              {/* Zoom Controls */}
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={() => zoomIn()}
                isDisabled={isLocked}
                title="Zoom In"
              >
                <FiZoomIn />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={() => zoomOut()}
                isDisabled={isLocked}
                title="Zoom Out"
              >
                <FiZoomOut />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={() => resetTransform()}
                isDisabled={isLocked}
                title="Reset View"
              >
                <FiMaximize />
              </Button>
            </div>

            {/* Top-left indicators */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
              {/* Real-time activity indicator */}
              {activeCount > 0 && (
                <motion.div
                  className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary backdrop-blur-sm"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <motion.div
                    className="h-2 w-2 rounded-full bg-primary"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [1, 0.5, 1],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                  <span>{activeCount} coroutine{activeCount > 1 ? 's' : ''} actively running</span>
                </motion.div>
              )}
              
              {/* Lock status indicator */}
              <AnimatePresence>
                {isLocked && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <Chip
                      startContent={<FiLock />}
                      variant="flat"
                      color="warning"
                      size="sm"
                      className="backdrop-blur-sm"
                    >
                      Pan/Zoom Locked
                    </Chip>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%', minHeight: '600px' }}
              contentStyle={{ width: '100%', height: '100%' }}
            >
              <div className="flex flex-col items-center gap-16 p-8 min-h-[600px]">
                <AnimatePresence mode="popLayout" initial={false}>
                  {tree.map((node, index) => (
                    <TreeNodeComponent 
                      key={node.id} 
                      node={node} 
                      isRoot 
                      level={0} 
                      siblingIndex={index} 
                    />
                  ))}
                </AnimatePresence>
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}

interface TreeNodeComponentProps {
  node: TreeNode
  isRoot?: boolean
  level: number
  siblingIndex: number
}

function TreeNodeComponent({ node, isRoot = false, level, siblingIndex }: TreeNodeComponentProps) {
  const stateConfig = getStateConfig(node.state)
  const hasChildren = node.children.length > 0
  const parentConfig = getStateConfig(node.state)

  return (
    <div className="flex flex-col items-center">
      {/* Connection line from parent - simplified */}
      {!isRoot && (
        <div className="relative flex flex-col items-center">
          <motion.div
            className={`h-12 w-0.5 ${parentConfig.lineColor} rounded-full`}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: level * 0.1, duration: 0.3 }}
          />
          {/* Animated flow particles for running states */}
          {isRunning(node.state) && (
            <motion.div
              className="absolute left-1/2 h-1.5 w-1.5 rounded-full bg-primary"
              style={{ marginLeft: '-3px' }}
              animate={{
                y: [0, 48],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: node.state === 'WAITING_FOR_CHILDREN' ? 2.5 : 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
        </div>
      )}

      {/* Node Card */}
      <motion.div
        key={`wrapper-${node.id}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{
          delay: level * 0.1 + siblingIndex * 0.05,
          type: 'spring',
          stiffness: 200,
          damping: 20,
        }}
        className="relative z-10"
      >
        <motion.div
          key={`card-${node.id}-${node.state}`}
          className={`
            relative rounded-2xl border-2 bg-content1 p-6 shadow-lg
            transition-all hover:shadow-2xl
            ${stateConfig.borderColor}
          `}
          whileHover={{ scale: 1.05 }}
          initial={false}
          animate={
            isRunning(node.state)
              ? {
                  boxShadow: [
                    '0 10px 40px -12px rgba(99, 102, 241, 0.3)',
                    '0 10px 40px -12px rgba(99, 102, 241, 0.6)',
                    '0 10px 40px -12px rgba(99, 102, 241, 0.3)',
                  ],
                }
              : {}
          }
          transition={
            isRunning(node.state)
              ? {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
              : {}
          }
          style={{ minWidth: '280px' }}
        >
          {/* Animated Background for Running States */}
          <AnimatePresence>
            {isRunning(node.state) && (
              <motion.div
                className="absolute inset-0 rounded-2xl bg-primary/5"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: node.state === 'WAITING_FOR_CHILDREN' ? [0.2, 0.4, 0.2] : [0.3, 0.6, 0.3],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: node.state === 'WAITING_FOR_CHILDREN' ? 3 : 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}
          </AnimatePresence>

          <div className="relative z-10">
            {/* Header with Icon and Label */}
            <div className="mb-3 flex items-center gap-3">
              <motion.div
                key={`icon-${node.id}-${node.state}`}
                className={`${stateConfig.iconColor} flex h-10 w-10 items-center justify-center rounded-full ${stateConfig.iconBg}`}
                initial={false}
                animate={
                  node.state === 'ACTIVE'
                    ? {
                        rotate: 360,
                        scale: [1, 1.1, 1],
                      }
                    : node.state === 'WAITING_FOR_CHILDREN'
                    ? {
                        scale: [1, 1.15, 1],
                      }
                    : {}
                }
                transition={
                  node.state === 'ACTIVE'
                    ? {
                        rotate: { duration: 2, repeat: Infinity, ease: 'linear' },
                        scale: { duration: 1, repeat: Infinity, ease: 'easeInOut' },
                      }
                    : node.state === 'WAITING_FOR_CHILDREN'
                    ? {
                        scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                      }
                    : {}
                }
              >
                {stateConfig.icon}
              </motion.div>
              <div className="flex-1">
                <div className="text-lg font-bold">{node.label || node.id}</div>
                <div className="text-xs text-default-500">
                  {node.state}
                  {node.state === 'ACTIVE' && (
                    <motion.span
                      className="ml-2 inline-block"
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      ●
                    </motion.span>
                  )}
                </div>
              </div>
            </div>

            {/* Details */}
            <AnimatePresence mode="wait">
              <motion.div 
                className="space-y-1 text-sm"
                key={node.state}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2 text-default-600">
                  <span className="font-semibold">ID:</span>
                  <span className="font-mono text-xs">{node.id}</span>
                </div>
                <div className="flex items-center gap-2 text-default-600">
                  <span className="font-semibold">Job:</span>
                  <span className="font-mono text-xs">{node.jobId}</span>
                </div>
                <div className="flex items-center gap-2 text-default-600">
                  <span className="font-semibold">Scope:</span>
                  <span className="font-mono text-xs">{node.scopeId}</span>
                </div>
                {node.parentId && (
                  <div className="flex items-center gap-2 text-default-600">
                    <span className="font-semibold">Parent:</span>
                    <span className="font-mono text-xs">{node.parentId}</span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Progress Bar for Active State */}
            <AnimatePresence>
              {node.state === 'ACTIVE' && (
                <motion.div 
                  className="mt-3 h-1 overflow-hidden rounded-full bg-default-200"
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  exit={{ opacity: 0, scaleX: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    className="h-full bg-primary"
                    animate={{
                      x: ['-100%', '100%'],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    style={{ width: '50%' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>

      {/* Children */}
      {hasChildren && (
        <>
          {node.children.length === 1 ? (
            /* Single child - simple vertical connection */
            <>
              <div className="relative flex flex-col items-center">
                <motion.div
                  className={`h-16 w-0.5 ${stateConfig.lineColor} rounded-full`}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: (level + 1) * 0.1, duration: 0.3 }}
                />
                {/* Relationship label */}
                <motion.div
                  className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-default-100/80 backdrop-blur-sm px-3 py-1 text-xs font-medium text-default-700 border border-default-200"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (level + 1) * 0.1 + 0.3 }}
                >
                  1 child
                </motion.div>
                {/* Animated flow particles */}
                {(node.state === 'ACTIVE' || node.state === 'WAITING_FOR_CHILDREN') && (
                  <motion.div
                    className="absolute left-1/2 h-1.5 w-1.5 rounded-full bg-primary"
                    style={{ marginLeft: '-3px' }}
                    animate={{
                      y: [0, 64],
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: 0.5,
                    }}
                  />
                )}
              </div>
              <TreeNodeComponent
                key={node.children[0].id}
                node={node.children[0]}
                level={level + 1}
                siblingIndex={0}
              />
            </>
          ) : (
            /* Multiple children - branching structure */
            <>
              {/* Main connector line down from parent */}
              <div className="relative flex flex-col items-center">
                <motion.div
                  className={`h-8 w-0.5 ${stateConfig.lineColor} rounded-full`}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: (level + 1) * 0.1, duration: 0.3 }}
                />
                {/* Relationship label */}
                <motion.div
                  className="absolute left-full ml-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-default-100/80 backdrop-blur-sm px-3 py-1 text-xs font-medium text-default-700 border border-default-200"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (level + 1) * 0.1 + 0.3 }}
                >
                  {node.children.length} children
                </motion.div>
              </div>

              {/* Branching structure */}
              <div className="relative flex flex-col items-center" style={{ width: `${node.children.length * 320}px` }}>
                {/* Horizontal line connecting to all children */}
                <motion.div
                  className="relative w-full h-0.5 bg-default-300 rounded-full"
                  style={{ 
                    width: `${(node.children.length - 1) * 320}px`,
                  }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: (level + 1) * 0.1 + 0.2, duration: 0.4 }}
                />
                
                {/* Junction point at center */}
                <motion.div
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-default-400"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: (level + 1) * 0.1 + 0.3, type: 'spring' }}
                />
                
                {/* Vertical lines down to each child */}
                <div className="relative w-full h-16 flex">
                  {node.children.map((child, i) => (
                    <div key={i} className="flex-1 flex justify-center relative">
                      <motion.div
                        className={`w-0.5 h-16 ${getStateConfig(child.state).lineColor} rounded-full`}
                        initial={{ scaleY: 0, transformOrigin: 'top' }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: (level + 1) * 0.1 + 0.4 + i * 0.05 }}
                      />
                      {/* Flow animation for active children */}
                      {(child.state === 'ACTIVE' || child.state === 'WAITING_FOR_CHILDREN') && (
                        <motion.div
                          className="absolute top-0 left-1/2 h-1.5 w-1.5 rounded-full bg-primary"
                          style={{ marginLeft: '-3px' }}
                          animate={{
                            y: [0, 64],
                            opacity: [0, 1, 0],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: i * 0.3,
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Child nodes */}
              <div className="flex gap-8" style={{ width: `${node.children.length * 320}px` }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  {node.children.map((child, index) => (
                    <div key={child.id} className="flex-1 flex justify-center">
                      <TreeNodeComponent
                        node={child}
                        level={level + 1}
                        siblingIndex={index}
                      />
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function getStateConfig(state: string) {
  switch (state) {
    case 'CREATED':
      return {
        icon: <FiCircle className="h-5 w-5" />,
        iconColor: 'text-default-600',
        iconBg: 'bg-default-100',
        borderColor: 'border-default-300',
        lineColor: 'bg-default-300',
        arrowBg: 'bg-default-200',
        branchBg: 'bg-default-300',
      }
    case 'ACTIVE':
      return {
        icon: <FiLoader className="h-5 w-5" />,
        iconColor: 'text-primary',
        iconBg: 'bg-primary/10',
        borderColor: 'border-primary',
        lineColor: 'bg-primary/40',
        arrowBg: 'bg-primary/20',
        branchBg: 'bg-primary/40',
      }
    case 'SUSPENDED':
      return {
        icon: <FiPause className="h-5 w-5" />,
        iconColor: 'text-secondary',
        iconBg: 'bg-secondary/10',
        borderColor: 'border-secondary',
        lineColor: 'bg-secondary/40',
        arrowBg: 'bg-secondary/20',
        branchBg: 'bg-secondary/40',
      }
    case 'WAITING_FOR_CHILDREN':
      return {
        icon: <FiClock className="h-5 w-5" />,
        iconColor: 'text-primary',
        iconBg: 'bg-primary/10',
        borderColor: 'border-primary/60',
        lineColor: 'bg-primary/30',
        arrowBg: 'bg-primary/15',
        branchBg: 'bg-primary/30',
      }
    case 'COMPLETED':
      return {
        icon: <FiCheckCircle className="h-5 w-5" />,
        iconColor: 'text-success',
        iconBg: 'bg-success/10',
        borderColor: 'border-success',
        lineColor: 'bg-success/40',
        arrowBg: 'bg-success/20',
        branchBg: 'bg-success/40',
      }
    case 'CANCELLED':
      return {
        icon: <FiXCircle className="h-5 w-5" />,
        iconColor: 'text-warning',
        iconBg: 'bg-warning/10',
        borderColor: 'border-warning',
        lineColor: 'bg-warning/40',
        arrowBg: 'bg-warning/20',
        branchBg: 'bg-warning/40',
      }
    case 'FAILED':
      return {
        icon: <FiAlertCircle className="h-5 w-5" />,
        iconColor: 'text-danger',
        iconBg: 'bg-danger/10',
        borderColor: 'border-danger',
        lineColor: 'bg-danger/40',
        arrowBg: 'bg-danger/20',
        branchBg: 'bg-danger/40',
      }
    default:
      return {
        icon: <FiCircle className="h-5 w-5" />,
        iconColor: 'text-default-600',
        iconBg: 'bg-default-100',
        borderColor: 'border-default-300',
        lineColor: 'bg-default-300',
        arrowBg: 'bg-default-200',
        branchBg: 'bg-default-300',
      }
  }
}


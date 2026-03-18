package com.jh.proj.coroutineviz.validation

import com.jh.proj.coroutineviz.session.VizSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory

/**
 * Subscribes to the EventBus and runs validation rules on debounced event batches.
 * Findings are emitted as ValidationFindingEmitted events via VizSession.send()
 * (which assigns proper seq numbers).
 *
 * IMPORTANT: Filters out ValidationFindingEmitted events from the input stream
 * to avoid an infinite feedback loop (validator emits finding → finding triggers
 * validator → validator emits finding → ...).
 */
class RealTimeValidator(
    private val registry: ValidationRuleRegistry,
    private val session: VizSession,
    private val scope: CoroutineScope,
) {
    private val logger = LoggerFactory.getLogger(RealTimeValidator::class.java)
    private var job: Job? = null

    // Track previously emitted findings to avoid re-emitting duplicates
    private val emittedFindingKeys = mutableSetOf<String>()

    /**
     * Start real-time validation. Runs rules on debounced event batches.
     */
    @OptIn(FlowPreview::class)
    fun start() {
        if (job?.isActive == true) return

        job =
            scope.launch {
                session.eventBus.stream()
                    // Filter out our own output to prevent infinite loop
                    .filter { it !is ValidationFindingEmitted }
                    .debounce(500)
                    .map { _ ->
                        val events = session.store.all()
                        registry.validateAll(events)
                    }
                    .collect { findings ->
                        if (findings.isNotEmpty()) {
                            // Only emit findings we haven't emitted before
                            val newFindings =
                                findings.filter { finding ->
                                    val key = "${finding.ruleId}:${finding.coroutineId}:${finding.message}"
                                    emittedFindingKeys.add(key) // returns false if already present
                                }

                            if (newFindings.isNotEmpty()) {
                                logger.debug("Real-time validation: ${newFindings.size} new findings for session ${session.sessionId}")
                                for (finding in newFindings) {
                                    // Use session.send() to get proper seq assignment
                                    session.send(
                                        ValidationFindingEmitted(
                                            sessionId = session.sessionId,
                                            seq = session.nextSeq(),
                                            tsNanos = System.nanoTime(),
                                            finding = finding,
                                        ),
                                    )
                                }
                            }
                        }
                    }
            }
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    fun reset() {
        emittedFindingKeys.clear()
    }
}

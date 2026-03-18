package com.jh.proj.coroutineviz.wrappers

import com.jh.proj.coroutineviz.events.SelectClauseRegistered
import com.jh.proj.coroutineviz.events.SelectClauseWon
import com.jh.proj.coroutineviz.events.SelectCompleted
import com.jh.proj.coroutineviz.events.SelectStarted
import com.jh.proj.coroutineviz.session.VizSession
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.selects.SelectBuilder
import kotlinx.coroutines.selects.select

/**
 * Instrumented wrapper for Kotlin's `select` expression that emits visualization events.
 *
 * Tracks the lifecycle of a select expression:
 * 1. [SelectStarted] — when the select begins evaluation
 * 2. [SelectClauseRegistered] — for each clause registered in the select block
 * 3. [SelectClauseWon] — when a clause wins the race
 * 4. [SelectCompleted] — when the select finishes
 *
 * Usage via VizScope extension:
 * ```kotlin
 * val result = scope.vizSelect<String> {
 *     channel1.onReceive { value ->
 *         registerClause("onReceive", channelId = instrumentedChannel.channelId)
 *         "Got from channel1: $value"
 *     }
 *     channel2.onReceive { value ->
 *         registerClause("onReceive", channelId = instrumentedChannel2.channelId)
 *         "Got from channel2: $value"
 *     }
 * }
 * ```
 *
 * @param session The visualization session for emitting events
 */
class VizSelect(private val session: VizSession) {
    val selectId: String = "select-${session.nextSeq()}"

    /**
     * Execute an instrumented select expression.
     *
     * The [block] receives a [VizSelectBuilder] that wraps the real [SelectBuilder],
     * allowing clause registration events to be emitted alongside the actual select logic.
     *
     * @param coroutineId ID of the coroutine executing the select
     * @param block The select builder block that registers clauses and returns a result
     * @return The result of the winning clause
     */
    suspend fun <R> vizSelect(
        coroutineId: String,
        block: VizSelectBuilder<R>.() -> Unit,
    ): R {
        val startNanos = System.nanoTime()
        val builder = VizSelectBuilder<R>(session, selectId, coroutineId)

        // Emit SelectStarted (clauseCount will be updated after registration)
        val startedEvent =
            SelectStarted(
                sessionId = session.sessionId,
                seq = session.nextSeq(),
                tsNanos = startNanos,
                selectId = selectId,
                coroutineId = coroutineId,
                clauseCount = 0,
            )
        session.send(startedEvent)

        val selectStartNanos = System.nanoTime()

        // Execute the actual kotlinx.coroutines select with the instrumented builder
        val result =
            select<R> {
                builder.selectBuilder = this
                builder.block()
            }

        val endNanos = System.nanoTime()

        // Emit SelectClauseWon for the winning clause
        val winnerInfo = builder.winnerClause
        if (winnerInfo != null) {
            session.send(
                SelectClauseWon(
                    sessionId = session.sessionId,
                    seq = session.nextSeq(),
                    tsNanos = endNanos,
                    selectId = selectId,
                    coroutineId = coroutineId,
                    winnerClauseIndex = winnerInfo.index,
                    winnerClauseType = winnerInfo.type,
                    waitDurationNanos = endNanos - selectStartNanos,
                ),
            )
        }

        // Emit SelectCompleted
        session.send(
            SelectCompleted(
                sessionId = session.sessionId,
                seq = session.nextSeq(),
                tsNanos = endNanos,
                selectId = selectId,
                coroutineId = coroutineId,
                totalDurationNanos = endNanos - startNanos,
            ),
        )

        return result
    }
}

/**
 * Builder DSL for instrumented select expressions.
 *
 * This builder wraps the real [SelectBuilder] and provides a [registerClause] method
 * to emit [SelectClauseRegistered] events for each clause. The caller is responsible
 * for calling [registerClause] inside each clause handler to record which clause won.
 *
 * @param R The result type of the select expression
 * @param session The visualization session
 * @param selectId The unique ID of the select expression
 * @param coroutineId The coroutine executing the select
 */
class VizSelectBuilder<R>(
    private val session: VizSession,
    private val selectId: String,
    private val coroutineId: String,
) {
    /**
     * The underlying kotlinx.coroutines [SelectBuilder].
     * Use this to register actual select clauses (onReceive, onSend, onAwait, etc.).
     *
     * Example:
     * ```kotlin
     * select.onReceive(channel) { value -> ... }
     * ```
     *
     * Set internally by [VizSelect.vizSelect] before the block runs.
     */
    lateinit var select: SelectBuilder<R>
        internal set

    // Internal alias used by VizSelect to set the builder
    internal var selectBuilder: SelectBuilder<R>
        get() = select
        set(value) {
            select = value
        }

    private val clauses = mutableListOf<ClauseInfo>()

    /**
     * The clause that won the select race. Set by [registerClause] when called
     * inside the winning clause's handler.
     */
    @Volatile
    internal var winnerClause: ClauseInfo? = null

    /**
     * Information about a registered select clause.
     */
    data class ClauseInfo(
        val index: Int,
        val type: String,
        val channelId: String?,
        val deferredId: String?,
        val timeoutMillis: Long?,
        val label: String?,
    )

    /**
     * Register a clause in the select expression and emit a [SelectClauseRegistered] event.
     *
     * Call this inside each clause handler (e.g., inside `onReceive { }`, `onAwait { }`) to
     * track which clauses are part of the select and which one eventually wins.
     *
     * @param type The clause type: "onReceive", "onSend", "onAwait", "onTimeout", "onJoin"
     * @param channelId Channel ID for onReceive/onSend clauses
     * @param deferredId Deferred ID for onAwait clauses
     * @param timeoutMillis Timeout for onTimeout clauses
     * @param label Optional human-readable label
     * @return The clause index (0-based)
     */
    fun registerClause(
        type: String,
        channelId: String? = null,
        deferredId: String? = null,
        timeoutMillis: Long? = null,
        label: String? = null,
    ): Int {
        val index = clauses.size
        val info =
            ClauseInfo(
                index = index,
                type = type,
                channelId = channelId,
                deferredId = deferredId,
                timeoutMillis = timeoutMillis,
                label = label,
            )
        clauses.add(info)

        // Emit clause registration event
        session.send(
            SelectClauseRegistered(
                sessionId = session.sessionId,
                seq = session.nextSeq(),
                tsNanos = System.nanoTime(),
                selectId = selectId,
                coroutineId = coroutineId,
                clauseIndex = index,
                clauseType = type,
                channelId = channelId,
                deferredId = deferredId,
                timeoutMillis = timeoutMillis,
                label = label,
            ),
        )

        return index
    }

    /**
     * Mark a clause as the winner of the select race.
     *
     * Call this from inside a clause handler to record which clause actually executed.
     * Only the handler of the winning clause runs, so calling this inside the handler
     * correctly identifies the winner.
     *
     * @param clauseIndex The index returned by [registerClause]
     */
    fun markWinner(clauseIndex: Int) {
        if (clauseIndex in clauses.indices) {
            winnerClause = clauses[clauseIndex]
        }
    }

    /**
     * Convenience: register a clause and immediately mark it as winner.
     *
     * Use this inside the clause handler (which only runs for the winning clause)
     * to both register and mark the clause in a single call.
     *
     * @param type The clause type
     * @param channelId Channel ID for onReceive/onSend clauses
     * @param deferredId Deferred ID for onAwait clauses
     * @param timeoutMillis Timeout for onTimeout clauses
     * @param label Optional human-readable label
     * @return The clause index
     */
    fun clauseWon(
        type: String,
        channelId: String? = null,
        deferredId: String? = null,
        timeoutMillis: Long? = null,
        label: String? = null,
    ): Int {
        val index = registerClause(type, channelId, deferredId, timeoutMillis, label)
        markWinner(index)
        return index
    }

    /**
     * Number of clauses registered so far.
     */
    val clauseCount: Int get() = clauses.size

    /**
     * Get a snapshot of all registered clauses.
     */
    fun registeredClauses(): List<ClauseInfo> = clauses.toList()
}

// ============================================================================
// Extension function for creating instrumented select in VizScope
// ============================================================================

/**
 * Execute an instrumented `select` expression within this VizScope.
 *
 * Wraps Kotlin's [select] to emit visualization events tracking which clauses
 * are registered, which one wins, and the overall timing.
 *
 * The [block] receives a [VizSelectBuilder] whose [VizSelectBuilder.select] property
 * gives access to the real [SelectBuilder]. Register clauses on the real builder
 * and call [VizSelectBuilder.registerClause] to emit tracking events.
 *
 * Usage:
 * ```kotlin
 * val result = scope.vizSelect<String> {
 *     val idx0 = registerClause("onReceive", channelId = ch1.channelId)
 *     select.onReceive(ch1) { value ->
 *         markWinner(idx0)
 *         "Received from ch1: $value"
 *     }
 *     val idx1 = registerClause("onReceive", channelId = ch2.channelId)
 *     select.onReceive(ch2) { value ->
 *         markWinner(idx1)
 *         "Received from ch2: $value"
 *     }
 * }
 * ```
 *
 * Or use the shorthand [VizSelectBuilder.clauseWon] inside the handler:
 * ```kotlin
 * val result = scope.vizSelect<String> {
 *     select.onReceive(ch1) { value ->
 *         clauseWon("onReceive", channelId = ch1.channelId)
 *         "Received: $value"
 *     }
 * }
 * ```
 *
 * @param label Optional label for this select expression (reserved for future use)
 * @param block The select builder block
 * @return The result of the winning clause
 */
suspend fun <R> VizScope.vizSelect(
    label: String? = null,
    block: VizSelectBuilder<R>.() -> Unit,
): R {
    val coroutineElement = currentCoroutineContext()[VizCoroutineElement]
    val coroutineId = coroutineElement?.coroutineId ?: "unknown-${System.nanoTime()}"

    val vizSelect = VizSelect(session)
    return vizSelect.vizSelect(coroutineId, block)
}

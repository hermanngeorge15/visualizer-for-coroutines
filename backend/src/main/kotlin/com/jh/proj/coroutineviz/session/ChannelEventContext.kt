package com.jh.proj.coroutineviz.session

import com.jh.proj.coroutineviz.events.channel.*

/**
 * ChannelEventContext carries common Channel metadata for event creation.
 *
 * This provides extension functions that automatically fill in common fields
 * when emitting Channel-related events, following the same pattern as FlowEventContext.
 *
 * Usage:
 * ```kotlin
 * val ctx = ChannelEventContext(session, channelId, "my-channel", 0, "RENDEZVOUS")
 * session.send(ctx.channelCreated())
 * session.send(ctx.channelSendStarted(coroutineId, "value"))
 * ```
 */
data class ChannelEventContext(
    val session: VizSession,
    val channelId: String,
    val name: String? = null,
    val capacity: Int,
    val channelType: String  // RENDEZVOUS, BUFFERED, CONFLATED, UNLIMITED
) {
    val sessionId: String get() = session.sessionId

    fun nextSeq(): Long = session.nextSeq()
    fun timestamp(): Long = System.nanoTime()
}

// ============================================================================
// Channel Lifecycle Events
// ============================================================================

fun ChannelEventContext.channelCreated(): ChannelCreated = ChannelCreated(
    sessionId = sessionId,
    seq = nextSeq(),
    tsNanos = timestamp(),
    channelId = channelId,
    name = name,
    capacity = capacity,
    channelType = channelType
)

fun ChannelEventContext.channelClosed(
    cause: String? = null
): ChannelClosed = ChannelClosed(
    sessionId = sessionId,
    seq = nextSeq(),
    tsNanos = timestamp(),
    channelId = channelId,
    cause = cause
)

// ============================================================================
// Channel Send Events
// ============================================================================

fun ChannelEventContext.channelSendStarted(
    coroutineId: String,
    valueDescription: String
): ChannelSendStarted = ChannelSendStarted(
    sessionId = sessionId,
    seq = nextSeq(),
    tsNanos = timestamp(),
    channelId = channelId,
    coroutineId = coroutineId,
    valueDescription = valueDescription
)

fun ChannelEventContext.channelSendCompleted(
    coroutineId: String,
    valueDescription: String
): ChannelSendCompleted = ChannelSendCompleted(
    sessionId = sessionId,
    seq = nextSeq(),
    tsNanos = timestamp(),
    channelId = channelId,
    coroutineId = coroutineId,
    valueDescription = valueDescription
)

fun ChannelEventContext.channelSendSuspended(
    coroutineId: String,
    bufferSize: Int
): ChannelSendSuspended = ChannelSendSuspended(
    sessionId = sessionId,
    seq = nextSeq(),
    tsNanos = timestamp(),
    channelId = channelId,
    coroutineId = coroutineId,
    bufferSize = bufferSize,
    capacity = capacity
)

// ============================================================================
// Channel Receive Events
// ============================================================================

fun ChannelEventContext.channelReceiveStarted(
    coroutineId: String
): ChannelReceiveStarted = ChannelReceiveStarted(
    sessionId = sessionId,
    seq = nextSeq(),
    tsNanos = timestamp(),
    channelId = channelId,
    coroutineId = coroutineId
)

fun ChannelEventContext.channelReceiveCompleted(
    coroutineId: String,
    valueDescription: String
): ChannelReceiveCompleted = ChannelReceiveCompleted(
    sessionId = sessionId,
    seq = nextSeq(),
    tsNanos = timestamp(),
    channelId = channelId,
    coroutineId = coroutineId,
    valueDescription = valueDescription
)

fun ChannelEventContext.channelReceiveSuspended(
    coroutineId: String
): ChannelReceiveSuspended = ChannelReceiveSuspended(
    sessionId = sessionId,
    seq = nextSeq(),
    tsNanos = timestamp(),
    channelId = channelId,
    coroutineId = coroutineId
)

// ============================================================================
// Channel Buffer Events
// ============================================================================

fun ChannelEventContext.channelBufferStateChanged(
    currentSize: Int
): ChannelBufferStateChanged = ChannelBufferStateChanged(
    sessionId = sessionId,
    seq = nextSeq(),
    tsNanos = timestamp(),
    channelId = channelId,
    currentSize = currentSize,
    capacity = capacity
)

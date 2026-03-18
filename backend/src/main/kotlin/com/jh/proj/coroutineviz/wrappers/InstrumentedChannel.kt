@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class, kotlinx.coroutines.DelicateCoroutinesApi::class)

package com.jh.proj.coroutineviz.wrappers

import com.jh.proj.coroutineviz.events.channel.*
import com.jh.proj.coroutineviz.session.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.ChannelIterator
import kotlinx.coroutines.channels.ChannelResult
import kotlinx.coroutines.channels.SendChannel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.selects.SelectClause1
import kotlinx.coroutines.selects.SelectClause2
import org.slf4j.LoggerFactory
import java.util.concurrent.atomic.AtomicInteger

/**
 * InstrumentedChannel wraps a kotlinx.coroutines Channel to emit visualization events.
 *
 * Features:
 * - Tracks all send operations with suspension detection
 * - Tracks all receive operations with suspension detection
 * - Monitors buffer state changes
 * - Tracks channel close
 *
 * @param T The type of values transmitted through the channel
 * @param delegate The underlying Channel
 * @param session The VizSession for event tracking
 * @param channelId Unique identifier for this Channel
 * @param name Optional human-readable name
 * @param capacity The buffer capacity of the channel
 * @param channelType Type string: RENDEZVOUS, BUFFERED, CONFLATED, UNLIMITED
 */
class InstrumentedChannel<T>(
    private val delegate: Channel<T>,
    private val session: VizSession,
    val channelId: String,
    val name: String? = null,
    private val capacity: Int,
    private val channelType: String,
) : Channel<T> {
    private val bufferCount = AtomicInteger(0)

    private val ctx: ChannelEventContext by lazy {
        ChannelEventContext(
            session = session,
            channelId = channelId,
            name = name,
            capacity = capacity,
            channelType = channelType,
        )
    }

    init {
        session.send(
            ctx.channelCreated(),
        )
        logger.debug("Channel created: channelId=$channelId, type=$channelType, capacity=$capacity")
    }

    // ========================================================================
    // SendChannel implementation
    // ========================================================================

    override val isClosedForSend: Boolean
        get() = delegate.isClosedForSend

    override suspend fun send(element: T) {
        val coroutineId = currentCoroutineContext()[VizCoroutineElement]?.coroutineId ?: "unknown"
        val valueDesc = element?.toString()?.take(200) ?: "null"

        session.send(ctx.channelSendStarted(coroutineId, valueDesc))

        delegate.send(element)

        val currentSize = bufferCount.incrementAndGet()
        session.send(ctx.channelBufferStateChanged(currentSize))
        session.send(ctx.channelSendCompleted(coroutineId, valueDesc))

        logger.trace("Channel send completed: channelId=$channelId, value=$valueDesc")
    }

    override fun trySend(element: T): ChannelResult<Unit> {
        val result = delegate.trySend(element)
        if (result.isSuccess) {
            val currentSize = bufferCount.incrementAndGet()
            val coroutineId =
                runCatching {
                    kotlinx.coroutines.runBlocking {
                        currentCoroutineContext()[VizCoroutineElement]?.coroutineId
                    }
                }.getOrNull() ?: "unknown"
            val valueDesc = element?.toString()?.take(200) ?: "null"

            session.send(ctx.channelSendStarted(coroutineId, valueDesc))
            session.send(ctx.channelBufferStateChanged(currentSize))
            session.send(ctx.channelSendCompleted(coroutineId, valueDesc))
        }
        return result
    }

    override fun close(cause: Throwable?): Boolean {
        val result = delegate.close(cause)
        if (result) {
            session.send(ctx.channelClosed(cause?.message))
            logger.debug("Channel closed: channelId=$channelId, cause=${cause?.message}")
        }
        return result
    }

    override fun invokeOnClose(handler: (cause: Throwable?) -> Unit) {
        delegate.invokeOnClose(handler)
    }

    override val onSend: SelectClause2<T, SendChannel<T>>
        get() = delegate.onSend

    // ========================================================================
    // ReceiveChannel implementation
    // ========================================================================

    override val isClosedForReceive: Boolean
        get() = delegate.isClosedForReceive

    override val isEmpty: Boolean
        get() = delegate.isEmpty

    override suspend fun receive(): T {
        val coroutineId = currentCoroutineContext()[VizCoroutineElement]?.coroutineId ?: "unknown"

        session.send(ctx.channelReceiveStarted(coroutineId))

        val value = delegate.receive()

        val currentSize = bufferCount.decrementAndGet().coerceAtLeast(0)
        session.send(ctx.channelBufferStateChanged(currentSize))

        val valueDesc = value?.toString()?.take(200) ?: "null"
        session.send(ctx.channelReceiveCompleted(coroutineId, valueDesc))

        logger.trace("Channel receive completed: channelId=$channelId, value=$valueDesc")
        return value
    }

    override fun tryReceive(): ChannelResult<T> {
        val result = delegate.tryReceive()
        if (result.isSuccess) {
            val currentSize = bufferCount.decrementAndGet().coerceAtLeast(0)
            val coroutineId =
                runCatching {
                    kotlinx.coroutines.runBlocking {
                        currentCoroutineContext()[VizCoroutineElement]?.coroutineId
                    }
                }.getOrNull() ?: "unknown"

            session.send(ctx.channelReceiveStarted(coroutineId))
            session.send(ctx.channelBufferStateChanged(currentSize))
            val valueDesc = result.getOrNull()?.toString()?.take(200) ?: "null"
            session.send(ctx.channelReceiveCompleted(coroutineId, valueDesc))
        }
        return result
    }

    override fun cancel(cause: CancellationException?) {
        delegate.cancel(cause)
        session.send(ctx.channelClosed(cause?.message ?: "Cancelled"))
        logger.debug("Channel cancelled: channelId=$channelId, cause=${cause?.message}")
    }

    @Deprecated("Deprecated in ReceiveChannel", replaceWith = ReplaceWith("cancel(CancellationException(cause))"))
    override fun cancel(cause: Throwable?): Boolean {
        val cancellationException =
            when (cause) {
                null -> null
                is CancellationException -> cause
                else -> CancellationException(cause.message, cause)
            }
        delegate.cancel(cancellationException)
        session.send(ctx.channelClosed(cause?.message ?: "Cancelled"))
        logger.debug("Channel cancelled (deprecated): channelId=$channelId, cause=${cause?.message}")
        return true
    }

    override val onReceive: SelectClause1<T>
        get() = delegate.onReceive

    override val onReceiveCatching: SelectClause1<ChannelResult<T>>
        get() = delegate.onReceiveCatching

    override fun iterator(): ChannelIterator<T> {
        val delegateIterator = delegate.iterator()
        return object : ChannelIterator<T> {
            override suspend fun hasNext(): Boolean {
                return delegateIterator.hasNext()
            }

            override fun next(): T {
                val value = delegateIterator.next()
                val currentSize = bufferCount.decrementAndGet().coerceAtLeast(0)
                session.send(ctx.channelBufferStateChanged(currentSize))
                val valueDesc = value?.toString()?.take(200) ?: "null"
                session.send(
                    ChannelReceiveCompleted(
                        sessionId = session.sessionId,
                        seq = session.nextSeq(),
                        tsNanos = System.nanoTime(),
                        channelId = channelId,
                        coroutineId = "iterator",
                        valueDescription = valueDesc,
                    ),
                )
                return value
            }
        }
    }

    override suspend fun receiveCatching(): ChannelResult<T> {
        val coroutineId = currentCoroutineContext()[VizCoroutineElement]?.coroutineId ?: "unknown"
        session.send(ctx.channelReceiveStarted(coroutineId))

        val result = delegate.receiveCatching()

        if (result.isSuccess) {
            val currentSize = bufferCount.decrementAndGet().coerceAtLeast(0)
            session.send(ctx.channelBufferStateChanged(currentSize))
            val valueDesc = result.getOrNull()?.toString()?.take(200) ?: "null"
            session.send(ctx.channelReceiveCompleted(coroutineId, valueDesc))
        } else if (result.isClosed) {
            session.send(ctx.channelClosed(result.exceptionOrNull()?.message))
        }

        return result
    }

    companion object {
        private val logger = LoggerFactory.getLogger(InstrumentedChannel::class.java)
    }
}

/**
 * Determine the channel type string from the capacity constant.
 */
fun channelTypeFromCapacity(capacity: Int): String =
    when (capacity) {
        Channel.RENDEZVOUS -> "RENDEZVOUS"
        Channel.CONFLATED -> "CONFLATED"
        Channel.UNLIMITED -> "UNLIMITED"
        Channel.BUFFERED -> "BUFFERED"
        else -> "BUFFERED"
    }

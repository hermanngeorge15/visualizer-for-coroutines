package com.jh.proj.coroutineviz.events.channel

import com.jh.proj.coroutineviz.events.VizEvent
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Emitted when an instrumented Channel is created.
 *
 * @property channelId Unique identifier for this Channel instance
 * @property name Optional human-readable name for the channel
 * @property capacity The buffer capacity of the channel
 * @property channelType Type of channel: RENDEZVOUS, BUFFERED, CONFLATED, UNLIMITED
 */
@Serializable
@SerialName("ChannelCreated")
data class ChannelCreated(
    override val sessionId: String,
    override val seq: Long,
    override val tsNanos: Long,
    val channelId: String,
    val name: String? = null,
    val capacity: Int,
    val channelType: String  // RENDEZVOUS, BUFFERED, CONFLATED, UNLIMITED
) : VizEvent {
    override val kind: String get() = "ChannelCreated"
}

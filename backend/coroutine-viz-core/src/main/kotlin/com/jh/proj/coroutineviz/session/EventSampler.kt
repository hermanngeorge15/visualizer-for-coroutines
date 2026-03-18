package com.jh.proj.coroutineviz.session

import com.jh.proj.coroutineviz.events.VizEvent
import java.util.concurrent.ConcurrentHashMap

/**
 * Probabilistic event sampler that rate-limits events by type to prevent
 * overwhelming the frontend during high-throughput scenarios.
 *
 * Sampling is deterministic: for a given event [VizEvent.seq] and rate,
 * the decision is always the same. This is achieved by using the event's
 * sequence number as a seed for a simple hash-based decision.
 *
 * Lifecycle events (kinds ending in "Created", "Started", "Completed",
 * "Failed", or "Cancelled") are always kept regardless of configured rates,
 * because they are essential for maintaining a correct view of the system state.
 *
 * @property defaultRate Default sampling rate for event types without a per-type override.
 *   1.0 = keep all events, 0.0 = drop all events, 0.5 = keep ~50%.
 * @property perTypeRates Per-event-kind overrides. Keys are [VizEvent.kind] values.
 */
class EventSampler(
    private val defaultRate: Double = 1.0,
    perTypeRates: Map<String, Double> = emptyMap(),
) {
    private val perTypeRates = ConcurrentHashMap<String, Double>(perTypeRates)

    init {
        require(defaultRate in 0.0..1.0) { "defaultRate must be in [0.0, 1.0], got $defaultRate" }
        perTypeRates.forEach { (kind, rate) ->
            require(rate in 0.0..1.0) { "Rate for '$kind' must be in [0.0, 1.0], got $rate" }
        }
    }

    companion object {
        /**
         * Lifecycle event suffixes that are always kept, regardless of sampling rates.
         * These events are essential for maintaining correct system state in the frontend.
         */
        private val LIFECYCLE_SUFFIXES = listOf("Created", "Started", "Completed", "Failed", "Cancelled")

        /**
         * Large prime used for deterministic hash-based sampling.
         * Mixing with a prime reduces sequential-seq clustering artifacts.
         */
        private const val HASH_PRIME = 2_654_435_761L

        /** Scale factor: map hash to [0.0, 1.0) range. */
        private const val UINT_MAX_PLUS_ONE = 4_294_967_296.0 // 2^32
    }

    /**
     * Determines whether an event should be kept (true) or dropped (false).
     *
     * Lifecycle events are always kept. For other events, the decision is
     * deterministic based on [VizEvent.seq] and the effective rate.
     */
    fun shouldKeep(event: VizEvent): Boolean {
        if (isLifecycleEvent(event.kind)) return true

        val rate = getEffectiveRate(event.kind)
        if (rate >= 1.0) return true
        if (rate <= 0.0) return false

        return deterministicKeep(event.seq, rate)
    }

    /**
     * Updates the sampling rate for a specific event kind at runtime.
     *
     * @param eventKind The [VizEvent.kind] value to configure.
     * @param rate Sampling rate in [0.0, 1.0].
     * @throws IllegalArgumentException if rate is outside [0.0, 1.0].
     */
    fun updateRate(eventKind: String, rate: Double) {
        require(rate in 0.0..1.0) { "Rate for '$eventKind' must be in [0.0, 1.0], got $rate" }
        perTypeRates[eventKind] = rate
    }

    /**
     * Returns the effective sampling rate for a given event kind.
     *
     * If a per-type rate is configured for the kind, that is returned;
     * otherwise the [defaultRate] is returned.
     */
    fun getEffectiveRate(eventKind: String): Double =
        perTypeRates[eventKind] ?: defaultRate

    /**
     * Checks whether the given event kind is a lifecycle event that should
     * always be preserved.
     */
    private fun isLifecycleEvent(kind: String): Boolean =
        LIFECYCLE_SUFFIXES.any { suffix -> kind.endsWith(suffix) }

    /**
     * Deterministic keep/drop decision based on event sequence number.
     *
     * Uses a simple multiplicative hash to map [seq] to a value in [0.0, 1.0),
     * then compares against the rate. This ensures the same seq + rate always
     * yields the same decision.
     */
    private fun deterministicKeep(seq: Long, rate: Double): Boolean {
        // Multiply by a large prime and take the lower 32 bits for uniform distribution
        val hash = (seq * HASH_PRIME) and 0xFFFFFFFFL
        val normalized = hash / UINT_MAX_PLUS_ONE // [0.0, 1.0)
        return normalized < rate
    }
}

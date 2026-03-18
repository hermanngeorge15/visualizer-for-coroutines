package com.jh.proj.coroutineviz.checksystem

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Result of a validation rule execution.
 *
 * Each validator produces one or more [ValidationResult] instances indicating
 * whether a specific rule passed or failed for the given event stream.
 */
@Serializable
sealed class ValidationResult {
    abstract val ruleName: String
    abstract val message: String

    @Serializable
    @SerialName("Pass")
    data class Pass(
        override val ruleName: String,
        override val message: String,
    ) : ValidationResult()

    @Serializable
    @SerialName("Fail")
    data class Fail(
        override val ruleName: String,
        override val message: String,
        val details: String,
    ) : ValidationResult()
}

package com.jh.proj.coroutineviz.validation

import com.jh.proj.coroutineviz.events.VizEvent
import kotlinx.serialization.Serializable

/**
 * Categories for validation rules.
 */
enum class ValidationCategory {
    LIFECYCLE,
    STRUCTURED_CONCURRENCY,
    PERFORMANCE,
    THREADING,
    EXCEPTION_HANDLING,
    RESOURCE_MANAGEMENT,
}

/**
 * Severity levels for validation findings.
 */
enum class ValidationSeverity {
    ERROR,
    WARNING,
    INFO,
}

/**
 * A single finding produced by a validation rule.
 */
@Serializable
data class RuleFinding(
    val ruleId: String,
    val ruleName: String,
    // ValidationSeverity name
    val severity: String,
    // ValidationCategory name
    val category: String,
    val message: String,
    val suggestion: String,
    val affectedEntities: List<String> = emptyList(),
    val eventSeq: Long? = null,
    val coroutineId: String? = null,
)

/**
 * Interface for all validation rules in the correctness engine.
 *
 * Each rule inspects the event stream and/or runtime snapshot to detect
 * issues, anti-patterns, or correctness violations.
 */
interface ValidationRule {
    /** Unique identifier for this rule (e.g., "lifecycle.created-has-started"). */
    val id: String

    /** Human-readable name. */
    val name: String

    /** Description of what this rule checks. */
    val description: String

    /** Category this rule belongs to. */
    val category: ValidationCategory

    /** Default severity when this rule is violated. */
    val severity: ValidationSeverity

    /**
     * Run this rule against the given events.
     * Returns a list of findings (empty if no issues found).
     */
    fun validate(events: List<VizEvent>): List<RuleFinding>
}

package com.jh.proj.coroutineviz.validation

import com.jh.proj.coroutineviz.events.VizEvent

/**
 * Registry for all validation rules.
 * Rules are registered at startup and can be queried by category or id.
 */
class ValidationRuleRegistry {
    private val rules = mutableMapOf<String, ValidationRule>()

    /**
     * Register a validation rule. Overwrites any existing rule with the same id.
     */
    fun register(rule: ValidationRule) {
        rules[rule.id] = rule
    }

    /**
     * Register multiple rules at once.
     */
    fun registerAll(vararg rulesToRegister: ValidationRule) {
        rulesToRegister.forEach { register(it) }
    }

    /**
     * Get a rule by its id.
     */
    fun get(id: String): ValidationRule? = rules[id]

    /**
     * Get all registered rules.
     */
    fun all(): List<ValidationRule> = rules.values.toList()

    /**
     * Get rules filtered by category.
     */
    fun byCategory(category: ValidationCategory): List<ValidationRule> = rules.values.filter { it.category == category }

    /**
     * Get rules filtered by severity.
     */
    fun bySeverity(severity: ValidationSeverity): List<ValidationRule> = rules.values.filter { it.severity == severity }

    /**
     * Run all registered rules against the given events.
     * Returns all findings across all rules.
     */
    fun validateAll(events: List<VizEvent>): List<RuleFinding> = rules.values.flatMap { it.validate(events) }

    /**
     * Run rules in a specific category.
     */
    fun validateCategory(
        category: ValidationCategory,
        events: List<VizEvent>,
    ): List<RuleFinding> = byCategory(category).flatMap { it.validate(events) }

    /**
     * Get a summary of registered rules.
     */
    fun summary(): RegistrySummary {
        val byCat = rules.values.groupBy { it.category }
        val bySev = rules.values.groupBy { it.severity }
        return RegistrySummary(
            totalRules = rules.size,
            byCategory = byCat.mapValues { it.value.size },
            bySeverity = bySev.mapValues { it.value.size },
        )
    }
}

data class RegistrySummary(
    val totalRules: Int,
    val byCategory: Map<ValidationCategory, Int>,
    val bySeverity: Map<ValidationSeverity, Int>,
)

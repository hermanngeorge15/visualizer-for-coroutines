---
sidebar_position: 3
---

# Extending Validation

You can create custom validation rules to detect domain-specific anti-patterns in your coroutine code.

## ValidationRule Interface

Every rule implements the `ValidationRule` interface:

```kotlin
interface ValidationRule {
    val id: String
    val name: String
    val description: String
    val severity: Severity
    val category: RuleCategory

    fun evaluate(events: List<VizEvent>, snapshot: RuntimeSnapshot): ValidationResult
}
```

## Creating a Custom Rule

```kotlin
class MaxConcurrentCoroutinesRule(
    private val maxAllowed: Int = 50
) : ValidationRule {
    override val id = "custom.max-concurrent-coroutines"
    override val name = "Max Concurrent Coroutines"
    override val description = "Warns when more than $maxAllowed coroutines are active simultaneously"
    override val severity = Severity.WARNING
    override val category = RuleCategory.PERFORMANCE

    override fun evaluate(
        events: List<VizEvent>,
        snapshot: RuntimeSnapshot
    ): ValidationResult {
        val maxConcurrent = computeMaxConcurrent(events)
        return if (maxConcurrent > maxAllowed) {
            ValidationResult.Fail(
                rule = this,
                message = "Peak concurrent coroutines: $maxConcurrent (limit: $maxAllowed)",
                relatedEvents = findPeakEvents(events)
            )
        } else {
            ValidationResult.Pass(rule = this)
        }
    }

    private fun computeMaxConcurrent(events: List<VizEvent>): Int {
        var current = 0
        var max = 0
        for (event in events) {
            when (event) {
                is CoroutineStarted -> current++
                is CoroutineCompleted, is CoroutineCancelled, is CoroutineFailed -> current--
            }
            max = maxOf(max, current)
        }
        return max
    }
}
```

## ValidationResult

A rule can return three result types:

| Result | Description |
|---|---|
| `Pass` | Rule passed, no issues found |
| `Warning` | Potential issue detected |
| `Fail` | Clear violation detected |

Each result can include:
- `message` — Human-readable explanation
- `relatedEvents` — Events that triggered the result
- `suggestion` — Recommended fix

## Registering Custom Rules

```kotlin
ValidationEngine.register(MaxConcurrentCoroutinesRule(maxAllowed = 100))
```

Or in a configuration block:

```kotlin
ValidationConfig {
    customRule(MaxConcurrentCoroutinesRule(maxAllowed = 100))
}
```

## Severity Levels

| Level | Weight | Description |
|---|---|---|
| `CRITICAL` | 3x | Must be fixed, likely causes bugs |
| `WARNING` | 2x | Should be reviewed, potential issue |
| `INFO` | 1x | Suggestion for improvement |

## Rule Categories

Built-in categories: `LIFECYCLE`, `ERROR_HANDLING`, `PERFORMANCE`, `SYNCHRONIZATION`, `FLOW`.

Create custom categories:

```kotlin
val MY_CATEGORY = RuleCategory("my-domain", "My Domain Rules")
```

## Testing Rules

Test rules with the `ValidationTestHarness`:

```kotlin
@Test
fun `detects excessive coroutines`() {
    val harness = ValidationTestHarness()
    val events = harness.buildEvents {
        repeat(100) { coroutineStarted("worker-$it") }
    }

    val rule = MaxConcurrentCoroutinesRule(maxAllowed = 50)
    val result = rule.evaluate(events, harness.snapshot)

    assertIs<ValidationResult.Fail>(result)
    assertContains(result.message, "100")
}
```

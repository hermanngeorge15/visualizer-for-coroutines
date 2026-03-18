# ADR-012: Validation Engine Architecture

## Status
Accepted

## Date
2026-03-17

## Context
The existing checksystem has 6 validators (LifecycleValidator, HierarchyValidator, SequenceChecker, StructuredConcurrencyValidator, SyncValidators, TimingAnalyzer) implemented as static objects or simple classes. Adding new rules requires modifying routes and manually wiring validators. We need a scalable, extensible architecture for the coroutine correctness engine.

## Decision
Introduce a formal `ValidationRule` interface and `ValidationRuleRegistry` for auto-discovery and execution.

### Rule Interface
```kotlin
interface ValidationRule {
    val id: String           // "lifecycle.created-has-started"
    val name: String         // "Created Has Started"
    val description: String
    val category: ValidationCategory
    val severity: ValidationSeverity
    fun validate(events: List<VizEvent>): List<RuleFinding>
}
```

### Categories
- **LIFECYCLE** — Coroutine lifecycle correctness
- **STRUCTURED_CONCURRENCY** — Parent-child relationships
- **PERFORMANCE** — Blocking, explosion, slow suspensions
- **THREADING** — Dispatcher misuse, shared state
- **EXCEPTION_HANDLING** — Swallowed cancellation, unhandled exceptions
- **RESOURCE_MANAGEMENT** — Unclosed channels, mutex/semaphore leaks

### Rule Registry
```kotlin
class ValidationRuleRegistry {
    fun register(rule: ValidationRule)
    fun all(): List<ValidationRule>
    fun byCategory(category): List<ValidationRule>
    fun validateAll(events): List<RuleFinding>
}
```

### Migration Strategy
1. Wrap existing validators as `ValidationRule` implementations (Phase 3B)
2. Add new performance/threading/exception/resource rules (Phase 3C-D)
3. Refactor `ValidationRoutes.kt` to use the registry instead of manual wiring
4. Add real-time validation via EventBus subscriber (Phase 3E)

### Real-Time Validation (Phase 3E)
- `RealTimeValidator` subscribes to EventBus and runs fast rules on each event
- Debounces findings to avoid overwhelming the SSE stream
- Emits `ValidationFindingEmitted` events for frontend consumption

### Frontend Dashboard (Phase 3F)
- `ValidationDashboard` shows all findings grouped by category/severity
- `FindingCard` with inline suggestions and code snippets
- `ValidationScoreCard` with overall health score
- Inline badges on tree nodes and timeline markers

## Rationale
- Registry pattern enables adding rules without modifying routes
- Category/severity classification enables filtering and prioritization
- `RuleFinding` provides structured output with suggestions
- Existing validators are preserved and wrapped, not rewritten

## Consequences
### Positive
- New rules can be added as single-file classes
- Frontend can filter/sort findings by category and severity
- Real-time validation gives immediate feedback during scenario execution

### Negative
- Some rules may produce false positives (e.g., SharedMutableState is heuristic-based)
- Real-time validation adds processing overhead per event
- Two validation systems coexist temporarily (old static validators + new registry)

package com.jh.proj.coroutineviz.validation

/**
 * Provides fix recommendations with code snippets for validation findings.
 */
object SuggestionProvider {
    data class Suggestion(
        val title: String,
        val description: String,
        val codeSnippet: String? = null,
        val documentation: String? = null,
    )

    fun getSuggestion(finding: RuleFinding): Suggestion {
        return when {
            finding.ruleId.startsWith("lifecycle.") -> getLifecycleSuggestion(finding)
            finding.ruleId.startsWith("hierarchy.") || finding.ruleId.startsWith("structured-concurrency.") ->
                getStructuredConcurrencySuggestion(
                    finding,
                )
            finding.ruleId.startsWith("performance.") -> getPerformanceSuggestion(finding)
            finding.ruleId.startsWith("threading.") -> getThreadingSuggestion(finding)
            finding.ruleId.startsWith("exception.") -> getExceptionSuggestion(finding)
            finding.ruleId.startsWith("resource.") -> getResourceSuggestion(finding)
            else -> Suggestion(title = "Review", description = finding.suggestion)
        }
    }

    private fun getLifecycleSuggestion(finding: RuleFinding): Suggestion =
        when (finding.ruleId) {
            "lifecycle.created-has-started" ->
                Suggestion(
                    title = "Ensure coroutine starts",
                    description = "The coroutine was created but never started. This can happen if the scope is cancelled immediately.",
                    codeSnippet =
                        """
                        // Use coroutineScope to ensure structured startup
                        coroutineScope {
                            launch { /* work */ }
                        }
                        """.trimIndent(),
                )
            "lifecycle.started-has-terminal" ->
                Suggestion(
                    title = "Ensure coroutine completes",
                    description = "The coroutine started but never reached a terminal state. This may indicate a leaked coroutine.",
                    codeSnippet =
                        """
                        // Use withTimeout to prevent infinite running
                        withTimeout(30_000) {
                            // work that should complete within 30s
                        }
                        """.trimIndent(),
                )
            else -> Suggestion(title = "Review lifecycle", description = finding.suggestion)
        }

    private fun getStructuredConcurrencySuggestion(finding: RuleFinding): Suggestion =
        Suggestion(
            title = "Use structured concurrency",
            description = finding.suggestion,
            codeSnippet =
                """
                // Prefer coroutineScope/supervisorScope over manual Job management
                coroutineScope {
                    val result1 = async { fetchData1() }
                    val result2 = async { fetchData2() }
                    combine(result1.await(), result2.await())
                }
                """.trimIndent(),
        )

    private fun getPerformanceSuggestion(finding: RuleFinding): Suggestion =
        when (finding.ruleId) {
            "performance.main-thread-blocking" ->
                Suggestion(
                    title = "Move work off Main dispatcher",
                    description = finding.suggestion,
                    codeSnippet =
                        """
                        // Use withContext to switch dispatchers
                        withContext(Dispatchers.IO) {
                            // blocking I/O work
                        }
                        withContext(Dispatchers.Default) {
                            // CPU-intensive work
                        }
                        """.trimIndent(),
                )
            "performance.excessive-creation" ->
                Suggestion(
                    title = "Limit concurrent coroutines",
                    description = finding.suggestion,
                    codeSnippet =
                        """
                        // Use a Semaphore to limit concurrency
                        val semaphore = Semaphore(10)
                        items.map { item ->
                            async {
                                semaphore.withPermit { process(item) }
                            }
                        }.awaitAll()
                        """.trimIndent(),
                )
            else -> Suggestion(title = "Optimize performance", description = finding.suggestion)
        }

    private fun getThreadingSuggestion(finding: RuleFinding): Suggestion =
        Suggestion(
            title = "Review threading",
            description = finding.suggestion,
            codeSnippet =
                """
                // Use Mutex for shared mutable state
                val mutex = Mutex()
                var sharedState = 0
                mutex.withLock { sharedState++ }
                """.trimIndent(),
        )

    private fun getExceptionSuggestion(finding: RuleFinding): Suggestion =
        Suggestion(
            title = "Handle exceptions properly",
            description = finding.suggestion,
            codeSnippet =
                """
                // Don't swallow CancellationException
                try {
                    suspendingWork()
                } catch (e: Exception) {
                    if (e is CancellationException) throw e
                    handleError(e)
                }
                """.trimIndent(),
        )

    private fun getResourceSuggestion(finding: RuleFinding): Suggestion =
        when (finding.ruleId) {
            "resource.mutex-lock-leak" ->
                Suggestion(
                    title = "Use withLock",
                    description = finding.suggestion,
                    codeSnippet =
                        """
                        // Always prefer withLock over manual lock/unlock
                        mutex.withLock {
                            // critical section — automatically unlocked
                        }
                        """.trimIndent(),
                )
            "resource.unclosed-channel" ->
                Suggestion(
                    title = "Close channels",
                    description = finding.suggestion,
                    codeSnippet =
                        """
                        // Use produce builder for auto-closing
                        val channel = produce {
                            for (item in items) send(item)
                        } // auto-closed when block completes
                        """.trimIndent(),
                )
            else -> Suggestion(title = "Manage resources", description = finding.suggestion)
        }
}

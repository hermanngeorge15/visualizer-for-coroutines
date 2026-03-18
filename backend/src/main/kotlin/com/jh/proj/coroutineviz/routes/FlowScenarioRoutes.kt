package com.jh.proj.coroutineviz.routes

import com.jh.proj.coroutineviz.scenarios.FlowScenarios
import com.jh.proj.coroutineviz.session.SessionManager
import com.jh.proj.coroutineviz.session.VizSession
import com.jh.proj.coroutineviz.wrappers.VizScope
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post

fun Route.registerFlowScenarioRoutes() {
    post("/api/scenarios/flow/simple") {
        val session = getOrCreateSession(call.request.queryParameters["sessionId"], "flow-simple")
        val scope = VizScope(session)
        FlowScenarios.simpleFlow(scope)
        call.respond(HttpStatusCode.OK, session.toCompletionResponse("Simple Flow completed"))
    }

    post("/api/scenarios/flow/operators") {
        val session = getOrCreateSession(call.request.queryParameters["sessionId"], "flow-operators")
        val scope = VizScope(session)
        FlowScenarios.flowOperators(scope)
        call.respond(HttpStatusCode.OK, session.toCompletionResponse("Flow Operators completed"))
    }

    post("/api/scenarios/flow/stateflow") {
        val session = getOrCreateSession(call.request.queryParameters["sessionId"], "flow-stateflow")
        val scope = VizScope(session)
        FlowScenarios.stateFlowDemo(scope)
        call.respond(HttpStatusCode.OK, session.toCompletionResponse("StateFlow demo completed"))
    }

    post("/api/scenarios/flow/sharedflow") {
        val session = getOrCreateSession(call.request.queryParameters["sessionId"], "flow-sharedflow")
        val scope = VizScope(session)
        FlowScenarios.sharedFlowDemo(scope)
        call.respond(HttpStatusCode.OK, session.toCompletionResponse("SharedFlow demo completed"))
    }

    get("/api/scenarios/flow") {
        call.respond(
            HttpStatusCode.OK,
            mapOf(
                "scenarios" to
                    listOf(
                        mapOf(
                            "id" to "flow/simple",
                            "name" to "Simple Flow",
                            "description" to "Emit and collect 5 values from a cold Flow",
                            "endpoint" to "/api/scenarios/flow/simple",
                            "category" to "flow",
                            "duration" to "~1s",
                        ),
                        mapOf(
                            "id" to "flow/operators",
                            "name" to "Flow Operators",
                            "description" to "Chain map and filter operators on a flow",
                            "endpoint" to "/api/scenarios/flow/operators",
                            "category" to "flow",
                            "duration" to "~1s",
                        ),
                        mapOf(
                            "id" to "flow/stateflow",
                            "name" to "StateFlow",
                            "description" to "Mutable state with multiple observers",
                            "endpoint" to "/api/scenarios/flow/stateflow",
                            "category" to "flow",
                            "duration" to "~2s",
                        ),
                        mapOf(
                            "id" to "flow/sharedflow",
                            "name" to "SharedFlow",
                            "description" to "Broadcast events to multiple subscribers",
                            "endpoint" to "/api/scenarios/flow/sharedflow",
                            "category" to "flow",
                            "duration" to "~2s",
                        ),
                    ),
            ),
        )
    }
}

internal suspend fun getOrCreateSession(
    sessionId: String?,
    prefix: String,
): VizSession {
    return if (sessionId != null) {
        SessionManager.getSession(sessionId) ?: SessionManager.createSession(sessionId)
    } else {
        SessionManager.createSession(prefix)
    }
}

internal fun VizSession.toCompletionResponse(message: String) =
    ScenarioCompletionResponse(
        success = true,
        sessionId = sessionId,
        message = message,
        coroutineCount = snapshot.coroutines.size,
        eventCount = store.all().size,
    )

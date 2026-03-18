---
sidebar_position: 2
---

# Custom Scenarios

Beyond the built-in scenarios, you can create your own using the ScenarioDSL to visualize specific coroutine patterns relevant to your application.

## ScenarioDSL

The `ScenarioDSL` provides a structured way to define scenarios:

```kotlin
val myScenario = scenario("My Custom Scenario") {
    description = "Demonstrates a custom concurrency pattern"
    category = ScenarioCategory.CUSTOM

    parameters {
        intParam("workerCount", default = 3, min = 1, max = 10)
        longParam("delayMs", default = 100L, min = 0, max = 5000)
    }

    execute { session, params ->
        val workerCount = params.getInt("workerCount")
        val delayMs = params.getLong("delayMs")

        val scope = VizScope(session, Dispatchers.Default)
        scope.launch {
            repeat(workerCount) { i ->
                launch {
                    delay(delayMs)
                    println("Worker $i done")
                }
            }
        }
    }
}
```

## Scenario Structure

Every scenario has:

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Display name in the UI |
| `description` | No | Explanation of what the scenario demonstrates |
| `category` | No | Grouping category (defaults to `CUSTOM`) |
| `parameters` | No | Configurable inputs |
| `execute` | Yes | The coroutine code to run |

## Parameters

Supported parameter types:

- `intParam` — Integer with optional min/max
- `longParam` — Long with optional min/max
- `boolParam` — Boolean toggle
- `stringParam` — Free-form text
- `enumParam` — Selection from predefined values

## Registering Scenarios

Register custom scenarios with the `ScenarioRegistry`:

```kotlin
ScenarioRegistry.register(myScenario)
```

Registered scenarios appear in the scenario dropdown in both the web UI and IntelliJ plugin.

## Best Practices

- **Use wrappers** — Always use `VizScope`, `InstrumentedFlow`, etc. to ensure events are captured
- **Keep it focused** — Each scenario should demonstrate one concept
- **Add delays** — Small delays between operations make visualizations easier to follow
- **Document parameters** — Provide descriptions for each parameter
- **Handle cleanup** — Ensure scopes are properly cancelled/completed

## Example: Producer-Consumer

```kotlin
val producerConsumer = scenario("Custom Producer-Consumer") {
    description = "Multiple producers sending to a single consumer via channel"

    parameters {
        intParam("producerCount", default = 3)
        intParam("itemsPerProducer", default = 5)
    }

    execute { session, params ->
        val scope = VizScope(session, Dispatchers.Default)
        val channel = Channel<Int>(capacity = 5)

        // Producers
        repeat(params.getInt("producerCount")) { p ->
            scope.launch {
                repeat(params.getInt("itemsPerProducer")) { i ->
                    channel.send(p * 100 + i)
                    delay(50)
                }
            }
        }

        // Consumer
        scope.launch {
            for (value in channel) {
                println("Received: $value")
            }
        }
    }
}
```

# Actor Pattern in Kotlin Coroutines

**Version:** 1.0  
**Date:** December 2025  
**Status:** Design Document

---

## Executive Summary

The **Actor Pattern** is a concurrency model where isolated units (actors) communicate exclusively through message passing. In Kotlin coroutines, actors are implemented using channels and provide a powerful way to manage mutable state safely.

**Key Benefits:**
- No shared mutable state
- Sequential message processing (no locks needed)
- Clear ownership and encapsulation
- Natural fit for coroutines

---

## 1. Actor Pattern Fundamentals

### 1.1 What is an Actor?

An **actor** is:
- An isolated unit with private state
- A mailbox (channel) for receiving messages
- A behavior that processes messages sequentially
- Optionally able to create child actors

```
┌──────────────────────────────────────────────────────────────┐
│                         ACTOR                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    MAILBOX (Channel)                     │ │
│  │  📨 → 📨 → 📨 → 📨 →                                    │ │
│  └─────────────────┬───────────────────────────────────────┘ │
│                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                  BEHAVIOR                                │ │
│  │  when (message) {                                        │ │
│  │    is Increment -> counter++                             │ │
│  │    is GetValue  -> respond(counter)                      │ │
│  │  }                                                       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                    │                                          │
│  ┌─────────────────▼───────────────────────────────────────┐ │
│  │               PRIVATE STATE                              │ │
│  │  counter: Int = 0                                        │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Actor vs Traditional Concurrency

| Aspect | Traditional (Shared State) | Actor Model |
|--------|---------------------------|-------------|
| State Access | Shared, protected by locks | Private, no external access |
| Communication | Method calls + synchronization | Message passing |
| Concurrency | Risk of deadlocks, race conditions | Sequential processing per actor |
| Scalability | Limited by contention | Excellent (actors are independent) |
| Debugging | Complex (interleaved execution) | Simpler (message-by-message) |

### 1.3 Kotlin Actor Implementation Options

```kotlin
// Option 1: Using actor coroutine builder (now obsolete)
// @ObsoleteCoroutinesApi
// val actor = actor<Message> { ... }

// Option 2: Manual implementation with Channel (RECOMMENDED)
class CounterActor {
    private val channel = Channel<CounterMessage>()
    
    suspend fun send(msg: CounterMessage) = channel.send(msg)
    
    suspend fun start() = coroutineScope {
        var counter = 0
        for (msg in channel) {
            when (msg) {
                is Increment -> counter++
                is GetValue -> msg.response.complete(counter)
            }
        }
    }
}

// Option 3: Using sealed classes for type-safe messages
sealed class CounterMessage {
    object Increment : CounterMessage()
    data class GetValue(val response: CompletableDeferred<Int>) : CounterMessage()
}
```

---

## 2. Events to Track

### 2.1 Actor Lifecycle Events

```kotlin
sealed class ActorEvent : VizEvent() {
    
    data class ActorCreated(
        val actorId: String,
        val label: String?,
        val channelCapacity: Int,
        val ownerCoroutineId: String
    ) : ActorEvent()
    
    data class ActorStarted(
        val actorId: String,
        val processingCoroutineId: String
    ) : ActorEvent()
    
    data class ActorStopped(
        val actorId: String,
        val reason: StopReason,  // Completed, Cancelled, Failed
        val messagesProcessed: Long,
        val messagesDropped: Long
    ) : ActorEvent()
}
```

### 2.2 Message Events

```kotlin
sealed class ActorMessageEvent : VizEvent() {
    
    data class MessageSent(
        val actorId: String,
        val messageId: String,
        val messageType: String,
        val senderId: String,
        val senderLabel: String,
        val queueSizeAfter: Int
    ) : ActorMessageEvent()
    
    data class MessageReceived(
        val actorId: String,
        val messageId: String,
        val messageType: String,
        val queueSizeBefore: Int,
        val waitTimeNanos: Long
    ) : ActorMessageEvent()
    
    data class MessageProcessingStarted(
        val actorId: String,
        val messageId: String,
        val messageType: String
    ) : ActorMessageEvent()
    
    data class MessageProcessingCompleted(
        val actorId: String,
        val messageId: String,
        val processingTimeNanos: Long,
        val resultType: String?  // For request-response
    ) : ActorMessageEvent()
    
    data class MessageDropped(
        val actorId: String,
        val messageId: String,
        val messageType: String,
        val reason: DropReason  // ChannelFull, ActorStopped
    ) : ActorMessageEvent()
}
```

### 2.3 State Events

```kotlin
sealed class ActorStateEvent : VizEvent() {
    
    data class ActorStateChanged(
        val actorId: String,
        val stateDescription: String,  // Human-readable state summary
        val triggeringMessageId: String
    ) : ActorStateEvent()
    
    data class ActorMailboxStatus(
        val actorId: String,
        val pendingMessages: Int,
        val capacity: Int,
        val oldestMessageAgeNanos: Long
    ) : ActorStateEvent()
}
```

---

## 3. Visualization Design

### 3.1 Actor Overview

```
┌─────────────────────────────────────────────────────────────┐
│              ACTOR: "user-session-manager"                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  STATUS: 🟢 RUNNING          Messages Processed: 1,247       │
│  Owner: coroutine-5          Processing Time (avg): 2.3ms    │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                        MAILBOX                               │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│   Capacity: 64    Used: 12    Utilization: [████░░░░░] 19%  │
│                                                              │
│   Pending Messages:                                          │
│   [1] LoginRequest(userId: "alice")       age: 15ms          │
│   [2] UpdateProfile(userId: "bob")        age: 12ms          │
│   [3] Logout(sessionId: "xyz123")         age: 8ms           │
│   ... 9 more                                                 │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                    CURRENT STATE                             │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│   Active Sessions: 42                                        │
│   Last Login: "charlie" @ 14:32:05                          │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│                  PROCESSING NOW                              │
│  ═══════════════════════════════════════════════════════════ │
│                                                              │
│   📨 ValidateToken(token: "abc...")                          │
│   Processing time: 1.2ms (ongoing)                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Message Flow Animation

```
                    SENDERS                          ACTOR
                                                        
  coroutine-1 ───📨───┐                                
                      │      ┌─────────────────────┐   
  coroutine-2 ───📨───┼─────▶│ 📨📨📨    MAILBOX  │   
                      │      └─────────┬───────────┘   
  coroutine-3 ───📨───┘                │               
                                       ▼               
                              ┌─────────────────────┐  
                              │  🔄 PROCESSING      │  
                              │  LoginRequest       │  
                              └─────────┬───────────┘  
                                        │              
                                        ▼              
                              ┌─────────────────────┐  
                              │  STATE UPDATED      │  
                              │  sessions: 42 → 43  │  
                              └─────────────────────┘  
```

### 3.3 Request-Response Pattern

```
REQUESTER                                         ACTOR
    │                                               │
    │  ──────────── GetBalance(userId) ──────────▶  │
    │                                               │
    │  [suspended waiting for response]             │
    │                                               │
    │                         ┌──────────────────┐  │
    │                         │ Process request  │  │
    │                         │ Look up balance  │  │
    │                         └────────┬─────────┘  │
    │                                  │            │
    │  ◀─────────── Response(500.00) ──────────────  │
    │                                               │
    │  [resumed with result]                        │
    │                                               │
```

---

## 4. Test Scenarios

### 4.1 Basic Actor - Counter

```kotlin
@Test
fun `basic counter actor`() = runTest {
    val counterActor = vizActor<CounterMessage>("counter") { msg ->
        var count = 0
        when (msg) {
            is Increment -> count++
            is Decrement -> count--
            is GetCount -> msg.response.complete(count)
        }
    }
    
    // Send messages
    vizLaunch("incrementer") {
        repeat(10) {
            counterActor.send(Increment)
            vizDelay(10)
        }
    }
    
    // Get result
    val response = CompletableDeferred<Int>()
    counterActor.send(GetCount(response))
    val count = response.await()
    
    assertEquals(10, count)
}
```

**Expected Events:**
1. `ActorCreated("counter", capacity=Channel.RENDEZVOUS)`
2. `ActorStarted`
3. 10x `MessageSent(Increment)`
4. 10x `MessageReceived` + `MessageProcessingCompleted`
5. `MessageSent(GetCount)` + `MessageProcessingCompleted`

### 4.2 Multiple Senders (Fan-In)

```kotlin
@Test
fun `actor handles multiple senders`() = runTest {
    val logActor = vizActor<LogMessage>("logger") { msg ->
        val logs = mutableListOf<String>()
        logs.add("[${msg.level}] ${msg.message}")
    }
    
    // Multiple coroutines sending logs
    repeat(5) { i ->
        vizLaunch("worker-$i") {
            repeat(20) { j ->
                logActor.send(LogMessage(INFO, "Worker $i log $j"))
                vizDelay(5)
            }
        }
    }
}
```

**Expected Visualization:**
- 5 senders feeding one actor
- Messages interleaved but processed sequentially
- No race conditions on log list

### 4.3 Request-Response Pattern

```kotlin
@Test
fun `actor request-response`() = runTest {
    sealed class BankMessage {
        data class Deposit(val amount: Double) : BankMessage()
        data class Withdraw(val amount: Double, val response: CompletableDeferred<Boolean>) : BankMessage()
        data class GetBalance(val response: CompletableDeferred<Double>) : BankMessage()
    }
    
    val bankActor = vizActor<BankMessage>("bank-account") { msg ->
        var balance = 0.0
        when (msg) {
            is Deposit -> balance += msg.amount
            is Withdraw -> {
                if (balance >= msg.amount) {
                    balance -= msg.amount
                    msg.response.complete(true)
                } else {
                    msg.response.complete(false)
                }
            }
            is GetBalance -> msg.response.complete(balance)
        }
    }
    
    // Concurrent deposits and withdrawals
    vizLaunch("depositor") {
        repeat(10) {
            bankActor.send(Deposit(100.0))
            vizDelay(20)
        }
    }
    
    vizLaunch("withdrawer") {
        repeat(5) {
            val response = CompletableDeferred<Boolean>()
            bankActor.send(Withdraw(150.0, response))
            val success = response.await()
            println("Withdrawal ${if (success) "succeeded" else "failed"}")
            vizDelay(50)
        }
    }
}
```

**Expected Visualization:**
- Show request-response pairing
- Highlight suspended coroutines waiting for response
- Show state changes (balance) after each message

### 4.4 Backpressure Handling

```kotlin
@Test
fun `actor with bounded mailbox`() = runTest {
    val slowActor = vizActor<WorkItem>(
        label = "slow-worker",
        capacity = 5  // Small buffer
    ) { item ->
        vizDelay(100)  // Slow processing
        process(item)
    }
    
    // Fast producer
    vizLaunch("fast-producer") {
        repeat(20) { i ->
            slowActor.send(WorkItem(i))  // Will suspend when buffer full
        }
    }
}
```

**Expected Visualization:**
- Buffer fills to 5
- Producer suspends (backpressure)
- Show queue draining as items processed
- Producer resumes when space available

### 4.5 Actor with Child Actors

```kotlin
@Test
fun `actor spawns child actors`() = runTest {
    sealed class RouterMessage {
        data class Route(val payload: String, val destination: String) : RouterMessage()
    }
    
    val routerActor = vizActor<RouterMessage>("router") { msg ->
        val workers = mutableMapOf<String, SendChannel<String>>()
        
        when (msg) {
            is Route -> {
                // Get or create worker for destination
                val worker = workers.getOrPut(msg.destination) {
                    vizActor<String>("worker-${msg.destination}") { payload ->
                        process(payload)
                    }.channel
                }
                worker.send(msg.payload)
            }
        }
    }
}
```

**Expected Visualization:**
- Router actor creates child workers dynamically
- Show actor hierarchy
- Message routing visualization

---

## 5. Actor Patterns

### 5.1 Fire-and-Forget

```kotlin
// Simple message, no response needed
actor.send(LogMessage("User logged in"))
```

### 5.2 Request-Response (Ask Pattern)

```kotlin
// Wait for response
val response = CompletableDeferred<Result>()
actor.send(Query(params, response))
val result = response.await()
```

### 5.3 Actor Pool (Load Balancing)

```kotlin
class ActorPool<T>(
    private val session: VizSession,
    private val poolSize: Int,
    private val actorFactory: () -> VizActor<T>
) {
    private val actors = (0 until poolSize).map { actorFactory() }
    private var nextIndex = AtomicInteger(0)
    
    suspend fun send(message: T) {
        val index = nextIndex.getAndIncrement() % poolSize
        actors[index].send(message)
    }
}
```

### 5.4 Actor with Timeout

```kotlin
val actor = vizActor<Message>("timed-worker") { msg ->
    withTimeout(5000) {
        processMessage(msg)
    }
}
```

### 5.5 Stateful Actor (State Machine)

```kotlin
sealed class OrderState {
    object Pending : OrderState()
    object Confirmed : OrderState()
    object Shipped : OrderState()
    object Delivered : OrderState()
    object Cancelled : OrderState()
}

sealed class OrderMessage {
    object Confirm : OrderMessage()
    object Ship : OrderMessage()
    object Deliver : OrderMessage()
    object Cancel : OrderMessage()
}

val orderActor = vizActor<OrderMessage>("order-fsm") { msg ->
    var state: OrderState = Pending
    
    state = when {
        state is Pending && msg is Confirm -> Confirmed
        state is Confirmed && msg is Ship -> Shipped
        state is Shipped && msg is Deliver -> Delivered
        state is Pending && msg is Cancel -> Cancelled
        state is Confirmed && msg is Cancel -> Cancelled
        else -> {
            // Invalid transition
            emitWarning("Invalid transition: $state + $msg")
            state
        }
    }
}
```

---

## 6. Wrapper Implementation

### 6.1 VizActor

```kotlin
class VizActor<T>(
    private val session: VizSession,
    val label: String,
    capacity: Int = Channel.RENDEZVOUS,
    private val handler: suspend (T) -> Unit
) {
    private val actorId = IdRegistry.nextActorId()
    private val channel = Channel<ActorMessage<T>>(capacity)
    private var messagesProcessed = 0L
    private var messagesDropped = 0L
    
    init {
        session.send(ActorCreated(
            actorId = actorId,
            label = label,
            channelCapacity = capacity,
            ownerCoroutineId = currentCoroutineId()
        ))
    }
    
    suspend fun send(message: T) {
        val messageId = IdRegistry.nextMessageId()
        val senderId = currentCoroutineId()
        
        session.send(MessageSent(
            actorId = actorId,
            messageId = messageId,
            messageType = message!!::class.simpleName ?: "Unknown",
            senderId = senderId,
            senderLabel = currentLabel(),
            queueSizeAfter = channel.queueSize() + 1
        ))
        
        val wrapped = ActorMessage(messageId, message, System.nanoTime())
        
        try {
            channel.send(wrapped)
        } catch (e: ClosedSendChannelException) {
            messagesDropped++
            session.send(MessageDropped(
                actorId = actorId,
                messageId = messageId,
                messageType = message!!::class.simpleName ?: "Unknown",
                reason = DropReason.ActorStopped
            ))
            throw e
        }
    }
    
    fun start(scope: CoroutineScope): Job {
        return scope.launch {
            session.send(ActorStarted(
                actorId = actorId,
                processingCoroutineId = currentCoroutineId()
            ))
            
            try {
                for (wrapped in channel) {
                    processMessage(wrapped)
                }
            } finally {
                session.send(ActorStopped(
                    actorId = actorId,
                    reason = determineStopReason(),
                    messagesProcessed = messagesProcessed,
                    messagesDropped = messagesDropped
                ))
            }
        }
    }
    
    private suspend fun processMessage(wrapped: ActorMessage<T>) {
        val waitTime = System.nanoTime() - wrapped.enqueuedAt
        
        session.send(MessageReceived(
            actorId = actorId,
            messageId = wrapped.id,
            messageType = wrapped.payload!!::class.simpleName ?: "Unknown",
            queueSizeBefore = channel.queueSize(),
            waitTimeNanos = waitTime
        ))
        
        session.send(MessageProcessingStarted(
            actorId = actorId,
            messageId = wrapped.id,
            messageType = wrapped.payload!!::class.simpleName ?: "Unknown"
        ))
        
        val startTime = System.nanoTime()
        try {
            handler(wrapped.payload)
            messagesProcessed++
        } finally {
            session.send(MessageProcessingCompleted(
                actorId = actorId,
                messageId = wrapped.id,
                processingTimeNanos = System.nanoTime() - startTime,
                resultType = null
            ))
        }
    }
    
    fun close() {
        channel.close()
    }
}

private data class ActorMessage<T>(
    val id: String,
    val payload: T,
    val enqueuedAt: Long
)
```

### 6.2 Extension Function

```kotlin
fun <T> VizScope.vizActor(
    label: String,
    capacity: Int = Channel.RENDEZVOUS,
    handler: suspend (T) -> Unit
): VizActor<T> {
    val actor = VizActor(session, label, capacity, handler)
    actor.start(this)
    return actor
}
```

---

## 7. Validation

### 7.1 ActorValidator

```kotlin
class ActorValidator(private val recorder: EventRecorder) {
    
    fun verifySequentialProcessing(actorId: String) {
        val processingEvents = recorder.all()
            .filter { it is MessageProcessingStarted || it is MessageProcessingCompleted }
            .filter { (it as ActorMessageEvent).actorId == actorId }
        
        var processingCount = 0
        processingEvents.forEach { event ->
            when (event) {
                is MessageProcessingStarted -> {
                    assertEquals(0, processingCount) {
                        "Actor processing multiple messages concurrently"
                    }
                    processingCount++
                }
                is MessageProcessingCompleted -> {
                    assertEquals(1, processingCount)
                    processingCount--
                }
            }
        }
    }
    
    fun verifyMessageOrder(actorId: String) {
        val sent = recorder.ofKind("MessageSent")
            .filter { it.actorId == actorId }
            .map { it.messageId }
        
        val received = recorder.ofKind("MessageReceived")
            .filter { it.actorId == actorId }
            .map { it.messageId }
        
        // For FIFO channel, order should match
        assertEquals(sent, received) {
            "Message processing order doesn't match send order"
        }
    }
    
    fun verifyNoDroppedMessages(actorId: String) {
        val dropped = recorder.ofKind("MessageDropped")
            .filter { it.actorId == actorId }
        
        assertTrue(dropped.isEmpty()) {
            "Messages were dropped: ${dropped.size}"
        }
    }
    
    fun verifyAllMessagesProcessed(actorId: String) {
        val sent = recorder.ofKind("MessageSent")
            .filter { it.actorId == actorId }
            .map { it.messageId }
            .toSet()
        
        val completed = recorder.ofKind("MessageProcessingCompleted")
            .filter { it.actorId == actorId }
            .map { it.messageId }
            .toSet()
        
        assertEquals(sent, completed) {
            "Not all sent messages were processed"
        }
    }
}
```

---

## 8. Frontend Components

### 8.1 ActorVisualization

```typescript
interface ActorState {
  actorId: string;
  label: string;
  status: 'running' | 'stopped' | 'error';
  mailboxCapacity: number;
  mailboxSize: number;
  pendingMessages: MessageInfo[];
  currentlyProcessing: MessageInfo | null;
  messagesProcessed: number;
  avgProcessingTime: number;
}

const ActorVisualization: React.FC<{ actor: ActorState }> = ({ actor }) => {
  const utilizationPercent = (actor.mailboxSize / actor.mailboxCapacity) * 100;
  
  return (
    <Card className="actor-card">
      <CardHeader>
        <ActorIcon />
        <span className="font-bold">{actor.label}</span>
        <StatusBadge status={actor.status} />
      </CardHeader>
      
      <CardContent>
        {/* Mailbox visualization */}
        <div className="mailbox-section">
          <h4>Mailbox</h4>
          <ProgressBar 
            value={utilizationPercent} 
            color={utilizationPercent > 80 ? 'red' : 'blue'}
          />
          <span>{actor.mailboxSize}/{actor.mailboxCapacity}</span>
          
          <MessageQueue messages={actor.pendingMessages} />
        </div>
        
        {/* Current processing */}
        {actor.currentlyProcessing && (
          <div className="processing-section">
            <h4>Processing</h4>
            <MessageCard 
              message={actor.currentlyProcessing} 
              isProcessing={true}
            />
          </div>
        )}
        
        {/* Stats */}
        <div className="stats-section">
          <Stat label="Processed" value={actor.messagesProcessed} />
          <Stat label="Avg Time" value={`${actor.avgProcessingTime.toFixed(1)}ms`} />
        </div>
      </CardContent>
    </Card>
  );
};
```

### 8.2 MessageFlowDiagram

```typescript
const MessageFlowDiagram: React.FC<{ 
  senders: CoroutineInfo[];
  actor: ActorState;
  messages: MessageFlow[];
}> = ({ senders, actor, messages }) => {
  return (
    <svg className="message-flow-diagram">
      {/* Sender nodes */}
      {senders.map((sender, i) => (
        <SenderNode key={sender.id} sender={sender} position={i} />
      ))}
      
      {/* Actor node */}
      <ActorNode actor={actor} />
      
      {/* Message arrows with animation */}
      {messages.map(msg => (
        <MessageArrow 
          key={msg.id}
          from={msg.senderId}
          to={actor.actorId}
          message={msg}
          animated={msg.status === 'in-flight'}
        />
      ))}
    </svg>
  );
};
```

---

## 9. Comparison: Actor vs Mutex

| Scenario | Actor | Mutex |
|----------|-------|-------|
| Counter increment | Sequential messages | Lock around increment |
| Database access | Message queue | Connection pooling |
| State machine | Natural fit | Complex with locks |
| Multiple operations | Single mailbox | Multiple lock points |
| Request-response | Built-in pattern | Manual coordination |

### When to Use Actors:
- Complex state management
- Need request-response pattern
- Multiple operations on same state
- Clear ownership of state

### When to Use Mutex:
- Simple critical sections
- Protecting external resources
- Short-duration locks
- Integration with existing code

---

## 10. Summary

### Key Takeaways

1. **Actors** = Isolated units with private state + message mailbox
2. **Sequential processing** = No locks needed inside actor
3. **Message passing** = Only way to interact with actor
4. **Backpressure** = Bounded channels provide natural flow control

### Implementation Checklist

- [ ] `VizActor<T>` wrapper class
- [ ] Actor lifecycle events
- [ ] Message tracking events
- [ ] Mailbox visualization
- [ ] Message flow animation
- [ ] Request-response support
- [ ] Actor hierarchy support
- [ ] Test scenarios (8+ cases)
- [ ] Frontend components

### Event Types Summary

| Event | Description |
|-------|-------------|
| `ActorCreated` | New actor instantiated |
| `ActorStarted` | Actor begins processing |
| `ActorStopped` | Actor shut down |
| `MessageSent` | Message sent to actor |
| `MessageReceived` | Message dequeued |
| `MessageProcessingStarted` | Handler invoked |
| `MessageProcessingCompleted` | Handler finished |
| `MessageDropped` | Message couldn't be delivered |
| `ActorMailboxStatus` | Periodic mailbox stats |

---

**End of Document**


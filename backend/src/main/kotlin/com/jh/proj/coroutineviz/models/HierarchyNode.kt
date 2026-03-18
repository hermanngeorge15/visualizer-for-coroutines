package com.jh.proj.coroutineviz.models

import kotlinx.serialization.Serializable

/**
 * Represents a coroutine in the hierarchy tree projection.
 *
 * HierarchyNode is used by [ProjectionService] to build parent-child relationship
 * trees for visualization. Unlike [CoroutineNode], this model is serializable
 * and includes computed fields like children lists and timing information.
 *
 * @property id Unique coroutine identifier
 * @property parentId ID of parent coroutine, null for root coroutines
 * @property children List of child coroutine IDs
 * @property name Display name (label or generated)
 * @property scopeId ID of the owning VizScope
 * @property state Current state as a string
 * @property createdAtNanos Timestamp when coroutine was created
 * @property completedAtNanos Timestamp when coroutine finished, if applicable
 * @property dispatcherId ID of the assigned dispatcher
 * @property dispatcherName Human-readable dispatcher name
 * @property currentThreadId ID of thread currently executing, if any
 * @property currentThreadName Name of thread currently executing, if any
 * @property jobId Associated Job identifier
 * @property exceptionType Type of exception if failed
 * @property exceptionMessage Exception message if failed
 */
@Serializable
data class HierarchyNode(
    // coroutineId
    val id: String,
    // parentCoroutineId
    val parentId: String?,
    // child coroutine IDs
    val children: List<String> = emptyList(),
    // label or generated name
    val name: String,
    val scopeId: String,
    // "CREATED", "RUNNING", "SUSPENDED", "COMPLETED", "CANCELLED", "FAILED"
    val state: String,
    val createdAtNanos: Long,
    val completedAtNanos: Long? = null,
    val dispatcherId: String? = null,
    val dispatcherName: String? = null,
    val currentThreadId: Long? = null,
    val currentThreadName: String? = null,
    val jobId: String,
    // If failed
    val exceptionType: String? = null,
    val exceptionMessage: String? = null,
    val activeChildrenIds: List<String> = emptyList(),
    val activeChildrenCount: Int = 0,
)

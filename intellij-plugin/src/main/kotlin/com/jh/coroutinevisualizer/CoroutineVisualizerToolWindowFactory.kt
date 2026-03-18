package com.jh.coroutinevisualizer

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import com.jh.coroutinevisualizer.ui.EventLogPanel
import com.jh.coroutinevisualizer.ui.TimelinePanel
import com.jh.coroutinevisualizer.ui.TreePanel

/**
 * Factory for the Coroutine Visualizer tool window.
 * Creates a bottom tool window with 3 tabs: Tree, Timeline, Event Log.
 */
class CoroutineVisualizerToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(
        project: Project,
        toolWindow: ToolWindow,
    ) {
        val session = PluginSessionManager.getOrCreateSession(project)
        val contentFactory = ContentFactory.getInstance()

        // Tab 1: Coroutine Tree
        val treePanel = TreePanel(project, session)
        val treeContent = contentFactory.createContent(treePanel, "Tree", false)
        toolWindow.contentManager.addContent(treeContent)

        // Tab 2: Timeline
        val timelinePanel = TimelinePanel(project, session)
        val timelineContent = contentFactory.createContent(timelinePanel, "Timeline", false)
        toolWindow.contentManager.addContent(timelineContent)

        // Tab 3: Event Log
        val eventLogPanel = EventLogPanel(project, session)
        val eventLogContent = contentFactory.createContent(eventLogPanel, "Events", false)
        toolWindow.contentManager.addContent(eventLogContent)
    }

    override fun shouldBeAvailable(project: Project): Boolean = true
}

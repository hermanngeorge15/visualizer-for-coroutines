package com.jh.coroutinevisualizer

import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import com.jh.coroutinevisualizer.receiver.PluginEventReceiver
import com.jh.coroutinevisualizer.settings.VisualizerSettings

/**
 * Starts the event receiver when the IDE opens a project (if auto-start is enabled).
 */
class CoroutineVisualizerStartupActivity : ProjectActivity {
    override suspend fun execute(project: Project) {
        val settings = VisualizerSettings.getInstance()
        if (settings.autoStartReceiver) {
            PluginEventReceiver.getInstance(project).start()
        }
    }
}

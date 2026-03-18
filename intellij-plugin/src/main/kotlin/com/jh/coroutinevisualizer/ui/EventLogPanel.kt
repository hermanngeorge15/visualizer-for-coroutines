package com.jh.coroutinevisualizer.ui

import com.intellij.openapi.project.Project
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.table.JBTable
import com.jh.proj.coroutineviz.events.CoroutineEvent
import com.jh.proj.coroutineviz.events.VizEvent
import com.jh.proj.coroutineviz.session.VizSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import java.awt.BorderLayout
import java.awt.Color
import java.awt.Component
import javax.swing.JCheckBox
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.JTable
import javax.swing.JTextField
import javax.swing.SwingUtilities
import javax.swing.table.AbstractTableModel
import javax.swing.table.DefaultTableCellRenderer

/**
 * Event log panel showing all events in a filterable, color-coded table.
 */
class EventLogPanel(
    private val project: Project,
    private val session: VizSession,
) : JPanel() {
    private val tableModel = EventTableModel()
    private val table = JBTable(tableModel)
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    // Filter controls
    private val filterField = JTextField(20)
    private val autoScrollCheckbox = JCheckBox("Auto-scroll", true)

    init {
        layout = BorderLayout()

        // Toolbar
        val toolbar = JPanel()
        toolbar.add(JLabel("Filter:"))
        toolbar.add(filterField)
        toolbar.add(autoScrollCheckbox)
        add(toolbar, BorderLayout.NORTH)

        // Table
        table.setDefaultRenderer(Any::class.java, EventCellRenderer())
        table.autoResizeMode = JTable.AUTO_RESIZE_LAST_COLUMN
        table.columnModel.getColumn(0).preferredWidth = 60 // Seq
        table.columnModel.getColumn(1).preferredWidth = 180 // Kind
        table.columnModel.getColumn(2).preferredWidth = 120 // Coroutine
        table.columnModel.getColumn(3).preferredWidth = 100 // Timestamp
        add(JBScrollPane(table), BorderLayout.CENTER)

        // Filter listener
        filterField.addActionListener {
            tableModel.filter = filterField.text
            tableModel.refresh(session.store.all())
        }

        // Start listening for events
        scope.launch {
            session.eventBus.stream().collect { event ->
                SwingUtilities.invokeLater {
                    tableModel.addEvent(event)
                    if (autoScrollCheckbox.isSelected) {
                        val lastRow = table.rowCount - 1
                        if (lastRow >= 0) {
                            table.scrollRectToVisible(table.getCellRect(lastRow, 0, true))
                        }
                    }
                }
            }
        }
    }

    fun dispose() {
        scope.cancel()
    }
}

/**
 * Table model for the event log.
 */
private class EventTableModel : AbstractTableModel() {
    private val columns = arrayOf("Seq", "Kind", "Coroutine", "Time (ms)")
    private var events = mutableListOf<VizEvent>()
    private var filteredEvents = mutableListOf<VizEvent>()
    var filter: String = ""

    override fun getRowCount(): Int = filteredEvents.size

    override fun getColumnCount(): Int = columns.size

    override fun getColumnName(column: Int): String = columns[column]

    override fun getValueAt(
        rowIndex: Int,
        columnIndex: Int,
    ): Any {
        if (rowIndex >= filteredEvents.size) return ""
        val event = filteredEvents[rowIndex]
        return when (columnIndex) {
            0 -> event.seq
            1 -> event.kind
            2 -> (event as? CoroutineEvent)?.coroutineId ?: "—"
            3 -> "%.2f".format(event.tsNanos / 1_000_000.0)
            else -> ""
        }
    }

    fun addEvent(event: VizEvent) {
        events.add(event)
        if (matchesFilter(event)) {
            filteredEvents.add(event)
            fireTableRowsInserted(filteredEvents.size - 1, filteredEvents.size - 1)
        }
    }

    fun refresh(allEvents: List<VizEvent>) {
        events = allEvents.toMutableList()
        filteredEvents = events.filter { matchesFilter(it) }.toMutableList()
        fireTableDataChanged()
    }

    private fun matchesFilter(event: VizEvent): Boolean {
        if (filter.isBlank()) return true
        val lower = filter.lowercase()
        return event.kind.lowercase().contains(lower) ||
            (event as? CoroutineEvent)?.coroutineId?.lowercase()?.contains(lower) == true
    }
}

/**
 * Color-coded cell renderer for event rows.
 */
private class EventCellRenderer : DefaultTableCellRenderer() {
    override fun getTableCellRendererComponent(
        table: JTable,
        value: Any?,
        isSelected: Boolean,
        hasFocus: Boolean,
        row: Int,
        column: Int,
    ): Component {
        val component = super.getTableCellRendererComponent(table, value, isSelected, hasFocus, row, column)

        if (!isSelected) {
            val kind = table.getValueAt(row, 1).toString()
            background =
                when {
                    kind.contains("Failed") || kind.contains("Error") -> Color(254, 226, 226)
                    kind.contains("Cancelled") -> Color(243, 244, 246)
                    kind.contains("Suspended") -> Color(254, 243, 199)
                    kind.contains("Completed") -> Color(220, 252, 231)
                    kind.contains("Created") -> Color(224, 231, 255)
                    kind.contains("Started") || kind.contains("Resumed") -> Color(237, 233, 254)
                    else -> Color.WHITE
                }
        }

        return component
    }
}

/**
 * Calendar Module
 * Handles calendar views (Month, Week, 3-Day, Day) with task integration
 */

const calendar = {
    // State
    currentDate: new Date(),
    currentView: 'month',
    scheduledTasks: [],
    unscheduledTasks: [],
    calendars: [],
    isInitialized: false,

    // Drag state for time range selection
    dragState: {
        taskId: null,
        startHour: null,
        startMinutes: null,
        currentHour: null,
        currentMinutes: null,
        dateStr: null,
        previewEl: null
    },

    /**
     * Initialize the calendar
     */
    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        this.bindEvents();
        this.bindCalendarModalEvents();
        // Don't load data on init - wait for tab switch
    },

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // View toggle buttons
        document.querySelectorAll('.calendar-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchView(btn.dataset.view);
            });
        });

        // Navigation buttons
        document.getElementById('calendar-prev')?.addEventListener('click', () => this.navigate(-1));
        document.getElementById('calendar-next')?.addEventListener('click', () => this.navigate(1));
        document.getElementById('calendar-today')?.addEventListener('click', () => this.goToToday());

        // Sidebar group toggle (Calendars, Tasks headers)
        document.querySelectorAll('.calendar-sidebar-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const group = toggle.closest('.calendar-sidebar-group');
                group.classList.toggle('collapsed');
            });
        });

        // Sidebar section toggle (Scheduled, Unscheduled within Tasks)
        document.querySelectorAll('.calendar-section-header').forEach(header => {
            header.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling to group toggle
                const section = header.closest('.calendar-section');
                section.classList.toggle('collapsed');
            });
        });
    },

    /**
     * Load calendar data when tab becomes active
     */
    async load() {
        await Promise.all([
            this.loadCalendars(),
            this.loadScheduledTasks(),
            this.loadUnscheduledTasks()
        ]);
        this.updateTotalTasksCount();
        this.render();
    },

    /**
     * Load user's calendars
     */
    async loadCalendars() {
        try {
            const response = await api.getCalendars();
            this.calendars = response.calendars || [];
            this.renderCalendarsList();
        } catch (err) {
            console.error('Failed to load calendars:', err);
        }
    },

    /**
     * Render calendars in sidebar
     */
    renderCalendarsList() {
        const container = document.getElementById('calendars-list');
        if (!container) return;

        if (this.calendars.length === 0) {
            container.innerHTML = '<div class="calendar-task-empty">No calendars</div>';
            return;
        }

        container.innerHTML = this.calendars.map(cal => `
            <div class="calendar-list-item${cal.is_default ? ' active' : ''}" data-calendar-id="${cal.id}">
                <span class="calendar-color" style="background: ${cal.color};"></span>
                <span class="calendar-name">${this.escapeHtml(cal.name)}</span>
            </div>
        `).join('');
    },

    /**
     * Bind events for new calendar modal
     */
    bindCalendarModalEvents() {
        // Open modal button
        document.getElementById('new-calendar-btn')?.addEventListener('click', () => {
            this.openNewCalendarModal();
        });

        // Modal close/cancel
        const modal = document.getElementById('new-calendar-modal');
        if (modal) {
            modal.querySelector('.modal-close')?.addEventListener('click', () => this.closeNewCalendarModal());
            modal.querySelector('.modal-cancel')?.addEventListener('click', () => this.closeNewCalendarModal());
            modal.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeNewCalendarModal());
        }

        // Color presets
        document.querySelectorAll('#calendar-color-presets .color-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.dataset.color;
                document.getElementById('new-calendar-color').value = color;
                // Update active state
                document.querySelectorAll('#calendar-color-presets .color-preset').forEach(p => p.classList.remove('active'));
                preset.classList.add('active');
            });
        });

        // Create button
        document.getElementById('create-calendar-btn')?.addEventListener('click', () => {
            this.createCalendar();
        });

        // Enter key to submit
        document.getElementById('new-calendar-name')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createCalendar();
            }
        });
    },

    /**
     * Open new calendar modal
     */
    openNewCalendarModal() {
        const modal = document.getElementById('new-calendar-modal');
        if (!modal) return;

        // Reset form
        document.getElementById('new-calendar-name').value = '';
        document.getElementById('new-calendar-color').value = '#00aaff';
        document.getElementById('new-calendar-description').value = '';
        document.querySelectorAll('#calendar-color-presets .color-preset').forEach(p => p.classList.remove('active'));
        document.querySelector('#calendar-color-presets .color-preset[data-color="#00aaff"]')?.classList.add('active');

        modal.classList.add('open');
        document.getElementById('new-calendar-name').focus();
    },

    /**
     * Close new calendar modal
     */
    closeNewCalendarModal() {
        const modal = document.getElementById('new-calendar-modal');
        if (modal) {
            modal.classList.remove('open');
        }
    },

    /**
     * Create new calendar
     */
    async createCalendar() {
        const name = document.getElementById('new-calendar-name').value.trim();
        if (!name) {
            document.getElementById('new-calendar-name').focus();
            return;
        }

        const color = document.getElementById('new-calendar-color').value;
        const description = document.getElementById('new-calendar-description').value.trim();

        try {
            await api.createCalendar({ name, color, description });
            this.closeNewCalendarModal();
            await this.loadCalendars();
        } catch (err) {
            console.error('Failed to create calendar:', err);
            alert('Failed to create calendar: ' + err.message);
        }
    },

    /**
     * Update total tasks count in sidebar header
     */
    updateTotalTasksCount() {
        const totalCount = document.getElementById('tasks-total-count');
        if (totalCount) {
            totalCount.textContent = this.scheduledTasks.length + this.unscheduledTasks.length;
        }
    },

    /**
     * Load scheduled tasks (task items with due_date)
     */
    async loadScheduledTasks() {
        try {
            const response = await api.getScheduledTaskItems();
            this.scheduledTasks = response.items || [];
            this.updateSidebarScheduled();
        } catch (err) {
            console.error('Failed to load scheduled tasks:', err);
        }
    },

    /**
     * Load unscheduled tasks (task items without due_date)
     */
    async loadUnscheduledTasks() {
        try {
            const response = await api.getUnscheduledTaskItems();
            this.unscheduledTasks = response.items || [];
            this.updateSidebarUnscheduled();
        } catch (err) {
            console.error('Failed to load unscheduled tasks:', err);
        }
    },

    /**
     * Update sidebar scheduled tasks list
     */
    updateSidebarScheduled() {
        const container = document.getElementById('scheduled-tasks-list');
        const count = document.getElementById('scheduled-count');

        if (count) count.textContent = this.scheduledTasks.length;
        if (!container) return;

        if (this.scheduledTasks.length === 0) {
            container.innerHTML = '<div class="calendar-task-empty">No scheduled tasks</div>';
            return;
        }

        container.innerHTML = this.scheduledTasks.map(task => this.renderSidebarTask(task, true)).join('');
        this.bindSidebarTaskEvents(container);
    },

    /**
     * Update sidebar unscheduled tasks list
     */
    updateSidebarUnscheduled() {
        const container = document.getElementById('unscheduled-tasks-list');
        const count = document.getElementById('unscheduled-count');

        if (count) count.textContent = this.unscheduledTasks.length;
        if (!container) return;

        if (this.unscheduledTasks.length === 0) {
            container.innerHTML = '<div class="calendar-task-empty">No unscheduled tasks</div>';
            return;
        }

        container.innerHTML = this.unscheduledTasks.map(task => this.renderSidebarTask(task, false)).join('');
        this.bindSidebarTaskEvents(container);
    },

    /**
     * Render a sidebar task item
     */
    renderSidebarTask(task, isScheduled) {
        // Task items use 'important' flag instead of priority
        const isImportant = task.important;
        let timeDisplay = '';

        if (isScheduled && task.due_date) {
            const date = new Date(task.due_date + 'T00:00:00');
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            if (task.due_time) {
                const timeStr = task.due_time_end
                    ? `${this.formatTime(task.due_time)} - ${this.formatTime(task.due_time_end)}`
                    : this.formatTime(task.due_time);
                timeDisplay = `${dateStr} ${timeStr}`;
            } else {
                timeDisplay = dateStr;
            }
        }

        return `
            <div class="calendar-task-item${isImportant ? ' important' : ''}" data-id="${task.id}" draggable="true">
                ${isImportant ? '<span class="important-star">★</span>' : '<span class="task-bullet"></span>'}
                <div class="calendar-task-info">
                    <div class="calendar-task-title">${this.escapeHtml(task.title)}</div>
                    ${timeDisplay ? `<div class="calendar-task-time">${timeDisplay}</div>` : ''}
                </div>
            </div>
        `;
    },

    /**
     * Bind events to sidebar task items
     */
    bindSidebarTaskEvents(container) {
        container.querySelectorAll('.calendar-task-item').forEach(item => {
            // Click to open task item modal
            item.addEventListener('click', () => {
                const taskId = item.dataset.id;
                const task = this.findTask(taskId);
                if (task && typeof taskModal !== 'undefined') {
                    taskModal.openTask(task);
                }
            });

            // Drag start
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.setData('text/plain', item.dataset.id);
                e.dataTransfer.effectAllowed = 'move';
            });

            // Drag end
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });
        });
    },

    /**
     * Find a task by ID from either list
     */
    findTask(id) {
        return this.scheduledTasks.find(t => t.id === id) ||
               this.unscheduledTasks.find(t => t.id === id);
    },

    /**
     * Switch to a different view
     */
    switchView(viewName) {
        this.currentView = viewName;

        // Update active button
        document.querySelectorAll('.calendar-view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        // Update active view container
        document.querySelectorAll('.calendar-view').forEach(view => {
            view.classList.toggle('active', view.dataset.view === viewName);
        });

        this.render();
    },

    /**
     * Navigate forward/backward
     */
    navigate(direction) {
        switch (this.currentView) {
            case 'month':
                this.currentDate.setMonth(this.currentDate.getMonth() + direction);
                break;
            case 'week':
                this.currentDate.setDate(this.currentDate.getDate() + (7 * direction));
                break;
            case '3day':
                this.currentDate.setDate(this.currentDate.getDate() + (3 * direction));
                break;
            case 'day':
                this.currentDate.setDate(this.currentDate.getDate() + direction);
                break;
        }
        this.render();
    },

    /**
     * Go to today
     */
    goToToday() {
        this.currentDate = new Date();
        this.render();
    },

    /**
     * Main render function
     */
    render() {
        this.updateTitle();

        switch (this.currentView) {
            case 'month':
                this.renderMonthView();
                break;
            case 'week':
                this.renderWeekView();
                break;
            case '3day':
                this.renderThreeDayView();
                break;
            case 'day':
                this.renderDayView();
                break;
        }
    },

    /**
     * Update the calendar title
     */
    updateTitle() {
        const titleEl = document.getElementById('calendar-title');
        if (!titleEl) return;

        const options = { year: 'numeric' };

        switch (this.currentView) {
            case 'month':
                options.month = 'long';
                titleEl.textContent = this.currentDate.toLocaleDateString('en-US', options);
                break;
            case 'week':
            case '3day':
                const start = this.getWeekStart(this.currentView === '3day' ? 3 : 7);
                const end = new Date(start);
                end.setDate(end.getDate() + (this.currentView === '3day' ? 2 : 6));

                if (start.getMonth() === end.getMonth()) {
                    titleEl.textContent = `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.getDate()}, ${start.getFullYear()}`;
                } else {
                    titleEl.textContent = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                }
                break;
            case 'day':
                titleEl.textContent = this.currentDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                });
                break;
        }
    },

    /**
     * Render Month View
     */
    renderMonthView() {
        const grid = document.getElementById('month-grid');
        if (!grid) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const today = new Date();

        // Get first day of month and total days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay(); // 0 = Sunday
        const totalDays = lastDay.getDate();

        // Get last days of previous month
        const prevMonthLastDay = new Date(year, month, 0).getDate();

        // Build grid cells
        let cells = [];

        // Previous month days
        for (let i = startDay - 1; i >= 0; i--) {
            const day = prevMonthLastDay - i;
            const date = new Date(year, month - 1, day);
            cells.push(this.renderMonthCell(date, true));
        }

        // Current month days
        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(year, month, day);
            const isToday = date.toDateString() === today.toDateString();
            cells.push(this.renderMonthCell(date, false, isToday));
        }

        // Next month days (fill remaining)
        const remaining = 42 - cells.length;
        for (let day = 1; day <= remaining; day++) {
            const date = new Date(year, month + 1, day);
            cells.push(this.renderMonthCell(date, true));
        }

        grid.innerHTML = cells.join('');
        this.bindMonthCellEvents(grid);
    },

    /**
     * Render a single month cell
     */
    renderMonthCell(date, isOtherMonth, isToday = false) {
        const dateStr = this.formatDateISO(date);
        const dayTasks = this.getTasksForDate(dateStr);

        let classes = 'month-cell';
        if (isOtherMonth) classes += ' other-month';
        if (isToday) classes += ' today';

        const eventsHtml = dayTasks.slice(0, 3).map(task => {
            const importantClass = task.important ? ' important' : '';
            return `<div class="month-event${importantClass}" data-id="${task.id}" title="${this.escapeHtml(task.title)}">${this.escapeHtml(task.title)}</div>`;
        }).join('');

        const moreCount = dayTasks.length - 3;
        const moreHtml = moreCount > 0 ? `<div class="month-more">+${moreCount} more</div>` : '';

        return `
            <div class="${classes}" data-date="${dateStr}">
                <div class="month-date">${date.getDate()}</div>
                <div class="month-events">
                    ${eventsHtml}
                    ${moreHtml}
                </div>
            </div>
        `;
    },

    /**
     * Bind events to month cells
     */
    bindMonthCellEvents(grid) {
        // Drop zone for scheduling
        grid.querySelectorAll('.month-cell').forEach(cell => {
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                cell.classList.add('calendar-drop-target');
            });

            cell.addEventListener('dragleave', () => {
                cell.classList.remove('calendar-drop-target');
            });

            cell.addEventListener('drop', async (e) => {
                e.preventDefault();
                cell.classList.remove('calendar-drop-target');

                const taskId = e.dataTransfer.getData('text/plain');
                const date = cell.dataset.date;

                if (taskId && date) {
                    await this.scheduleTaskOnDate(taskId, date);
                }
            });

            // Click on cell to potentially add task
            cell.addEventListener('click', (e) => {
                if (e.target.classList.contains('month-event')) {
                    // Click on event, open task
                    const taskId = e.target.dataset.id;
                    const task = this.findTask(taskId);
                    if (task) modal.openEdit(task);
                }
            });
        });

        // Click on events
        grid.querySelectorAll('.month-event').forEach(event => {
            event.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = event.dataset.id;
                const task = this.findTask(taskId);
                if (task && typeof taskModal !== 'undefined') {
                    taskModal.openTask(task);
                }
            });
        });
    },

    /**
     * Schedule a task on a specific date
     */
    async scheduleTaskOnDate(taskId, date, startTime = null, endTime = null, isAllDay = true) {
        try {
            const scheduleData = {
                due_date: date
            };

            if (startTime && !isAllDay) {
                scheduleData.due_time = startTime;
                if (endTime) {
                    scheduleData.due_time_end = endTime;
                }
            }

            await api.scheduleTaskItem(taskId, scheduleData);
            await this.load(); // Reload calendar data

            // Also refresh the Tasks section so it shows updated times
            if (typeof taskManager !== 'undefined' && taskManager.loadTasks) {
                taskManager.loadTasks();
                taskManager.loadCounts();
            }
        } catch (err) {
            console.error('Failed to schedule task:', err);
            alert('Failed to schedule task: ' + err.message);
        }
    },

    /**
     * Render Week View
     */
    renderWeekView() {
        this.renderMultiDayView(7, 'week');
    },

    /**
     * Render 3-Day View
     */
    renderThreeDayView() {
        this.renderMultiDayView(3, 'three-day');
    },

    /**
     * Render multi-day view (Week or 3-Day)
     */
    renderMultiDayView(numDays, prefix) {
        const headerEl = document.getElementById(`${prefix}-header`);
        const columnsEl = document.getElementById(`${prefix}-columns`);
        const gutterEl = document.getElementById(`${prefix}-time-gutter`);

        if (!headerEl || !columnsEl || !gutterEl) return;

        const startDate = this.getWeekStart(numDays);
        const today = new Date();

        // Render header
        let headerHtml = '<div class="week-header-cell"></div>'; // Empty cell for gutter alignment
        for (let i = 0; i < numDays; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const isToday = date.toDateString() === today.toDateString();

            headerHtml += `
                <div class="week-header-cell${isToday ? ' today' : ''}" data-date="${this.formatDateISO(date)}">
                    <div class="week-header-day">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div class="week-header-date">${date.getDate()}</div>
                </div>
            `;
        }
        headerEl.innerHTML = headerHtml;

        // Render time gutter
        let gutterHtml = '';
        for (let hour = 0; hour < 24; hour++) {
            gutterHtml += `<div class="time-slot-label">${this.formatHour(hour)}</div>`;
        }
        gutterEl.innerHTML = gutterHtml;

        // Render columns
        let columnsHtml = '';
        for (let i = 0; i < numDays; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = this.formatDateISO(date);

            let slotsHtml = '';
            for (let hour = 0; hour < 24; hour++) {
                slotsHtml += `<div class="week-hour-slot" data-hour="${hour}"></div>`;
            }

            columnsHtml += `
                <div class="week-column" data-date="${dateStr}">
                    <div class="week-all-day" data-date="${dateStr}"></div>
                    ${slotsHtml}
                </div>
            `;
        }
        columnsEl.innerHTML = columnsHtml;

        // Place tasks on the grid
        this.placeTasksOnMultiDayView(columnsEl, startDate, numDays);
        this.bindMultiDayViewEvents(columnsEl);
    },

    /**
     * Place tasks on multi-day view grid
     */
    placeTasksOnMultiDayView(columnsEl, startDate, numDays) {
        for (let i = 0; i < numDays; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = this.formatDateISO(date);
            const dayTasks = this.getTasksForDate(dateStr);

            const column = columnsEl.querySelector(`.week-column[data-date="${dateStr}"]`);
            if (!column) continue;

            const allDaySection = column.querySelector('.week-all-day');

            dayTasks.forEach(task => {
                if (!task.due_time) {
                    // No time specified - show in all-day section
                    if (allDaySection) {
                        const el = document.createElement('div');
                        el.className = `all-day-event${task.important ? ' important' : ''}`;
                        el.dataset.id = task.id;
                        el.textContent = task.title;
                        el.title = task.title;
                        allDaySection.appendChild(el);
                    }
                } else {
                    // Timed event
                    this.placeTimedTask(column, task);
                }
            });
        }
    },

    /**
     * Place a timed task on a column
     */
    placeTimedTask(column, task) {
        if (!task.due_time) return;

        const [startHour, startMin] = task.due_time.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;

        // Use end time if available, otherwise default 1 hour
        let endMinutes = startMinutes + 60;
        if (task.due_time_end) {
            const [endHour, endMin] = task.due_time_end.split(':').map(Number);
            endMinutes = endHour * 60 + endMin;
        }

        const top = (startMinutes / 60) * 60; // 60px per hour
        const height = Math.max(((endMinutes - startMinutes) / 60) * 60, 20);

        const timeDisplay = task.due_time_end
            ? `${this.formatTime(task.due_time)} - ${this.formatTime(task.due_time_end)}`
            : this.formatTime(task.due_time);

        const block = document.createElement('div');
        block.className = `time-block${task.important ? ' important' : ''}`;
        block.dataset.id = task.id;
        block.style.top = `${top + 40}px`; // +40 for all-day section
        block.style.height = `${height}px`;

        block.innerHTML = `
            <div class="time-block-title">${this.escapeHtml(task.title)}</div>
            <div class="time-block-time">${timeDisplay}</div>
        `;

        column.style.position = 'relative';
        column.appendChild(block);
    },

    /**
     * Bind events to multi-day view
     */
    bindMultiDayViewEvents(columnsEl) {
        // Click on time blocks
        columnsEl.querySelectorAll('.time-block, .all-day-event').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = el.dataset.id;
                const task = this.findTask(taskId);
                if (task && typeof taskModal !== 'undefined') {
                    taskModal.openTask(task);
                }
            });
        });

        // Drag range selection on hour slots
        columnsEl.querySelectorAll('.week-hour-slot').forEach(slot => {
            slot.addEventListener('dragenter', (e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.types.includes('text/plain') ? 'pending' : null;
                if (!taskId) return;

                const column = slot.closest('.week-column');
                const hour = parseInt(slot.dataset.hour, 10);

                // If this is the first slot entered, set as start
                if (this.dragState.startHour === null) {
                    this.dragState.startHour = hour;
                    this.dragState.dateStr = column.dataset.date;
                    this.createDragPreview(column, hour);
                }

                // Update current position
                this.dragState.currentHour = hour;
                this.updateDragPreview(column);
            });

            slot.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                const column = slot.closest('.week-column');
                const hour = parseInt(slot.dataset.hour, 10);

                // Update current position for smooth preview
                if (this.dragState.startHour !== null && this.dragState.dateStr === column.dataset.date) {
                    this.dragState.currentHour = hour;
                    this.updateDragPreview(column);
                }
            });

            slot.addEventListener('drop', async (e) => {
                e.preventDefault();

                const taskId = e.dataTransfer.getData('text/plain');
                const column = slot.closest('.week-column');
                const date = column.dataset.date;
                const dropHour = parseInt(slot.dataset.hour, 10);

                // Calculate start and end from drag state
                let startHour = this.dragState.startHour;
                let endHour = dropHour;

                // If no drag state, use single hour
                if (startHour === null) {
                    startHour = dropHour;
                    endHour = dropHour + 1;
                } else {
                    // Ensure start < end
                    if (startHour > endHour) {
                        [startHour, endHour] = [endHour, startHour];
                    }
                    endHour = endHour + 1; // End is exclusive
                }

                const startTime = `${startHour.toString().padStart(2, '0')}:00`;
                const endTime = `${endHour.toString().padStart(2, '0')}:00`;

                // Clear drag state
                this.clearDragState();

                if (taskId && date) {
                    await this.scheduleTaskOnDate(taskId, date, startTime, endTime, false);
                }
            });
        });

        // Clear drag state when leaving the column area
        columnsEl.addEventListener('dragleave', (e) => {
            // Only clear if leaving the entire columns area
            if (!columnsEl.contains(e.relatedTarget)) {
                this.clearDragState();
            }
        });

        // Drop zones on all-day sections
        columnsEl.querySelectorAll('.week-all-day').forEach(section => {
            section.addEventListener('dragenter', () => {
                this.clearDragState(); // Clear time selection when entering all-day
            });

            section.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                section.classList.add('calendar-drop-target');
            });

            section.addEventListener('dragleave', () => {
                section.classList.remove('calendar-drop-target');
            });

            section.addEventListener('drop', async (e) => {
                e.preventDefault();
                section.classList.remove('calendar-drop-target');
                this.clearDragState();

                const taskId = e.dataTransfer.getData('text/plain');
                const date = section.dataset.date;

                if (taskId && date) {
                    await this.scheduleTaskOnDate(taskId, date, null, null, true);
                }
            });
        });
    },

    /**
     * Create drag preview element
     */
    createDragPreview(column, startHour) {
        this.removeDragPreview();

        const preview = document.createElement('div');
        preview.className = 'time-selection';
        preview.id = 'drag-time-preview';

        const top = startHour * 60 + 40; // 60px per hour + all-day offset
        preview.style.top = `${top}px`;
        preview.style.height = '60px';

        column.style.position = 'relative';
        column.appendChild(preview);
        this.dragState.previewEl = preview;
    },

    /**
     * Update drag preview to show time range
     */
    updateDragPreview(column) {
        if (!this.dragState.previewEl || this.dragState.startHour === null) return;

        let startHour = this.dragState.startHour;
        let endHour = this.dragState.currentHour;

        // Swap if dragging upward
        if (startHour > endHour) {
            [startHour, endHour] = [endHour, startHour];
        }

        const top = startHour * 60 + 40;
        const height = (endHour - startHour + 1) * 60;

        this.dragState.previewEl.style.top = `${top}px`;
        this.dragState.previewEl.style.height = `${height}px`;
    },

    /**
     * Remove drag preview element
     */
    removeDragPreview() {
        const existing = document.getElementById('drag-time-preview');
        if (existing) {
            existing.remove();
        }
        this.dragState.previewEl = null;
    },

    /**
     * Clear all drag state
     */
    clearDragState() {
        this.removeDragPreview();
        this.dragState.taskId = null;
        this.dragState.startHour = null;
        this.dragState.currentHour = null;
        this.dragState.dateStr = null;
    },

    /**
     * Render Day View
     */
    renderDayView() {
        const headerEl = document.getElementById('day-header');
        const gutterEl = document.getElementById('day-time-gutter');
        const hourGridEl = document.getElementById('day-hour-grid');
        const allDayEventsEl = document.getElementById('day-all-day-events');

        if (!headerEl || !hourGridEl) return;

        const today = new Date();
        const isToday = this.currentDate.toDateString() === today.toDateString();
        const dateStr = this.formatDateISO(this.currentDate);

        // Render header
        headerEl.className = `day-header${isToday ? ' today' : ''}`;
        headerEl.innerHTML = `
            <div class="day-header-day">${this.currentDate.toLocaleDateString('en-US', { weekday: 'long' })}</div>
            <div class="day-header-date">${this.currentDate.getDate()}</div>
        `;

        // Render hour grid
        let hourGridHtml = '';
        for (let hour = 0; hour < 24; hour++) {
            hourGridHtml += `
                <div class="hour-row">
                    <div class="hour-label">${this.formatHour(hour)}</div>
                    <div class="hour-content" data-hour="${hour}" data-date="${dateStr}"></div>
                </div>
            `;
        }
        hourGridEl.innerHTML = hourGridHtml;

        // Clear all-day events
        if (allDayEventsEl) {
            allDayEventsEl.innerHTML = '';
        }

        // Place tasks
        const dayTasks = this.getTasksForDate(dateStr);
        dayTasks.forEach(task => {
            if (!task.due_time) {
                // No time - show in all-day section
                if (allDayEventsEl) {
                    const el = document.createElement('div');
                    el.className = `all-day-event${task.important ? ' important' : ''}`;
                    el.dataset.id = task.id;
                    el.textContent = task.title;
                    allDayEventsEl.appendChild(el);
                }
            } else {
                // Timed event
                this.placeTimedTaskOnDayView(hourGridEl, task);
            }
        });

        this.bindDayViewEvents(hourGridEl, allDayEventsEl);
    },

    /**
     * Place a timed task on day view
     */
    placeTimedTaskOnDayView(hourGridEl, task) {
        if (!task.due_time) return;

        const [startHour, startMin] = task.due_time.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;

        // Use end time if available, otherwise default 1 hour
        let endMinutes = startMinutes + 60;
        if (task.due_time_end) {
            const [endHour, endMin] = task.due_time_end.split(':').map(Number);
            endMinutes = endHour * 60 + endMin;
        }

        const hourRow = hourGridEl.querySelector(`.hour-content[data-hour="${startHour}"]`);
        if (!hourRow) return;

        const topOffset = (startMin / 60) * 60; // Position within the hour
        const height = Math.max(((endMinutes - startMinutes) / 60) * 60, 20);

        const timeDisplay = task.due_time_end
            ? `${this.formatTime(task.due_time)} - ${this.formatTime(task.due_time_end)}`
            : this.formatTime(task.due_time);

        const block = document.createElement('div');
        block.className = `time-block${task.important ? ' important' : ''}`;
        block.dataset.id = task.id;
        block.style.top = `${topOffset}px`;
        block.style.height = `${height}px`;

        block.innerHTML = `
            <div class="time-block-title">${this.escapeHtml(task.title)}</div>
            <div class="time-block-time">${timeDisplay}</div>
        `;

        hourRow.style.position = 'relative';
        hourRow.appendChild(block);
    },

    /**
     * Bind events to day view
     */
    bindDayViewEvents(hourGridEl, allDayEventsEl) {
        // Click on time blocks
        hourGridEl.querySelectorAll('.time-block').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = el.dataset.id;
                const task = this.findTask(taskId);
                if (task && typeof taskModal !== 'undefined') {
                    taskModal.openTask(task);
                }
            });
        });

        if (allDayEventsEl) {
            allDayEventsEl.querySelectorAll('.all-day-event').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const taskId = el.dataset.id;
                    const task = this.findTask(taskId);
                    if (task && typeof taskModal !== 'undefined') {
                        taskModal.openTask(task);
                    }
                });
            });

            // Drop zone for all-day
            const allDaySection = allDayEventsEl.closest('.all-day-section');
            if (allDaySection) {
                allDaySection.addEventListener('dragenter', () => {
                    this.clearDragState();
                });

                allDaySection.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    allDaySection.classList.add('calendar-drop-target');
                });

                allDaySection.addEventListener('dragleave', () => {
                    allDaySection.classList.remove('calendar-drop-target');
                });

                allDaySection.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    allDaySection.classList.remove('calendar-drop-target');
                    this.clearDragState();

                    const taskId = e.dataTransfer.getData('text/plain');
                    const dateStr = this.formatDateISO(this.currentDate);

                    if (taskId) {
                        await this.scheduleTaskOnDate(taskId, dateStr, null, null, true);
                    }
                });
            }
        }

        // Drag range selection on hour content areas
        hourGridEl.querySelectorAll('.hour-content').forEach(hourContent => {
            hourContent.addEventListener('dragenter', (e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.types.includes('text/plain') ? 'pending' : null;
                if (!taskId) return;

                const hour = parseInt(hourContent.dataset.hour, 10);
                const dateStr = hourContent.dataset.date;

                // If this is the first slot entered, set as start
                if (this.dragState.startHour === null) {
                    this.dragState.startHour = hour;
                    this.dragState.dateStr = dateStr;
                    this.createDayDragPreview(hourGridEl, hour);
                }

                // Update current position
                this.dragState.currentHour = hour;
                this.updateDayDragPreview(hourGridEl);
            });

            hourContent.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                const hour = parseInt(hourContent.dataset.hour, 10);

                // Update current position for smooth preview
                if (this.dragState.startHour !== null) {
                    this.dragState.currentHour = hour;
                    this.updateDayDragPreview(hourGridEl);
                }
            });

            hourContent.addEventListener('drop', async (e) => {
                e.preventDefault();

                const taskId = e.dataTransfer.getData('text/plain');
                const date = hourContent.dataset.date;
                const dropHour = parseInt(hourContent.dataset.hour, 10);

                // Calculate start and end from drag state
                let startHour = this.dragState.startHour;
                let endHour = dropHour;

                // If no drag state, use single hour
                if (startHour === null) {
                    startHour = dropHour;
                    endHour = dropHour + 1;
                } else {
                    // Ensure start < end
                    if (startHour > endHour) {
                        [startHour, endHour] = [endHour, startHour];
                    }
                    endHour = endHour + 1; // End is exclusive
                }

                const startTime = `${startHour.toString().padStart(2, '0')}:00`;
                const endTime = `${endHour.toString().padStart(2, '0')}:00`;

                // Clear drag state
                this.clearDragState();

                if (taskId && date) {
                    await this.scheduleTaskOnDate(taskId, date, startTime, endTime, false);
                }
            });
        });

        // Clear drag state when leaving the hour grid
        hourGridEl.addEventListener('dragleave', (e) => {
            if (!hourGridEl.contains(e.relatedTarget)) {
                this.clearDragState();
            }
        });
    },

    /**
     * Create drag preview for day view
     */
    createDayDragPreview(hourGridEl, startHour) {
        this.removeDragPreview();

        const preview = document.createElement('div');
        preview.className = 'time-selection';
        preview.id = 'drag-time-preview';

        // Position relative to the hour grid
        const hourRow = hourGridEl.querySelector(`.hour-content[data-hour="${startHour}"]`);
        if (!hourRow) return;

        const hourRowParent = hourRow.closest('.hour-row');
        if (!hourRowParent) return;

        // Get offset from top of hour grid
        const gridRect = hourGridEl.getBoundingClientRect();
        const rowRect = hourRowParent.getBoundingClientRect();
        const top = rowRect.top - gridRect.top;

        preview.style.top = `${top}px`;
        preview.style.height = '60px';
        preview.style.left = '60px'; // After time label
        preview.style.right = '0';

        hourGridEl.style.position = 'relative';
        hourGridEl.appendChild(preview);
        this.dragState.previewEl = preview;
    },

    /**
     * Update drag preview for day view
     */
    updateDayDragPreview(hourGridEl) {
        if (!this.dragState.previewEl || this.dragState.startHour === null) return;

        let startHour = this.dragState.startHour;
        let endHour = this.dragState.currentHour;

        // Swap if dragging upward
        if (startHour > endHour) {
            [startHour, endHour] = [endHour, startHour];
        }

        // Calculate position
        const startRow = hourGridEl.querySelector(`.hour-content[data-hour="${startHour}"]`)?.closest('.hour-row');
        if (!startRow) return;

        const gridRect = hourGridEl.getBoundingClientRect();
        const rowRect = startRow.getBoundingClientRect();
        const top = rowRect.top - gridRect.top;
        const height = (endHour - startHour + 1) * 60;

        this.dragState.previewEl.style.top = `${top}px`;
        this.dragState.previewEl.style.height = `${height}px`;
    },

    // ==================
    // HELPER FUNCTIONS
    // ==================

    /**
     * Get tasks for a specific date
     */
    getTasksForDate(dateStr) {
        return this.scheduledTasks.filter(task => task.due_date === dateStr);
    },

    /**
     * Get the start date for week/3-day view
     */
    getWeekStart(numDays) {
        const date = new Date(this.currentDate);
        if (numDays === 7) {
            // Week starts on Sunday
            const day = date.getDay();
            date.setDate(date.getDate() - day);
        }
        // For 3-day, use current date as start
        return date;
    },

    /**
     * Format date as ISO string (YYYY-MM-DD)
     */
    formatDateISO(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Format hour for display (e.g., "9 AM")
     */
    formatHour(hour) {
        if (hour === 0) return '12 AM';
        if (hour === 12) return '12 PM';
        if (hour < 12) return `${hour} AM`;
        return `${hour - 12} PM`;
    },

    /**
     * Format time string (HH:MM) for display
     */
    formatTime(timeStr) {
        if (!timeStr) return '';
        const [hour, min] = timeStr.split(':').map(Number);
        const suffix = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return min === 0 ? `${displayHour} ${suffix}` : `${displayHour}:${min.toString().padStart(2, '0')} ${suffix}`;
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => calendar.init());

// Make available globally
window.calendar = calendar;

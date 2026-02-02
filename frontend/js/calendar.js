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
    isInitialized: false,

    /**
     * Initialize the calendar
     */
    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        this.bindEvents();
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

        // Sidebar section toggle
        document.querySelectorAll('.calendar-section-header').forEach(header => {
            header.addEventListener('click', () => {
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
            this.loadScheduledTasks(),
            this.loadUnscheduledTasks()
        ]);
        this.render();
    },

    /**
     * Load scheduled tasks
     */
    async loadScheduledTasks() {
        try {
            const response = await api.getScheduledTasks();
            this.scheduledTasks = response.tasks || [];
            this.updateSidebarScheduled();
        } catch (err) {
            console.error('Failed to load scheduled tasks:', err);
        }
    },

    /**
     * Load unscheduled tasks
     */
    async loadUnscheduledTasks() {
        try {
            const response = await api.getUnscheduledTasks();
            this.unscheduledTasks = response.tasks || [];
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
        const priority = task.priority || 3;
        let timeDisplay = '';

        if (isScheduled && task.scheduled_date) {
            const date = new Date(task.scheduled_date + 'T00:00:00');
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            if (task.is_all_day) {
                timeDisplay = `${dateStr} (All day)`;
            } else if (task.scheduled_start) {
                timeDisplay = `${dateStr} ${this.formatTime(task.scheduled_start)}`;
            } else {
                timeDisplay = dateStr;
            }
        }

        return `
            <div class="calendar-task-item" data-id="${task.id}" draggable="true">
                <span class="priority-dot priority-${priority}"></span>
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
            // Click to open task modal
            item.addEventListener('click', () => {
                const taskId = item.dataset.id;
                const task = this.findTask(taskId);
                if (task) {
                    modal.openEdit(task);
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
            const priority = task.priority || 3;
            return `<div class="month-event priority-${priority}" data-id="${task.id}" title="${this.escapeHtml(task.title)}">${this.escapeHtml(task.title)}</div>`;
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
                if (task) modal.openEdit(task);
            });
        });
    },

    /**
     * Schedule a task on a specific date
     */
    async scheduleTaskOnDate(taskId, date, startTime = null, endTime = null, isAllDay = true) {
        try {
            const scheduleData = {
                scheduled_date: date,
                is_all_day: isAllDay
            };

            if (startTime) {
                scheduleData.scheduled_start = startTime;
                scheduleData.is_all_day = false;
            }
            if (endTime) {
                scheduleData.scheduled_end = endTime;
            }

            await api.scheduleTask(taskId, scheduleData);
            await this.load(); // Reload all data
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
                if (task.is_all_day || !task.scheduled_start) {
                    // All-day or no time specified
                    if (allDaySection) {
                        const el = document.createElement('div');
                        el.className = `all-day-event priority-${task.priority || 3}`;
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
        if (!task.scheduled_start) return;

        const [startHour, startMin] = task.scheduled_start.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;

        let endMinutes = startMinutes + 60; // Default 1 hour
        if (task.scheduled_end) {
            const [endHour, endMin] = task.scheduled_end.split(':').map(Number);
            endMinutes = endHour * 60 + endMin;
        }

        const top = (startMinutes / 60) * 60; // 60px per hour
        const height = Math.max(((endMinutes - startMinutes) / 60) * 60, 20);

        const block = document.createElement('div');
        block.className = `time-block priority-${task.priority || 3}`;
        block.dataset.id = task.id;
        block.style.top = `${top + 40}px`; // +40 for all-day section
        block.style.height = `${height}px`;

        block.innerHTML = `
            <div class="time-block-title">${this.escapeHtml(task.title)}</div>
            <div class="time-block-time">${this.formatTime(task.scheduled_start)}${task.scheduled_end ? ' - ' + this.formatTime(task.scheduled_end) : ''}</div>
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
                if (task) modal.openEdit(task);
            });
        });

        // Drop zones on hour slots
        columnsEl.querySelectorAll('.week-hour-slot').forEach(slot => {
            slot.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                slot.classList.add('calendar-drop-target');
            });

            slot.addEventListener('dragleave', () => {
                slot.classList.remove('calendar-drop-target');
            });

            slot.addEventListener('drop', async (e) => {
                e.preventDefault();
                slot.classList.remove('calendar-drop-target');

                const taskId = e.dataTransfer.getData('text/plain');
                const column = slot.closest('.week-column');
                const date = column.dataset.date;
                const hour = parseInt(slot.dataset.hour, 10);
                const startTime = `${hour.toString().padStart(2, '0')}:00`;
                const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

                if (taskId && date) {
                    await this.scheduleTaskOnDate(taskId, date, startTime, endTime, false);
                }
            });
        });

        // Drop zones on all-day sections
        columnsEl.querySelectorAll('.week-all-day').forEach(section => {
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

                const taskId = e.dataTransfer.getData('text/plain');
                const date = section.dataset.date;

                if (taskId && date) {
                    await this.scheduleTaskOnDate(taskId, date, null, null, true);
                }
            });
        });
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
            if (task.is_all_day || !task.scheduled_start) {
                // All-day event
                if (allDayEventsEl) {
                    const el = document.createElement('div');
                    el.className = `all-day-event priority-${task.priority || 3}`;
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
        if (!task.scheduled_start) return;

        const [startHour, startMin] = task.scheduled_start.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;

        let endMinutes = startMinutes + 60;
        if (task.scheduled_end) {
            const [endHour, endMin] = task.scheduled_end.split(':').map(Number);
            endMinutes = endHour * 60 + endMin;
        }

        const hourRow = hourGridEl.querySelector(`.hour-content[data-hour="${startHour}"]`);
        if (!hourRow) return;

        const topOffset = (startMin / 60) * 60; // Position within the hour
        const height = Math.max(((endMinutes - startMinutes) / 60) * 60, 20);

        const block = document.createElement('div');
        block.className = `time-block priority-${task.priority || 3}`;
        block.dataset.id = task.id;
        block.style.top = `${topOffset}px`;
        block.style.height = `${height}px`;

        block.innerHTML = `
            <div class="time-block-title">${this.escapeHtml(task.title)}</div>
            <div class="time-block-time">${this.formatTime(task.scheduled_start)}${task.scheduled_end ? ' - ' + this.formatTime(task.scheduled_end) : ''}</div>
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
                if (task) modal.openEdit(task);
            });
        });

        if (allDayEventsEl) {
            allDayEventsEl.querySelectorAll('.all-day-event').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const taskId = el.dataset.id;
                    const task = this.findTask(taskId);
                    if (task) modal.openEdit(task);
                });
            });

            // Drop zone for all-day
            const allDaySection = allDayEventsEl.closest('.all-day-section');
            if (allDaySection) {
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

                    const taskId = e.dataTransfer.getData('text/plain');
                    const dateStr = this.formatDateISO(this.currentDate);

                    if (taskId) {
                        await this.scheduleTaskOnDate(taskId, dateStr, null, null, true);
                    }
                });
            }
        }

        // Drop zones on hour content areas
        hourGridEl.querySelectorAll('.hour-content').forEach(hourContent => {
            hourContent.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                hourContent.classList.add('calendar-drop-target');
            });

            hourContent.addEventListener('dragleave', () => {
                hourContent.classList.remove('calendar-drop-target');
            });

            hourContent.addEventListener('drop', async (e) => {
                e.preventDefault();
                hourContent.classList.remove('calendar-drop-target');

                const taskId = e.dataTransfer.getData('text/plain');
                const date = hourContent.dataset.date;
                const hour = parseInt(hourContent.dataset.hour, 10);
                const startTime = `${hour.toString().padStart(2, '0')}:00`;
                const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

                if (taskId && date) {
                    await this.scheduleTaskOnDate(taskId, date, startTime, endTime, false);
                }
            });
        });
    },

    // ==================
    // HELPER FUNCTIONS
    // ==================

    /**
     * Get tasks for a specific date
     */
    getTasksForDate(dateStr) {
        return this.scheduledTasks.filter(task => task.scheduled_date === dateStr);
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

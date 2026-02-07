/**
 * Apex Jobs Module - Displays restoration jobs from Zoho
 * Read-only view with Kanban, List, and Card views
 */

const apexJobs = {
    jobs: [],
    stats: {},
    syncedAt: null,
    currentView: 'kanban',
    filters: {
        status: 'all',
        lossType: 'all',
        owner: 'all'
    },
    sort: {
        field: 'name',
        direction: 'asc'
    },

    init() {
        this.bindEvents();
        // Don't auto-load - wait until tab is activated
    },

    bindEvents() {
        // View switching (apex-specific)
        document.querySelectorAll('.apex-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchView(btn.dataset.view);
            });
        });

        // Filter events
        const statusFilter = document.getElementById('apex-filter-status');
        const lossFilter = document.getElementById('apex-filter-loss');
        const ownerFilter = document.getElementById('apex-filter-owner');

        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.renderCurrentView();
            });
        }
        if (lossFilter) {
            lossFilter.addEventListener('change', (e) => {
                this.filters.lossType = e.target.value;
                this.renderCurrentView();
            });
        }
        if (ownerFilter) {
            ownerFilter.addEventListener('change', (e) => {
                this.filters.owner = e.target.value;
                this.renderCurrentView();
            });
        }

        // Sortable columns in list view
        document.querySelectorAll('.apex-task-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                this.handleSort(th.dataset.sort);
            });
        });
    },

    switchView(viewName) {
        this.currentView = viewName;

        // Update view buttons
        document.querySelectorAll('.apex-view-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.view === viewName);
        });

        // Update view containers
        document.querySelectorAll('.apex-view-container').forEach(c => {
            c.classList.toggle('active', c.dataset.view === viewName);
        });

        this.renderCurrentView();
    },

    handleSort(field) {
        // Toggle direction if same field, otherwise reset to asc
        if (this.sort.field === field) {
            this.sort.direction = this.sort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sort.field = field;
            this.sort.direction = 'asc';
        }

        // Update UI
        document.querySelectorAll('.apex-task-table th.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.sort === field) {
                th.classList.add(`sorted-${this.sort.direction}`);
            }
        });

        this.renderListView();
    },

    async loadJobs() {
        const indicator = document.getElementById('apex-refresh-indicator');
        if (indicator) indicator.classList.add('spinning');

        try {
            const data = await api.getApexJobs();

            this.jobs = data.projects || [];
            this.stats = data.stats || {};
            this.syncedAt = data.syncedAt;

            this.updateSyncInfo();
            this.populateFilters();
            this.renderCurrentView();
        } catch (err) {
            console.error('Failed to load Apex jobs:', err);
        } finally {
            if (indicator) indicator.classList.remove('spinning');
        }
    },

    updateSyncInfo() {
        const syncEl = document.getElementById('apex-sync-time');
        if (syncEl && this.syncedAt) {
            const date = new Date(this.syncedAt);
            syncEl.textContent = `Synced: ${date.toLocaleTimeString()}`;
            syncEl.title = date.toLocaleString();
        }
    },

    populateFilters() {
        // Populate loss type filter
        const lossTypes = [...new Set(this.jobs.map(j => j.lossType).filter(Boolean))];
        const lossFilter = document.getElementById('apex-filter-loss');
        if (lossFilter && lossFilter.options.length <= 1) {
            lossTypes.forEach(type => {
                const opt = document.createElement('option');
                opt.value = type;
                opt.textContent = type;
                lossFilter.appendChild(opt);
            });
        }

        // Populate owner filter
        const owners = [...new Set(this.jobs.map(j => j.owner?.name).filter(Boolean))];
        const ownerFilter = document.getElementById('apex-filter-owner');
        if (ownerFilter && ownerFilter.options.length <= 1) {
            owners.forEach(owner => {
                const opt = document.createElement('option');
                opt.value = owner;
                opt.textContent = owner;
                ownerFilter.appendChild(opt);
            });
        }
    },

    getFilteredJobs() {
        return this.jobs.filter(job => {
            if (this.filters.status !== 'all' && job.status !== this.filters.status) {
                return false;
            }
            if (this.filters.lossType !== 'all' && job.lossType !== this.filters.lossType) {
                return false;
            }
            if (this.filters.owner !== 'all' && job.owner?.name !== this.filters.owner) {
                return false;
            }
            return true;
        });
    },

    renderCurrentView() {
        this.renderKanban();
        this.renderList();
        this.renderCards();
    },

    // Alias methods for backwards compatibility
    renderKanbanView() { this.renderKanban(); },
    renderListView() { this.renderList(); },
    renderCardView() { this.renderCards(); },

    // ==================
    // KANBAN VIEW
    // ==================
    renderKanban() {
        const statuses = ['active', 'pending_insurance', 'complete'];
        const statusLabels = {
            'active': 'Active',
            'pending_insurance': 'Pending',
            'complete': 'Complete'
        };
        
        const jobs = this.getFilteredJobs();
        
        // Group jobs by status
        const grouped = {};
        statuses.forEach(s => grouped[s] = []);
        
        jobs.forEach(job => {
            const status = job.status || 'active';
            if (grouped[status]) {
                grouped[status].push(job);
            } else {
                grouped.active.push(job);
            }
        });

        statuses.forEach(status => {
            const column = document.querySelector(`.apex-column-tasks[data-status="${status}"]`);
            const count = document.querySelector(`.apex-task-count[data-count="${status}"]`);
            
            if (column) {
                column.innerHTML = grouped[status].map(job => this.renderJobCard(job)).join('');
                
                // Bind click events
                column.querySelectorAll('.apex-job-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const job = this.jobs.find(j => String(j.id) === card.dataset.id);
                        if (job) this.openJobModal(job);
                    });
                });
            }
            
            if (count) {
                count.textContent = grouped[status].length;
            }
        });
    },

    renderJobCard(job) {
        const taskTotal = job.taskSummary?.total || job.tasks?.length || 0;
        const taskComplete = job.taskSummary?.completed || job.tasks?.filter(t => t.completed).length || 0;
        const progress = taskTotal > 0 ? Math.round((taskComplete / taskTotal) * 100) : 0;

        const lossTypeClass = (job.lossType || 'unknown').toLowerCase().replace(/\s+/g, '-');

        // Phase badges
        const phaseBadges = (job.phases || []).map(p =>
            `<span class="apex-phase-badge phase-${p.job_type_code.toLowerCase()}">${this.escapeHtml(p.job_type_code)}</span>`
        ).join('');

        return `
            <div class="apex-job-card" data-id="${job.id}">
                <div class="apex-job-header">
                    <span class="apex-job-title">${this.escapeHtml(job.name || 'Unnamed Job')}</span>
                </div>
                ${phaseBadges ? `<div class="apex-phase-badges">${phaseBadges}</div>` : ''}
                <div class="apex-job-client">${this.escapeHtml(job.client?.name || job.clientName || '')}</div>
                <div class="apex-job-meta">
                    <span class="apex-loss-badge loss-${lossTypeClass}">${this.escapeHtml(job.lossType || 'Unknown')}</span>
                    <span class="apex-task-progress" title="${taskComplete} of ${taskTotal} tasks complete">
                        <span class="progress-bar">
                            <span class="progress-fill" style="width: ${progress}%"></span>
                        </span>
                        <span class="progress-text">${taskComplete}/${taskTotal}</span>
                    </span>
                </div>
                <div class="apex-job-footer">
                    <span class="apex-owner">${this.escapeHtml(job.owner?.name || '')}</span>
                    <span class="apex-status-dot status-${job.status || 'active'}"></span>
                </div>
            </div>
        `;
    },

    // ==================
    // LIST VIEW (Sortable Table)
    // ==================
    renderList() {
        const jobs = this.getFilteredJobs();
        const tbody = document.getElementById('apex-list-body');
        const empty = document.getElementById('apex-list-empty');

        if (!tbody) return;

        // Apply sorting
        const sorted = [...jobs].sort((a, b) => {
            let valA, valB;
            
            switch(this.sort.field) {
                case 'name':
                    valA = (a.name || '').toLowerCase();
                    valB = (b.name || '').toLowerCase();
                    break;
                case 'client':
                    valA = (a.client?.name || a.clientName || '').toLowerCase();
                    valB = (b.client?.name || b.clientName || '').toLowerCase();
                    break;
                case 'lossType':
                    valA = (a.lossType || '').toLowerCase();
                    valB = (b.lossType || '').toLowerCase();
                    break;
                case 'owner':
                    valA = (a.owner?.name || '').toLowerCase();
                    valB = (b.owner?.name || '').toLowerCase();
                    break;
                case 'status':
                    valA = a.status || '';
                    valB = b.status || '';
                    break;
                case 'progress':
                    const totalA = a.taskSummary?.total || a.tasks?.length || 0;
                    const completeA = a.taskSummary?.completed || 0;
                    valA = totalA > 0 ? completeA / totalA : 0;
                    const totalB = b.taskSummary?.total || b.tasks?.length || 0;
                    const completeB = b.taskSummary?.completed || 0;
                    valB = totalB > 0 ? completeB / totalB : 0;
                    break;
                default:
                    valA = (a.name || '').toLowerCase();
                    valB = (b.name || '').toLowerCase();
            }
            
            if (valA < valB) return this.sort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return this.sort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        if (sorted.length === 0) {
            tbody.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }

        if (empty) empty.style.display = 'none';
        
        tbody.innerHTML = sorted.map(job => {
            const taskTotal = job.taskSummary?.total || job.tasks?.length || 0;
            const taskComplete = job.taskSummary?.completed || 0;
            const lossTypeClass = (job.lossType || 'unknown').toLowerCase().replace(/\s+/g, '-');

            const phaseBadges = (job.phases || []).map(p =>
                `<span class="apex-phase-badge phase-${p.job_type_code.toLowerCase()}">${this.escapeHtml(p.job_type_code)}</span>`
            ).join('');

            return `
                <tr data-id="${job.id}">
                    <td class="title-cell">
                        ${this.escapeHtml(job.name || 'Unnamed')}
                        ${phaseBadges ? `<div class="apex-phase-badges">${phaseBadges}</div>` : ''}
                    </td>
                    <td>${this.escapeHtml(job.client?.name || job.clientName || '')}</td>
                    <td><span class="apex-loss-badge loss-${lossTypeClass}">${this.escapeHtml(job.lossType || '-')}</span></td>
                    <td>${taskComplete}/${taskTotal}</td>
                    <td>${this.escapeHtml(job.owner?.name || '-')}</td>
                    <td><span class="apex-status-badge status-${job.status}">${this.formatStatus(job.status)}</span></td>
                </tr>
            `;
        }).join('');

        // Bind click events
        tbody.querySelectorAll('tr').forEach(row => {
            row.addEventListener('click', () => {
                const job = this.jobs.find(j => String(j.id) === row.dataset.id);
                if (job) this.openJobModal(job);
            });
        });
    },

    // ==================
    // CARD VIEW (Grid Layout)
    // ==================
    renderCards() {
        const jobs = this.getFilteredJobs();
        const grid = document.getElementById('apex-card-grid');
        const empty = document.getElementById('apex-card-empty');

        if (!grid) return;

        if (jobs.length === 0) {
            grid.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }

        if (empty) empty.style.display = 'none';
        
        grid.innerHTML = jobs.map(job => this.renderProjectCard(job)).join('');

        // Bind click events
        grid.querySelectorAll('.apex-project-card').forEach(card => {
            card.addEventListener('click', () => {
                const job = this.jobs.find(j => String(j.id) === card.dataset.id);
                if (job) this.openJobModal(job);
            });
        });
    },

    renderProjectCard(job) {
        const taskTotal = job.taskSummary?.total || job.tasks?.length || 0;
        const taskComplete = job.taskSummary?.completed || 0;
        const progress = taskTotal > 0 ? Math.round((taskComplete / taskTotal) * 100) : 0;
        const lossTypeClass = (job.lossType || 'unknown').toLowerCase().replace(/\s+/g, '-');

        // Format address
        const address = job.client?.address?.replace(/\r?\n/g, ', ').replace(/,\s*,/g, ',') || '';

        // Phase badges
        const phaseBadges = (job.phases || []).map(p =>
            `<span class="apex-phase-badge phase-${p.job_type_code.toLowerCase()}">${this.escapeHtml(p.job_type_code)}</span>`
        ).join('');

        return `
            <div class="apex-project-card loss-border-${lossTypeClass}" data-id="${job.id}">
                <div class="apex-project-header">
                    <span class="apex-project-title">${this.escapeHtml(job.name || 'Unnamed Job')}</span>
                    <span class="apex-loss-badge loss-${lossTypeClass}">${this.escapeHtml(job.lossType || 'Unknown')}</span>
                </div>
                ${phaseBadges ? `<div class="apex-phase-badges">${phaseBadges}</div>` : ''}
                <div class="apex-project-client">
                    <strong>${this.escapeHtml(job.client?.name || job.clientName || '')}</strong>
                    ${address ? `<div class="apex-address">${this.escapeHtml(address)}</div>` : ''}
                </div>
                <div class="apex-project-progress">
                    <div class="progress-bar large">
                        <span class="progress-fill" style="width: ${progress}%"></span>
                    </div>
                    <span class="progress-label">${taskComplete} of ${taskTotal} tasks (${progress}%)</span>
                </div>
                <div class="apex-project-footer">
                    <span class="apex-owner">${this.escapeHtml(job.owner?.name || '')}</span>
                    <span class="apex-status-badge status-${job.status}">${this.formatStatus(job.status)}</span>
                </div>
            </div>
        `;
    },

    // ==================
    // JOB DETAIL MODAL
    // ==================
    openJobModal(job) {
        const modal = document.getElementById('apex-job-modal');
        if (!modal) return;

        document.getElementById('apex-modal-title').textContent = job.name || 'Job Details';
        document.getElementById('apex-modal-status').textContent = this.formatStatus(job.status);
        document.getElementById('apex-modal-status').className = `apex-status-badge status-${job.status}`;

        const body = modal.querySelector('.modal-body');

        if (job.phases && job.phases.length > 0) {
            body.innerHTML = this.renderTabbedDetailView(job);
            this.bindTabEvents(body);
        } else {
            body.innerHTML = this.renderLegacyDetailView(job);
        }

        modal.classList.add('open');
    },

    renderTabbedDetailView(job) {
        const clientAddress = job.client?.address || [job.client_street, job.client_city, job.client_state, job.client_zip].filter(Boolean).join(', ') || '-';

        // Shared info
        const sharedInfo = `
            <div class="apex-modal-section">
                <h3 class="apex-section-title">Client Information</h3>
                <div class="apex-detail-grid">
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Name</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.client?.name || job.clientName || '-')}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Phone</span>
                        <span class="apex-detail-value">${this.formatPhone(job.client?.phone) || '-'}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Email</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.client?.email || '-')}</span>
                    </div>
                    <div class="apex-detail-item full-width">
                        <span class="apex-detail-label">Address</span>
                        <span class="apex-detail-value">${this.escapeHtml(clientAddress)}</span>
                    </div>
                </div>
            </div>
            <div class="apex-modal-section">
                <h3 class="apex-section-title">Insurance</h3>
                <div class="apex-detail-grid">
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Carrier</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.insurance?.carrier || '-')}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Claim #</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.insurance?.claimNumber || '-')}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Adjuster</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.insurance?.adjusterName || '-')}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Loss Type</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.lossType || '-')}</span>
                    </div>
                </div>
            </div>
        `;

        // Phase tabs
        const tabBar = `
            <div class="apex-phase-tabs">
                ${job.phases.map((phase, i) => `
                    <button class="apex-phase-tab ${i === 0 ? 'active' : ''}" data-phase-idx="${i}">
                        <span class="apex-phase-badge phase-${phase.job_type_code.toLowerCase()}">${this.escapeHtml(phase.job_type_code)}</span>
                        <span class="phase-tab-number">${this.escapeHtml(phase.job_number)}</span>
                    </button>
                `).join('')}
            </div>
        `;

        // Phase panels
        const panels = job.phases.map((phase, i) => `
            <div class="apex-phase-panel ${i === 0 ? 'active' : ''}" data-phase-idx="${i}">
                <div class="apex-phase-header">
                    <span class="apex-phase-job-number">${this.escapeHtml(phase.job_number)}</span>
                    <span class="apex-status-badge phase-status-${phase.phase_status || 'not_started'}">${this.formatPhaseStatus(phase.phase_status)}</span>
                </div>

                <div class="apex-phase-section">
                    <h4 class="apex-phase-section-title">Documents</h4>
                    <div class="apex-empty-state">No documents yet</div>
                </div>

                <div class="apex-phase-section">
                    <h4 class="apex-phase-section-title">Photos</h4>
                    <div class="apex-empty-state">No photos yet</div>
                </div>

                <div class="apex-phase-section">
                    <h4 class="apex-phase-section-title">Estimates</h4>
                    <div class="apex-empty-state">No estimates yet</div>
                </div>

                <div class="apex-phase-section">
                    <h4 class="apex-phase-section-title">Payments</h4>
                    <div class="apex-empty-state">No payments yet</div>
                </div>

                <div class="apex-phase-section">
                    <h4 class="apex-phase-section-title">Labor Log</h4>
                    <div class="apex-empty-state">No labor entries yet</div>
                </div>

                <div class="apex-phase-section">
                    <h4 class="apex-phase-section-title">Materials</h4>
                    <div class="apex-empty-state">No materials yet</div>
                </div>

                ${phase.job_type_code === 'MIT' ? `
                <div class="apex-phase-section">
                    <h4 class="apex-phase-section-title">Drying Logs</h4>
                    <div class="apex-empty-state">No drying log entries yet</div>
                </div>
                ` : ''}

                <div class="apex-phase-section">
                    <h4 class="apex-phase-section-title">Notes</h4>
                    <div class="apex-empty-state">${this.escapeHtml(phase.notes) || 'No notes yet'}</div>
                </div>
            </div>
        `).join('');

        return sharedInfo + tabBar + panels;
    },

    renderLegacyDetailView(job) {
        const clientAddress = (job.client?.address || '').replace(/\r?\n/g, ', ') || '-';
        return `
            <div class="apex-modal-section">
                <h3 class="apex-section-title">Client Information</h3>
                <div class="apex-detail-grid">
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Name</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.client?.name || job.clientName || '-')}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Phone</span>
                        <span class="apex-detail-value">${this.formatPhone(job.client?.phone) || '-'}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Email</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.client?.email || '-')}</span>
                    </div>
                    <div class="apex-detail-item full-width">
                        <span class="apex-detail-label">Address</span>
                        <span class="apex-detail-value">${this.escapeHtml(clientAddress)}</span>
                    </div>
                </div>
            </div>
            <div class="apex-modal-section">
                <h3 class="apex-section-title">Insurance Information</h3>
                <div class="apex-detail-grid">
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Carrier</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.insurance?.carrier || '-')}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Claim #</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.insurance?.claimNumber || '-')}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Adjuster</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.insurance?.adjusterName || '-')}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Adjuster Email</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.insurance?.adjusterEmail || '-')}</span>
                    </div>
                </div>
            </div>
            <div class="apex-modal-section">
                <h3 class="apex-section-title">Job Details</h3>
                <div class="apex-detail-grid">
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Loss Type</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.lossType || '-')}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Mitigation Job #</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.jobNumbers?.mitigation || '-')}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Repair Job #</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.jobNumbers?.repair || '-')}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Owner</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.owner?.name || '-')}</span>
                    </div>
                    <div class="apex-detail-item">
                        <span class="apex-detail-label">Created</span>
                        <span class="apex-detail-value">${this.escapeHtml(job.createdAt || '-')}</span>
                    </div>
                </div>
            </div>
            <div class="apex-modal-section">
                <h3 class="apex-section-title">Tasks</h3>
                <div class="apex-tasks-container">
                    ${this.renderTaskListHtml(job.tasks || [])}
                </div>
            </div>
        `;
    },

    renderTaskListHtml(tasks) {
        if (tasks.length === 0) {
            return '<p class="no-tasks">No tasks found</p>';
        }
        return tasks.map(task => `
            <div class="apex-task-item ${task.completed ? 'completed' : ''}">
                <span class="apex-task-check">${task.completed ? '✓' : '○'}</span>
                <span class="apex-task-name">${this.escapeHtml(task.name)}</span>
                ${task.assignees?.length ? `<span class="apex-task-assignees">${task.assignees.join(', ')}</span>` : ''}
            </div>
        `).join('');
    },

    bindTabEvents(container) {
        container.querySelectorAll('.apex-phase-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const idx = tab.dataset.phaseIdx;
                // Update active tab
                container.querySelectorAll('.apex-phase-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // Update active panel
                container.querySelectorAll('.apex-phase-panel').forEach(p => p.classList.remove('active'));
                const panel = container.querySelector(`.apex-phase-panel[data-phase-idx="${idx}"]`);
                if (panel) panel.classList.add('active');
            });
        });
    },

    formatPhaseStatus(status) {
        const labels = {
            'not_started': 'Not Started',
            'in_progress': 'In Progress',
            'pending_approval': 'Pending Approval',
            'approved': 'Approved',
            'complete': 'Complete'
        };
        return labels[status] || status || 'Not Started';
    },

    closeJobModal() {
        const modal = document.getElementById('apex-job-modal');
        if (modal) modal.classList.remove('open');
    },

    // ==================
    // UTILS
    // ==================
    formatStatus(status) {
        const labels = {
            'active': 'Active',
            'pending_insurance': 'Pending Insurance',
            'complete': 'Complete'
        };
        return labels[status] || status || 'Unknown';
    },

    formatPhone(phone) {
        if (!phone) return null;
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
        }
        return phone;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    apexJobs.init();
    
    // Close modal on backdrop click
    const modal = document.getElementById('apex-job-modal');
    if (modal) {
        modal.querySelector('.modal-backdrop')?.addEventListener('click', () => apexJobs.closeJobModal());
        modal.querySelector('.modal-close')?.addEventListener('click', () => apexJobs.closeJobModal());
    }
});

window.apexJobs = apexJobs;

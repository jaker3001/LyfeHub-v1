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
            const response = await fetch('/api/apex-jobs');
            const data = await response.json();
            
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
        
        return `
            <div class="apex-job-card" data-id="${job.id}">
                <div class="apex-job-header">
                    <span class="apex-job-title">${this.escapeHtml(job.name || 'Unnamed Job')}</span>
                </div>
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
            
            return `
                <tr data-id="${job.id}">
                    <td class="title-cell">${this.escapeHtml(job.name || 'Unnamed')}</td>
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

        return `
            <div class="apex-project-card loss-border-${lossTypeClass}" data-id="${job.id}">
                <div class="apex-project-header">
                    <span class="apex-project-title">${this.escapeHtml(job.name || 'Unnamed Job')}</span>
                    <span class="apex-loss-badge loss-${lossTypeClass}">${this.escapeHtml(job.lossType || 'Unknown')}</span>
                </div>
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

        // Populate modal content
        document.getElementById('apex-modal-title').textContent = job.name || 'Job Details';
        document.getElementById('apex-modal-status').textContent = this.formatStatus(job.status);
        document.getElementById('apex-modal-status').className = `apex-status-badge status-${job.status}`;

        // Client info
        document.getElementById('apex-client-name').textContent = job.client?.name || job.clientName || '-';
        document.getElementById('apex-client-phone').textContent = this.formatPhone(job.client?.phone) || '-';
        document.getElementById('apex-client-email').textContent = job.client?.email || '-';
        document.getElementById('apex-client-address').textContent = (job.client?.address || '').replace(/\r?\n/g, ', ') || '-';

        // Insurance info
        document.getElementById('apex-insurance-carrier').textContent = job.insurance?.carrier || '-';
        document.getElementById('apex-insurance-claim').textContent = job.insurance?.claimNumber || '-';
        document.getElementById('apex-insurance-adjuster').textContent = job.insurance?.adjusterName || '-';
        document.getElementById('apex-insurance-adjuster-email').textContent = job.insurance?.adjusterEmail || '-';

        // Job details
        document.getElementById('apex-detail-loss').textContent = job.lossType || '-';
        document.getElementById('apex-detail-mit').textContent = job.jobNumbers?.mitigation || '-';
        document.getElementById('apex-detail-repair').textContent = job.jobNumbers?.repair || '-';
        document.getElementById('apex-detail-owner').textContent = job.owner?.name || '-';
        document.getElementById('apex-detail-created').textContent = job.createdAt || '-';

        // Tasks
        this.renderTaskList(job.tasks || []);

        modal.classList.add('open');
    },

    renderTaskList(tasks) {
        // Update task count in section header
        const taskSection = document.querySelector('#apex-job-modal .apex-modal-section:last-child .apex-section-title');
        if (taskSection) {
            const completed = tasks.filter(t => t.completed).length;
            taskSection.innerHTML = `Tasks <span class="task-count">${completed}/${tasks.length}</span>`;
        }

        const container = document.getElementById('apex-tasks-list');
        if (!container) return;

        if (tasks.length === 0) {
            container.innerHTML = '<p class="no-tasks">No tasks found</p>';
            return;
        }

        container.innerHTML = tasks.map(task => `
            <div class="apex-task-item ${task.completed ? 'completed' : ''}">
                <span class="apex-task-check">${task.completed ? '✓' : '○'}</span>
                <span class="apex-task-name">${this.escapeHtml(task.name)}</span>
                ${task.assignees?.length ? `<span class="apex-task-assignees">${task.assignees.join(', ')}</span>` : ''}
            </div>
        `).join('');
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

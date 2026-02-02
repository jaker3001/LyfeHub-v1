/**
 * API Client for Kanban Board
 * Handles all HTTP requests with authentication
 */

const api = {
    baseUrl: '/api',

    /**
     * Make an authenticated API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            credentials: 'include', // Include cookies for JWT
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        const response = await fetch(url, config);

        // Handle auth errors
        if (response.status === 401) {
            // Redirect to login if not authenticated (except on auth pages)
            const authPages = ['/login.html', '/login', '/profile.html', '/profile'];
            if (!authPages.some(p => window.location.pathname.endsWith(p))) {
                window.location.href = '/login.html';
            }
            throw new Error('Unauthorized');
        }

        // Parse response
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            throw new Error(data.error || data.message || `HTTP ${response.status}`);
        }

        return data;
    },

    // ========================================
    // AUTH
    // ========================================

    /**
     * Auth: Sign up with email and password
     */
    async signup(name, email, password) {
        return this.request('/auth/signup', {
            method: 'POST',
            body: { name, email, password },
        });
    },

    /**
     * Auth: Login with email and password
     * @param {boolean} rememberMe - If true, session persists for 30 days; otherwise session-only
     */
    async login(email, password, rememberMe = true) {
        return this.request('/auth/login', {
            method: 'POST',
            body: { email, password, rememberMe },
        });
    },

    /**
     * Auth: Logout
     */
    async logout() {
        return this.request('/auth/logout', {
            method: 'POST',
        });
    },

    /**
     * Auth: Check if currently authenticated
     */
    async checkAuth() {
        return this.request('/auth/check');
    },

    // ========================================
    // USER PROFILE
    // ========================================

    /**
     * Profile: Get current user profile
     */
    async getProfile() {
        return this.request('/users/me');
    },

    /**
     * Profile: Update current user profile
     */
    async updateProfile(data) {
        return this.request('/users/me', {
            method: 'PATCH',
            body: data,
        });
    },

    /**
     * Profile: Change password
     */
    async changePassword(currentPassword, newPassword) {
        return this.request('/users/me/password', {
            method: 'PUT',
            body: { currentPassword, newPassword },
        });
    },

    // ========================================
    // TASKS
    // ========================================

    /**
     * Tasks: Get all tasks
     */
    async getTasks(status = null) {
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        return this.request(`/tasks${query}`);
    },

    /**
     * Tasks: Get single task by ID
     */
    async getTask(id) {
        return this.request(`/tasks/${id}`);
    },

    /**
     * Tasks: Create new task
     */
    async createTask(task) {
        return this.request('/tasks', {
            method: 'POST',
            body: task,
        });
    },

    /**
     * Tasks: Update existing task
     */
    async updateTask(id, updates) {
        return this.request(`/tasks/${id}`, {
            method: 'PATCH',
            body: updates,
        });
    },

    /**
     * Tasks: Delete task
     */
    async deleteTask(id) {
        return this.request(`/tasks/${id}`, {
            method: 'DELETE',
        });
    },

    /**
     * Tasks: Pick/claim a task (for AI agents)
     */
    async pickTask(id) {
        return this.request(`/tasks/${id}/pick`, {
            method: 'POST',
        });
    },

    /**
     * Tasks: Mark task as complete (moves to review)
     */
    async completeTask(id) {
        return this.request(`/tasks/${id}/complete`, {
            method: 'POST',
        });
    },

    /**
     * Tasks: Submit review for a task
     */
    async submitReview(id, reviewData) {
        return this.request(`/tasks/${id}/review`, {
            method: 'POST',
            body: reviewData,
        });
    },

    /**
     * Tasks: Submit plan review for a task
     */
    async submitPlanReview(id, reviewData) {
        return this.request(`/tasks/${id}/plan-review`, {
            method: 'POST',
            body: reviewData,
        });
    },
};

// Make available globally
window.api = api;

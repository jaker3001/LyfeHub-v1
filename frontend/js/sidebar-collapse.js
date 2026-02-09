/**
 * SidebarCollapse - Responsive sidebar management for LyfeHub
 * ============================================================
 * Handles both .bases-sidebar and .people-sidebar with unified logic.
 * 
 * Dependencies: MobileUtils (mobile-utils.js)
 * 
 * Behaviors:
 *   Mobile (≤768px)  - Hidden by default, toggle button to show/hide with backdrop
 *   Tablet (769-1024px) - Collapsed to icon rail, expand on hover or click
 *   Desktop (>1024px) - Full width, always visible
 */
(function(global) {
    'use strict';

    // Configuration for each sidebar
    const SIDEBAR_CONFIG = {
        bases: {
            sidebarId: 'bases-sidebar',
            layoutClass: 'bases-layout',
            toggleBtnId: 'bases-sidebar-toggle',
            backdropId: 'bases-sidebar-backdrop'
        },
        people: {
            sidebarId: 'people-sidebar',
            layoutClass: 'people-layout',
            toggleBtnId: 'people-sidebar-toggle',
            backdropId: 'people-sidebar-backdrop'
        },
        calendar: {
            sidebarId: 'calendar-sidebar',
            layoutClass: 'calendar-layout',
            toggleBtnId: 'calendar-sidebar-toggle',
            backdropId: 'calendar-sidebar-backdrop'
        }
    };

    // LocalStorage key for persisting collapsed state
    const STORAGE_KEY = 'lyfehub-sidebar-collapsed';

    // State tracking
    const state = {
        bases: { isOpen: false, isExpanded: false },
        people: { isOpen: false, isExpanded: false },
        calendar: { isOpen: false, isExpanded: false }
    };

    /**
     * Load collapsed state from localStorage
     */
    function loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.bases !== undefined) state.bases.isExpanded = !parsed.bases;
                if (parsed.people !== undefined) state.people.isExpanded = !parsed.people;
                if (parsed.calendar !== undefined) state.calendar.isExpanded = !parsed.calendar;
                console.log('[SidebarCollapse] Loaded state from localStorage:', parsed);
            }
        } catch (e) {
            console.warn('[SidebarCollapse] Failed to load state:', e);
        }
    }

    /**
     * Save collapsed state to localStorage
     */
    function saveState() {
        try {
            const toSave = {
                bases: !state.bases.isExpanded,
                people: !state.people.isExpanded,
                calendar: !state.calendar.isExpanded
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) {
            console.warn('[SidebarCollapse] Failed to save state:', e);
        }
    }

    /**
     * Create and inject toggle button for mobile
     */
    function createToggleButton(config) {
        const existing = document.getElementById(config.toggleBtnId);
        if (existing) return existing;

        const btn = document.createElement('button');
        btn.id = config.toggleBtnId;
        btn.className = 'sidebar-toggle-btn';
        btn.setAttribute('aria-label', 'Toggle sidebar');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
        `;

        // Insert into the layout container
        const layout = document.querySelector('.' + config.layoutClass);
        if (layout) {
            layout.insertBefore(btn, layout.firstChild);
        }

        return btn;
    }

    /**
     * Create and inject backdrop for mobile overlay
     */
    function createBackdrop(config) {
        const existing = document.getElementById(config.backdropId);
        if (existing) return existing;

        const backdrop = document.createElement('div');
        backdrop.id = config.backdropId;
        backdrop.className = 'sidebar-backdrop';

        // Insert into the layout container
        const layout = document.querySelector('.' + config.layoutClass);
        if (layout) {
            layout.appendChild(backdrop);
        }

        return backdrop;
    }

    /**
     * Open sidebar (mobile)
     */
    function openSidebar(type) {
        const config = SIDEBAR_CONFIG[type];
        const layout = document.querySelector('.' + config.layoutClass);
        const backdrop = document.getElementById(config.backdropId);

        if (layout) {
            layout.classList.add('sidebar-open');
            state[type].isOpen = true;
        }

        if (backdrop) {
            backdrop.classList.add('visible');
        }

        // Prevent body scroll when sidebar is open
        document.body.style.overflow = 'hidden';

        console.log(`[SidebarCollapse] ${type} sidebar opened`);
    }

    /**
     * Close sidebar (mobile)
     */
    function closeSidebar(type) {
        const config = SIDEBAR_CONFIG[type];
        const layout = document.querySelector('.' + config.layoutClass);
        const backdrop = document.getElementById(config.backdropId);

        if (layout) {
            layout.classList.remove('sidebar-open');
            state[type].isOpen = false;
        }

        if (backdrop) {
            backdrop.classList.remove('visible');
        }

        // Restore body scroll
        document.body.style.overflow = '';

        console.log(`[SidebarCollapse] ${type} sidebar closed`);
    }

    /**
     * Toggle sidebar (mobile)
     */
    function toggleSidebar(type) {
        if (state[type].isOpen) {
            closeSidebar(type);
        } else {
            openSidebar(type);
        }
    }

    /**
     * Expand sidebar (tablet - icon rail to full)
     */
    function expandSidebar(type) {
        const config = SIDEBAR_CONFIG[type];
        const sidebar = document.getElementById(config.sidebarId);

        if (sidebar) {
            sidebar.classList.add('sidebar-expanded');
            state[type].isExpanded = true;
            saveState();
        }
    }

    /**
     * Collapse sidebar (tablet - full to icon rail)
     */
    function collapseSidebar(type) {
        const config = SIDEBAR_CONFIG[type];
        const sidebar = document.getElementById(config.sidebarId);

        if (sidebar) {
            sidebar.classList.remove('sidebar-expanded');
            state[type].isExpanded = false;
            saveState();
        }
    }

    /**
     * Set up event listeners for a sidebar
     */
    function setupSidebarEvents(type) {
        const config = SIDEBAR_CONFIG[type];

        // Create toggle button and backdrop
        const toggleBtn = createToggleButton(config);
        const backdrop = createBackdrop(config);

        // Toggle button click
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleSidebar(type);
            });
        }

        // Backdrop click to close
        if (backdrop) {
            backdrop.addEventListener('click', function() {
                closeSidebar(type);
            });
        }

        // Close on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && state[type].isOpen) {
                closeSidebar(type);
            }
        });

        // Handle clicks outside sidebar on mobile
        const sidebar = document.getElementById(config.sidebarId);
        if (sidebar) {
            // Prevent clicks inside sidebar from closing it
            sidebar.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }
    }

    /**
     * Check if device is in landscape orientation
     */
    function isLandscape() {
        return window.matchMedia('(orientation: landscape)').matches;
    }

    /**
     * Handle orientation changes for tablet mode
     */
    function handleOrientationChange() {
        if (!global.MobileUtils || !global.MobileUtils.isTablet()) return;

        const landscape = isLandscape();
        console.log('[SidebarCollapse] Orientation changed, landscape:', landscape);

        Object.keys(SIDEBAR_CONFIG).forEach(function(type) {
            const sidebar = document.getElementById(SIDEBAR_CONFIG[type].sidebarId);
            if (!sidebar) return;

            if (landscape) {
                // Landscape tablet: auto-expand
                sidebar.classList.add('sidebar-expanded');
                state[type].isExpanded = true;
            } else {
                // Portrait tablet: collapse to icon rail
                sidebar.classList.remove('sidebar-expanded');
                state[type].isExpanded = false;
            }
        });
    }

    /**
     * Handle breakpoint changes
     */
    function handleBreakpointChange(newBreakpoint, oldBreakpoint) {
        console.log(`[SidebarCollapse] Breakpoint changed: ${oldBreakpoint} → ${newBreakpoint}`);

        Object.keys(SIDEBAR_CONFIG).forEach(function(type) {
            const config = SIDEBAR_CONFIG[type];
            const layout = document.querySelector('.' + config.layoutClass);
            const sidebar = document.getElementById(config.sidebarId);
            const toggleBtn = document.getElementById(config.toggleBtnId);

            if (newBreakpoint === 'desktop') {
                // Desktop: ensure sidebar is visible and not in mobile state
                if (layout) layout.classList.remove('sidebar-open');
                if (sidebar) sidebar.classList.remove('sidebar-expanded');
                if (toggleBtn) toggleBtn.style.display = 'none';
                state[type].isOpen = false;
                state[type].isExpanded = false;
                document.body.style.overflow = '';
            } else if (newBreakpoint === 'tablet') {
                // Tablet: handle based on orientation
                if (layout) layout.classList.remove('sidebar-open');
                if (toggleBtn) toggleBtn.style.display = 'none';
                state[type].isOpen = false;
                document.body.style.overflow = '';
                
                // Apply orientation-based expansion
                if (isLandscape()) {
                    if (sidebar) sidebar.classList.add('sidebar-expanded');
                    state[type].isExpanded = true;
                } else {
                    if (sidebar) sidebar.classList.remove('sidebar-expanded');
                    state[type].isExpanded = false;
                }
            } else if (newBreakpoint === 'mobile') {
                // Mobile: hidden by default, show toggle
                if (layout) layout.classList.remove('sidebar-open');
                if (sidebar) sidebar.classList.remove('sidebar-expanded');
                if (toggleBtn) toggleBtn.style.display = 'flex';
                state[type].isOpen = false;
                state[type].isExpanded = false;
            }
        });
    }

    /**
     * Initialize the sidebar collapse system
     */
    function init() {
        // Check for MobileUtils dependency
        if (!global.MobileUtils) {
            console.error('[SidebarCollapse] MobileUtils is required but not found');
            return;
        }

        // Load saved state from localStorage
        loadState();

        // Set up each sidebar
        Object.keys(SIDEBAR_CONFIG).forEach(function(type) {
            const config = SIDEBAR_CONFIG[type];
            const sidebar = document.getElementById(config.sidebarId);
            
            if (sidebar) {
                setupSidebarEvents(type);
                
                // Apply saved expanded state for tablet mode
                if (state[type].isExpanded) {
                    sidebar.classList.add('sidebar-expanded');
                }
                
                console.log(`[SidebarCollapse] Initialized ${type} sidebar`);
            }
        });

        // Register for breakpoint changes
        MobileUtils.onBreakpointChange(handleBreakpointChange);

        // Register for orientation changes (for tablet landscape/portrait behavior)
        window.matchMedia('(orientation: portrait)').addEventListener('change', handleOrientationChange);

        // Apply initial state based on current breakpoint
        const currentBreakpoint = MobileUtils.getBreakpoint();
        handleBreakpointChange(currentBreakpoint, null);

        console.log('[SidebarCollapse] Initialized | Breakpoint:', currentBreakpoint, '| Landscape:', isLandscape());
    }

    // Public API
    global.SidebarCollapse = {
        open: openSidebar,
        close: closeSidebar,
        toggle: toggleSidebar,
        expand: expandSidebar,
        collapse: collapseSidebar,
        getState: function(type) { return state[type]; }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);

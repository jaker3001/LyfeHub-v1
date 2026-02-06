/**
 * New Job Modal - Wide Grid Layout
 * Phase B: Full form fields with Same toggle logic
 * Phase C: Job Type Selection with multi-select and job numbers
 */

const jobModal = {
    el: null,
    form: null,
    sameToggle: null,
    propertyFields: null,
    isSameAsClient: false,
    submitBtn: null,
    clientNameInput: null,
    initialized: false,
    
    // Job type selection state
    selectedJobTypes: new Set(),
    jobNumbers: {},  // { type: value }
    jobTypeButtons: null,
    jobNumbersRow: null,  // Container that shows/hides
    jobNumbersInputs: null,

    // Field mappings for "Same as Client" sync
    fieldMappings: [
        { client: "job-client-street", prop: "job-prop-street" },
        { client: "job-client-city", prop: "job-prop-city" },
        { client: "job-client-state", prop: "job-prop-state" },
        { client: "job-client-zip", prop: "job-prop-zip" }
    ],
    
    // Job type definitions
    jobTypes: {
        mitigation: { name: "Mitigation", code: "MIT" },
        reconstruction: { name: "Reconstruction", code: "RPR" },
        remodel: { name: "Remodel", code: "RMD" },
        abatement: { name: "Abatement", code: "ABT" },
        remediation: { name: "Remediation", code: "REM" }
    },

    init() {
        this.el = document.getElementById("new-job-modal");
        if (!this.el) {
            console.warn("New job modal not found");
            return;
        }
        
        this.form = document.getElementById("new-job-form");
        this.sameToggle = document.getElementById("same-as-client-btn");
        this.propertyFields = document.getElementById("property-fields");
        this.jobNumbersRow = document.getElementById("job-numbers-row");
        this.jobNumbersInputs = document.getElementById("job-numbers-inputs");
        
        // These might not exist at init time, so we get them lazily
        this.cacheFormElements();
        
        this.bindEvents();
        this.initialized = true;
        console.log("Job modal initialized");
    },

    /**
     * Cache form elements (called during init and open)
     */
    cacheFormElements() {
        if (this.form) {
            this.submitBtn = this.form.querySelector("button[type=\"submit\"]");
            this.clientNameInput = document.getElementById("job-client-name");
            this.jobTypeButtons = this.el.querySelectorAll(".job-type-btn");
        }
    },

    bindEvents() {
        // Close modal
        this.el.querySelector(".modal-backdrop").addEventListener("click", () => this.close());
        this.el.querySelector(".job-modal-close").addEventListener("click", () => this.close());
        this.el.querySelector(".job-modal-cancel").addEventListener("click", () => this.close());
        
        // Same toggle button
        if (this.sameToggle) {
            this.sameToggle.addEventListener("click", () => this.toggleSameAsClient());
        }
        
        // Job type buttons - multi-select
        this.el.querySelectorAll(".job-type-btn").forEach(btn => {
            btn.addEventListener("click", (e) => this.toggleJobType(e.currentTarget));
        });
        
        // Form submission
        this.form.addEventListener("submit", (e) => this.handleSubmit(e));
        
        // Escape key
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.el.classList.contains("open")) {
                this.close();
            }
        });
        
        // Delegate input events for validation (handles dynamically found elements)
        this.form.addEventListener("input", (e) => {
            if (e.target.id === "job-client-name") {
                this.validateForm();
            }
            // Handle job number inputs
            if (e.target.classList.contains("job-number-input")) {
                const type = e.target.dataset.type;
                this.jobNumbers[type] = e.target.value.trim();
                
                // Toggle filled class
                if (e.target.value.trim()) {
                    e.target.classList.add("filled");
                } else {
                    e.target.classList.remove("filled");
                }
                
                this.validateForm();
            }
            // Sync client fields to property when Same is active
            if (this.isSameAsClient) {
                const mapping = this.fieldMappings.find(m => m.client === e.target.id);
                if (mapping) {
                    this.syncFieldToProperty(mapping.client, mapping.prop);
                }
            }
        });
        
        // Also handle select changes
        this.form.addEventListener("change", (e) => {
            if (this.isSameAsClient) {
                const mapping = this.fieldMappings.find(m => m.client === e.target.id);
                if (mapping) {
                    this.syncFieldToProperty(mapping.client, mapping.prop);
                }
            }
        });
    },

    /**
     * Toggle job type selection (multi-select)
     */
    toggleJobType(btn) {
        const type = btn.dataset.type;
        
        if (this.selectedJobTypes.has(type)) {
            // Deselect
            this.selectedJobTypes.delete(type);
            btn.classList.remove("active");
            delete this.jobNumbers[type];
        } else {
            // Select
            this.selectedJobTypes.add(type);
            btn.classList.add("active");
            this.jobNumbers[type] = "";
        }
        
        this.updateJobNumberInputs();
        this.validateForm();
        
        console.log("Selected job types:", Array.from(this.selectedJobTypes));
    },
    
    /**
     * Get all selected job types with their codes
     */
    getSelectedJobTypes() {
        const types = [];
        this.selectedJobTypes.forEach(type => {
            const btn = document.querySelector(`.job-type-btn[data-type="${type}"]`);
            if (btn) {
                types.push({ type, code: btn.dataset.code });
            }
        });
        return types;
    },
    
    /**
     * Update job number inputs based on selected types
     */
    updateJobNumberInputs() {
        if (!this.jobNumbersRow || !this.jobNumbersInputs) return;
        
        // Show/hide container
        if (this.selectedJobTypes.size === 0) {
            this.jobNumbersRow.style.display = "none";
            this.jobNumbersInputs.innerHTML = "";
            return;
        }
        
        this.jobNumbersRow.style.display = "flex";
        
        // Build inputs for each selected type
        const inputsHtml = Array.from(this.selectedJobTypes).map(type => {
            const jobType = this.jobTypes[type];
            const currentValue = this.jobNumbers[type] || "";
            const filledClass = currentValue ? "filled" : "";
            
            return `
                <div class="job-number-input-row" data-type="${type}">
                    <span class="job-number-type-label">${jobType.name} (${jobType.code})</span>
                    <div class="job-number-input-wrapper">
                        <input type="text" 
                               class="job-number-input ${filledClass}"
                               data-type="${type}"
                               name="job_number_${type}"
                               value="${currentValue}"
                               placeholder="e.g., 202602-001-${jobType.code}">
                        <button type="button" 
                                class="job-number-generate-btn" 
                                data-type="${type}"
                                title="Generate job number">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 4V2"/>
                                <path d="M15 16v-2"/>
                                <path d="M8 9h2"/>
                                <path d="M20 9h2"/>
                                <path d="M17.8 11.8L19 13"/>
                                <path d="M15 9h.01"/>
                                <path d="M17.8 6.2L19 5"/>
                                <path d="m3 21 9-9"/>
                                <path d="M12.2 6.2L11 5"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join("");
        
        this.jobNumbersInputs.innerHTML = inputsHtml;
        
        // Bind generate button events
        this.jobNumbersInputs.querySelectorAll(".job-number-generate-btn").forEach(btn => {
            btn.addEventListener("click", (e) => this.generateJobNumber(e.currentTarget));
        });
    },
    
    /**
     * Generate job number for a type
     */
    async generateJobNumber(btn) {
        const type = btn.dataset.type;
        const jobType = this.jobTypes[type];
        const input = this.jobNumbersInputs.querySelector(`input[data-type="${type}"]`);
        
        if (!input) return;
        
        btn.classList.add("generating");
        
        try {
            // Try API call first
            const response = await fetch(`/api/projects/next-job-number?job_type=${type}`);
            
            if (response.ok) {
                const data = await response.json();
                input.value = data.jobNumber || data.job_number;
            } else {
                // Mock generation if API not available
                const now = new Date();
                const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
                const sequence = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
                input.value = `${yearMonth}-${sequence}-${jobType.code}`;
            }
        } catch (err) {
            // Mock generation on error
            console.log("API not available, using mock generation");
            const now = new Date();
            const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
            const sequence = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
            input.value = `${yearMonth}-${sequence}-${jobType.code}`;
        }
        
        // Update state
        this.jobNumbers[type] = input.value;
        input.classList.add("filled");
        
        btn.classList.remove("generating");
        this.validateForm();
    },

    /**
     * Open the new job modal
     */
    open() {
        // Ensure form elements are cached
        this.cacheFormElements();
        
        // Reset job type selection
        this.selectedJobTypes.clear();
        this.jobNumbers = {};
        this.el.querySelectorAll(".job-type-btn").forEach(btn => btn.classList.remove("active"));
        if (this.jobNumbersRow) {
            this.jobNumbersRow.style.display = "none";
        }
        if (this.jobNumbersInputs) {
            this.jobNumbersInputs.innerHTML = "";
        }
        
        this.isSameAsClient = false;
        if (this.sameToggle) {
            this.sameToggle.classList.remove("active");
        }
        if (this.propertyFields) {
            this.propertyFields.classList.remove("same-active");
        }
        this.enablePropertyFields();
        this.form.reset();
        this.validateForm();
        this.el.classList.add("open");
        
        // Focus on client name
        setTimeout(() => {
            if (this.clientNameInput) {
                this.clientNameInput.focus();
            }
        }, 100);
        
        console.log("Job modal opened");
    },

    /**
     * Close the modal
     */
    close() {
        this.el.classList.remove("open");
        console.log("Job modal closed");
    },

    /**
     * Validate form and enable/disable submit
     */
    validateForm() {
        if (!this.clientNameInput) {
            this.clientNameInput = document.getElementById("job-client-name");
        }
        if (!this.submitBtn && this.form) {
            this.submitBtn = this.form.querySelector("button[type=\"submit\"]");
        }
        
        const hasName = this.clientNameInput && this.clientNameInput.value.trim().length > 0;
        const hasJobTypes = this.selectedJobTypes.size > 0;
        
        // Check all selected job types have job numbers
        let allJobNumbersFilled = true;
        if (hasJobTypes) {
            for (const type of this.selectedJobTypes) {
                if (!this.jobNumbers[type] || this.jobNumbers[type].trim() === "") {
                    allJobNumbersFilled = false;
                    break;
                }
            }
        }
        
        const isValid = hasName && hasJobTypes && allJobNumbersFilled;
        
        if (this.submitBtn) {
            this.submitBtn.disabled = !isValid;
        }
        
        return isValid;
    },

    /**
     * Toggle Same as Client for property section
     */
    toggleSameAsClient() {
        this.isSameAsClient = !this.isSameAsClient;
        this.sameToggle.classList.toggle("active", this.isSameAsClient);
        
        if (this.propertyFields) {
            this.propertyFields.classList.toggle("same-active", this.isSameAsClient);
        }
        
        if (this.isSameAsClient) {
            // Copy all client values to property and disable
            this.syncAllFieldsToProperty();
            this.disablePropertyFields();
        } else {
            // Re-enable property fields (keep values)
            this.enablePropertyFields();
        }
        
        console.log("Same as client:", this.isSameAsClient);
    },

    /**
     * Sync a single field from client to property
     */
    syncFieldToProperty(clientId, propId) {
        const clientField = document.getElementById(clientId);
        const propField = document.getElementById(propId);
        if (clientField && propField) {
            propField.value = clientField.value;
        }
    },

    /**
     * Sync all mapped fields from client to property
     */
    syncAllFieldsToProperty() {
        this.fieldMappings.forEach(mapping => {
            this.syncFieldToProperty(mapping.client, mapping.prop);
        });
    },

    /**
     * Disable property address fields (when Same is active)
     */
    disablePropertyFields() {
        const propFields = document.querySelectorAll(".prop-field");
        propFields.forEach(field => {
            field.disabled = true;
        });
    },

    /**
     * Enable property address fields
     */
    enablePropertyFields() {
        const propFields = document.querySelectorAll(".prop-field");
        propFields.forEach(field => {
            field.disabled = false;
        });
    },

    /**
     * Collect all form data
     */
    collectFormData() {
        const formData = new FormData(this.form);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        // Add same_as_client flag
        data.same_as_client = this.isSameAsClient;
        
        // Add job types and numbers
        data.job_types = Array.from(this.selectedJobTypes);
        data.job_numbers = { ...this.jobNumbers };
        
        return data;
    },

    /**
     * Handle form submission
     */
    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }
        
        const data = this.collectFormData();
        console.log("Form data:", data);
        
        // Build summary of jobs to be created
        const jobSummary = data.job_types.map(type => {
            return `${this.jobTypes[type].name}: ${data.job_numbers[type]}`;
        }).join("\n");
        
        // TODO: API call to create job
        // For now, just log and close
        alert(`Job creation will be implemented in Phase D\n\nClient: ${data.client_name}\n\nJobs to create:\n${jobSummary}`);
        this.close();
    }
};

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    jobModal.init();
});

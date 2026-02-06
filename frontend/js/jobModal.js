/**
 * New Job Modal - Wide Grid Layout
 * Phase B: Full form fields with Same toggle logic
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

    // Field mappings for "Same as Client" sync
    fieldMappings: [
        { client: "job-client-street", prop: "job-prop-street" },
        { client: "job-client-city", prop: "job-prop-city" },
        { client: "job-client-state", prop: "job-prop-state" },
        { client: "job-client-zip", prop: "job-prop-zip" }
    ],

    init() {
        this.el = document.getElementById("new-job-modal");
        if (!this.el) {
            console.warn("New job modal not found");
            return;
        }
        
        this.form = document.getElementById("new-job-form");
        this.sameToggle = document.getElementById("same-as-client-btn");
        this.propertyFields = document.getElementById("property-fields");
        
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
     * Open the new job modal
     */
    open() {
        // Ensure form elements are cached
        this.cacheFormElements();
        
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
        if (this.submitBtn) {
            this.submitBtn.disabled = !hasName;
        }
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
        
        return data;
    },

    /**
     * Handle form submission
     */
    async handleSubmit(e) {
        e.preventDefault();
        
        const data = this.collectFormData();
        console.log("Form data:", data);
        
        // TODO: API call to create job
        // For now, just log and close
        alert("Job creation will be implemented in Phase C\\n\\nClient: " + data.client_name);
        this.close();
    }
};

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    jobModal.init();
});

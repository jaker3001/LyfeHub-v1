// ============================================
// People Feature - Contact management with groups
// ============================================

const peopleApi = {
  // People CRUD
  async list() {
    return api.request('/people');
  },
  async get(id) {
    return api.request(`/people/${id}`);
  },
  async create(data) {
    return api.request('/people', {
      method: 'POST',
      body: data
    });
  },
  async update(id, data) {
    return api.request(`/people/${id}`, {
      method: 'PUT',
      body: data
    });
  },
  async delete(id) {
    return api.request(`/people/${id}`, { method: 'DELETE' });
  },
  // Groups
  async listGroups() {
    return api.request('/people/groups/list');
  },
  async createGroup(data) {
    return api.request('/people/groups', {
      method: 'POST',
      body: data
    });
  },
  async updateGroup(groupId, data) {
    return api.request(`/people/groups/${groupId}`, {
      method: 'PUT',
      body: data
    });
  },
  async deleteGroup(groupId) {
    return api.request(`/people/groups/${groupId}`, { method: 'DELETE' });
  },
  async toggleGroup(groupId) {
    return api.request(`/people/groups/${groupId}/toggle`, { method: 'PUT' });
  },
  async collapseAllGroups() {
    return api.request('/people/groups/collapse-all', { method: 'POST' });
  },
  async expandAllGroups() {
    return api.request('/people/groups/expand-all', { method: 'POST' });
  },
  async reorderGroups(order) {
    return api.request('/people/groups/reorder', {
      method: 'POST',
      body: { order }
    });
  },
  async setPersonGroup(personId, groupId, position = 0) {
    return api.request(`/people/${personId}/group`, {
      method: 'PUT',
      body: { group_id: groupId, position }
    });
  }
};

// ============================================
// State
// ============================================
let peopleState = {
  people: [],
  groups: [],
  currentPerson: null,
  displayMode: 'cards',     // 'cards' or 'list'
  cardSize: 'medium',       // 'small', 'medium', 'large'
  sortColumn: null,
  sortDirection: 'asc',
  filters: [],
  allGroupsCollapsed: false
};

// Load preferences from localStorage
function loadPeoplePreferences() {
  try {
    const saved = localStorage.getItem('peopleViewPrefs');
    if (saved) {
      const prefs = JSON.parse(saved);
      peopleState.displayMode = prefs.displayMode || 'cards';
      peopleState.cardSize = prefs.cardSize || 'medium';
    }
  } catch (e) {}
}

function savePeoplePreferences() {
  localStorage.setItem('peopleViewPrefs', JSON.stringify({
    displayMode: peopleState.displayMode,
    cardSize: peopleState.cardSize
  }));
}

// Escape HTML helper
function peopleEscapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Display Mode Functions
// ============================================

function switchPeopleDisplay(display) {
  peopleState.displayMode = display;
  savePeoplePreferences();

  // Update buttons
  document.querySelectorAll('.people-display-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.display === display);
  });

  // Show/hide card size control
  const sizeControl = document.getElementById('people-card-size-control');
  if (sizeControl) {
    sizeControl.style.display = display === 'cards' ? 'flex' : 'none';
  }

  renderPeopleList();
}

function switchPeopleCardSize(size) {
  peopleState.cardSize = size;
  savePeoplePreferences();

  // Update buttons
  document.querySelectorAll('.people-card-size-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === size);
  });

  renderPeopleList();
}

// ============================================
// Render Functions
// ============================================

function renderPeopleWithSidebar() {
  renderPeopleSidebar();
  renderPeopleList();
  attachPeopleSidebarListeners();
}

function renderPeopleSidebar() {
  const container = document.getElementById('people-sidebar-content');
  if (!container) return;

  const groups = peopleState.groups || [];
  const people = peopleState.people || [];

  // Get people organized by group
  const groupedPeople = {};
  const ungroupedPeople = [];

  for (const person of people) {
    if (person.group_id) {
      if (!groupedPeople[person.group_id]) {
        groupedPeople[person.group_id] = [];
      }
      groupedPeople[person.group_id].push(person);
    } else {
      ungroupedPeople.push(person);
    }
  }

  let html = '';

  // Render groups
  for (const group of groups) {
    const groupPeople = groupedPeople[group.id] || [];
    const isCollapsed = group.collapsed;
    const itemsHeight = groupPeople.length > 0 ? (groupPeople.length * 32 + 10) : 40;

    const folderIconClass = isCollapsed ? 'folder-icon folder-icon-closed' : 'folder-icon folder-icon-open';

    html += `
      <div class="sidebar-group ${isCollapsed ? 'collapsed' : ''}" data-group-id="${group.id}" draggable="true">
        <div class="sidebar-group-header" data-group-id="${group.id}">
          <span class="sidebar-group-drag-handle">⋮⋮</span>
          <span class="sidebar-group-toggle">▼</span>
          <span class="sidebar-group-icon"><span class="${folderIconClass}"></span></span>
          <span class="sidebar-group-name">${peopleEscapeHtml(group.name)}</span>
          <span class="sidebar-group-count">${groupPeople.length}</span>
          <div class="sidebar-group-actions">
            <button class="sidebar-group-action edit" data-group-id="${group.id}" title="Edit group">✏️</button>
            <button class="sidebar-group-action delete" data-group-id="${group.id}" title="Delete group">×</button>
          </div>
        </div>
        <div class="sidebar-group-items" style="max-height: ${isCollapsed ? '0' : itemsHeight + 'px'}">
          ${groupPeople.length > 0
            ? groupPeople.map(person => renderSidebarPersonItem(person)).join('')
            : '<div class="sidebar-group-empty">Drop people here</div>'
          }
        </div>
      </div>
    `;
  }

  // Render ungrouped people
  if (ungroupedPeople.length > 0) {
    html += `
      <div class="sidebar-ungrouped people-sidebar-ungrouped">
        ${groups.length > 0 ? '<div class="sidebar-ungrouped-label">Ungrouped</div>' : ''}
        ${ungroupedPeople.map(person => renderSidebarPersonItem(person)).join('')}
      </div>
    `;
  }

  // Empty state
  if (people.length === 0 && groups.length === 0) {
    html += `
      <div class="sidebar-empty">
        <p class="text-muted" style="padding: 1rem; text-align: center; font-size: 0.8rem;">
          No people yet
        </p>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderSidebarPersonItem(person) {
  const isActive = peopleState.currentPerson?.id === person.id;
  const initials = getInitials(person.name);
  return `
    <div class="sidebar-person-item ${isActive ? 'active' : ''}" data-person-id="${person.id}" draggable="true">
      <span class="sidebar-person-drag-handle">⋮⋮</span>
      <span class="sidebar-person-avatar">${initials}</span>
      <span class="sidebar-person-name">${peopleEscapeHtml(person.name)}</span>
    </div>
  `;
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function renderPeopleList() {
  const container = document.getElementById('people-list');
  if (!container) return;

  const people = peopleState.people || [];

  // Update container class based on display mode and size
  container.className = peopleState.displayMode === 'cards'
    ? `people-list people-cards-grid size-${peopleState.cardSize}`
    : 'people-list people-list-view';

  if (people.length === 0) {
    container.innerHTML = `
      <div class="people-empty-state">
        <p>No people yet. Click "+ Add Person" to create one.</p>
      </div>
    `;
    return;
  }

  if (peopleState.displayMode === 'cards') {
    container.innerHTML = people.map(person => renderPersonCard(person)).join('');
  } else {
    container.innerHTML = renderPeopleListView(people);
  }

  // Attach card click handlers
  container.querySelectorAll('.person-card').forEach(card => {
    card.addEventListener('click', () => {
      openPerson(card.dataset.personId);
    });
  });

  // Attach list row click handlers
  container.querySelectorAll('.people-list-row').forEach(row => {
    row.addEventListener('click', () => {
      openPerson(row.dataset.personId);
    });
  });
}

function renderPersonCard(person) {
  const initials = getInitials(person.name);
  const relationship = person.relationship ? formatRelationship(person.relationship) : '';
  const company = person.company || '';
  const email = person.email || '';
  const phone = person.phone_mobile || person.phone_work || person.phone_home || '';

  let cardContent = '';

  if (peopleState.cardSize === 'small') {
    cardContent = `
      <div class="person-card-avatar">${initials}</div>
      <div class="person-card-name">${peopleEscapeHtml(person.name)}</div>
    `;
  } else if (peopleState.cardSize === 'medium') {
    cardContent = `
      <div class="person-card-avatar">${initials}</div>
      <div class="person-card-name">${peopleEscapeHtml(person.name)}</div>
      ${relationship ? `<div class="person-card-relationship">${peopleEscapeHtml(relationship)}</div>` : ''}
      ${company ? `<div class="person-card-company">${peopleEscapeHtml(company)}</div>` : ''}
    `;
  } else {
    cardContent = `
      <div class="person-card-avatar">${initials}</div>
      <div class="person-card-name">${peopleEscapeHtml(person.name)}</div>
      ${relationship ? `<div class="person-card-relationship">${peopleEscapeHtml(relationship)}</div>` : ''}
      ${company ? `<div class="person-card-company">${peopleEscapeHtml(company)}</div>` : ''}
      ${email ? `<div class="person-card-email">${peopleEscapeHtml(email)}</div>` : ''}
      ${phone ? `<div class="person-card-phone">${peopleEscapeHtml(phone)}</div>` : ''}
    `;
  }

  return `
    <div class="person-card" data-person-id="${person.id}">
      ${cardContent}
      <button class="person-card-delete" onclick="event.stopPropagation(); confirmDeletePerson('${person.id}')" title="Delete">×</button>
    </div>
  `;
}

function renderPeopleListView(people) {
  return `
    <table class="people-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Relationship</th>
          <th>Company</th>
          <th>Email</th>
          <th>Phone</th>
        </tr>
      </thead>
      <tbody>
        ${people.map(person => `
          <tr class="people-list-row" data-person-id="${person.id}">
            <td>
              <div class="people-list-name-cell">
                <span class="people-list-avatar">${getInitials(person.name)}</span>
                <span>${peopleEscapeHtml(person.name)}</span>
              </div>
            </td>
            <td>${peopleEscapeHtml(formatRelationship(person.relationship))}</td>
            <td>${peopleEscapeHtml(person.company || '')}</td>
            <td>${peopleEscapeHtml(person.email || '')}</td>
            <td>${peopleEscapeHtml(person.phone_mobile || person.phone_work || '')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function formatRelationship(rel) {
  if (!rel) return '';
  return rel.charAt(0).toUpperCase() + rel.slice(1).replace(/_/g, ' ');
}

// ============================================
// Sidebar Event Listeners
// ============================================

function attachPeopleSidebarListeners() {
  // Group header click (toggle)
  document.querySelectorAll('#people-sidebar-content .sidebar-group-header').forEach(header => {
    header.addEventListener('click', async (e) => {
      if (e.target.closest('.sidebar-group-actions')) return;

      const groupId = header.dataset.groupId;
      await togglePeopleGroupCollapse(groupId);
    });
  });

  // Group edit button
  document.querySelectorAll('#people-sidebar-content .sidebar-group-action.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showEditPeopleGroupModal(btn.dataset.groupId);
    });
  });

  // Group delete button
  document.querySelectorAll('#people-sidebar-content .sidebar-group-action.delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDeletePeopleGroup(btn.dataset.groupId);
    });
  });

  // Person item click
  document.querySelectorAll('.sidebar-person-item').forEach(item => {
    item.addEventListener('click', () => {
      openPerson(item.dataset.personId);
    });
  });

  // Initialize drag and drop
  initPeopleSidebarDragDrop();
  initPeopleGroupDragDrop();
}

async function togglePeopleGroupCollapse(groupId) {
  try {
    const result = await peopleApi.toggleGroup(groupId);
    const group = peopleState.groups.find(g => g.id === groupId);
    if (group) {
      group.collapsed = result.collapsed;
    }
    renderPeopleSidebar();
    attachPeopleSidebarListeners();
  } catch (error) {
    console.error('Failed to toggle group:', error);
  }
}

// ============================================
// Group Modal Functions
// ============================================

function showAddPeopleGroupModal() {
  const name = prompt('Enter group name:');
  if (!name || !name.trim()) return;

  createPeopleGroup(name.trim());
}

async function createPeopleGroup(name) {
  try {
    const group = await peopleApi.createGroup({ name });
    peopleState.groups.push(group);
    renderPeopleSidebar();
    attachPeopleSidebarListeners();
  } catch (error) {
    console.error('Failed to create group:', error);
    alert('Failed to create group');
  }
}

function showEditPeopleGroupModal(groupId) {
  const group = peopleState.groups.find(g => g.id === groupId);
  if (!group) return;

  const name = prompt('Enter new group name:', group.name);
  if (!name || !name.trim() || name === group.name) return;

  updatePeopleGroup(groupId, { name: name.trim() });
}

async function updatePeopleGroup(groupId, data) {
  try {
    const result = await peopleApi.updateGroup(groupId, data);
    const index = peopleState.groups.findIndex(g => g.id === groupId);
    if (index !== -1) {
      peopleState.groups[index] = result;
    }
    renderPeopleSidebar();
    attachPeopleSidebarListeners();
  } catch (error) {
    console.error('Failed to update group:', error);
    alert('Failed to update group');
  }
}

async function confirmDeletePeopleGroup(groupId) {
  const group = peopleState.groups.find(g => g.id === groupId);
  if (!group) return;

  if (!confirm(`Delete group "${group.name}"? People in this group will become ungrouped.`)) {
    return;
  }

  try {
    await peopleApi.deleteGroup(groupId);
    peopleState.groups = peopleState.groups.filter(g => g.id !== groupId);
    // Update people to remove group_id
    peopleState.people.forEach(p => {
      if (p.group_id === groupId) {
        p.group_id = null;
      }
    });
    renderPeopleWithSidebar();
  } catch (error) {
    console.error('Failed to delete group:', error);
    alert('Failed to delete group');
  }
}

async function toggleAllPeopleGroups() {
  try {
    peopleState.allGroupsCollapsed = !peopleState.allGroupsCollapsed;
    if (peopleState.allGroupsCollapsed) {
      await peopleApi.collapseAllGroups();
      peopleState.groups.forEach(g => g.collapsed = 1);
    } else {
      await peopleApi.expandAllGroups();
      peopleState.groups.forEach(g => g.collapsed = 0);
    }
    renderPeopleSidebar();
    attachPeopleSidebarListeners();

    // Update toggle button visual
    const toggleBtn = document.getElementById('people-toggle-all-groups-btn');
    if (toggleBtn) {
      toggleBtn.classList.toggle('collapsed', peopleState.allGroupsCollapsed);
    }
  } catch (error) {
    console.error('Failed to toggle all groups:', error);
  }
}

// ============================================
// Person CRUD
// ============================================

async function showNewPersonModal() {
  const name = prompt('Enter person name:');
  if (!name || !name.trim()) return;

  try {
    const person = await peopleApi.create({ name: name.trim() });
    peopleState.people.push(person);
    renderPeopleWithSidebar();
    // Open the person for editing
    openPerson(person.id);
  } catch (error) {
    console.error('Failed to create person:', error);
    alert('Failed to create person');
  }
}

function openPerson(personId) {
  const person = peopleState.people.find(p => p.id === personId);
  if (!person) return;

  peopleState.currentPerson = person;

  // Update sidebar active state
  document.querySelectorAll('.sidebar-person-item').forEach(item => {
    item.classList.toggle('active', item.dataset.personId === personId);
  });

  // For now, just show an alert with person info
  // In the full implementation, this would show the detail view
  const listView = document.getElementById('people-list-view');
  const detailView = document.getElementById('person-detail-view');

  if (listView && detailView) {
    listView.style.display = 'none';
    detailView.style.display = 'block';

    document.getElementById('person-name-display').textContent = person.name;

    // Render person detail content
    const content = document.getElementById('person-detail-content');
    content.innerHTML = renderPersonDetail(person);
  }
}

function renderPersonDetail(person) {
  const initials = getInitials(person.name);

  return `
    <div class="person-detail-card">
      <div class="person-detail-avatar">${initials}</div>
      <div class="person-detail-info">
        <h3>${peopleEscapeHtml(person.name)}</h3>
        ${person.relationship ? `<p class="person-detail-relationship">${formatRelationship(person.relationship)}</p>` : ''}
        ${person.company ? `<p class="person-detail-company">${peopleEscapeHtml(person.company)}${person.job_title ? ` - ${peopleEscapeHtml(person.job_title)}` : ''}</p>` : ''}
      </div>
    </div>

    <div class="person-detail-sections">
      ${renderDetailSection('Contact', [
        { label: 'Email', value: person.email },
        { label: 'Email (Secondary)', value: person.email_secondary },
        { label: 'Phone (Mobile)', value: person.phone_mobile },
        { label: 'Phone (Work)', value: person.phone_work },
        { label: 'Phone (Home)', value: person.phone_home },
      ])}

      ${renderDetailSection('Location', [
        { label: 'Address', value: person.address },
        { label: 'City', value: person.city },
        { label: 'State', value: person.state },
        { label: 'Country', value: person.country },
      ])}

      ${renderDetailSection('Social', [
        { label: 'Website', value: person.website, isUrl: true },
        { label: 'LinkedIn', value: person.linkedin, isUrl: true },
        { label: 'Twitter', value: person.twitter, isUrl: true },
        { label: 'Instagram', value: person.instagram, isUrl: true },
      ])}

      ${person.notes ? `
        <div class="person-detail-section">
          <h4>Notes</h4>
          <p>${peopleEscapeHtml(person.notes)}</p>
        </div>
      ` : ''}
    </div>

    <div class="person-detail-actions">
      <button class="btn btn-primary" onclick="editPerson('${person.id}')">Edit Person</button>
      <button class="btn btn-danger" onclick="confirmDeletePerson('${person.id}')">Delete</button>
    </div>
  `;
}

function renderDetailSection(title, fields) {
  const nonEmptyFields = fields.filter(f => f.value);
  if (nonEmptyFields.length === 0) return '';

  return `
    <div class="person-detail-section">
      <h4>${title}</h4>
      <div class="person-detail-fields">
        ${nonEmptyFields.map(f => `
          <div class="person-detail-field">
            <span class="field-label">${f.label}:</span>
            ${f.isUrl
              ? `<a href="${peopleEscapeHtml(f.value)}" target="_blank" class="field-value">${peopleEscapeHtml(f.value)}</a>`
              : `<span class="field-value">${peopleEscapeHtml(f.value)}</span>`
            }
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function closePerson() {
  peopleState.currentPerson = null;

  const listView = document.getElementById('people-list-view');
  const detailView = document.getElementById('person-detail-view');

  if (listView && detailView) {
    listView.style.display = 'block';
    detailView.style.display = 'none';
  }

  // Update sidebar active state
  document.querySelectorAll('.sidebar-person-item').forEach(item => {
    item.classList.remove('active');
  });
}

function editPerson(personId) {
  // For now, use prompts - in a full implementation, this would be a modal
  const person = peopleState.people.find(p => p.id === personId);
  if (!person) return;

  const name = prompt('Name:', person.name);
  if (name === null) return;

  const email = prompt('Email:', person.email || '');
  if (email === null) return;

  const company = prompt('Company:', person.company || '');
  if (company === null) return;

  updatePerson(personId, {
    name: name || person.name,
    email: email,
    company: company
  });
}

async function updatePerson(personId, data) {
  try {
    const result = await peopleApi.update(personId, data);
    const index = peopleState.people.findIndex(p => p.id === personId);
    if (index !== -1) {
      peopleState.people[index] = result;
    }
    if (peopleState.currentPerson?.id === personId) {
      peopleState.currentPerson = result;
      // Re-render detail view
      const content = document.getElementById('person-detail-content');
      if (content) {
        content.innerHTML = renderPersonDetail(result);
      }
      document.getElementById('person-name-display').textContent = result.name;
    }
    renderPeopleSidebar();
    attachPeopleSidebarListeners();
    renderPeopleList();
  } catch (error) {
    console.error('Failed to update person:', error);
    alert('Failed to update person');
  }
}

async function confirmDeletePerson(personId) {
  const person = peopleState.people.find(p => p.id === personId);
  if (!person) return;

  if (!confirm(`Delete "${person.name}"?`)) return;

  try {
    await peopleApi.delete(personId);
    peopleState.people = peopleState.people.filter(p => p.id !== personId);
    if (peopleState.currentPerson?.id === personId) {
      closePerson();
    }
    renderPeopleWithSidebar();
  } catch (error) {
    console.error('Failed to delete person:', error);
    alert('Failed to delete person');
  }
}

// ============================================
// Drag & Drop
// ============================================

function initPeopleSidebarDragDrop() {
  let draggedPersonId = null;

  // Make person items draggable
  document.querySelectorAll('.sidebar-person-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedPersonId = item.dataset.personId;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.personId);
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedPersonId = null;
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
  });

  // Make groups drop targets
  document.querySelectorAll('#people-sidebar-content .sidebar-group').forEach(group => {
    group.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('application/group-drag')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      group.classList.add('drag-over');
    });

    group.addEventListener('dragleave', (e) => {
      if (e.dataTransfer.types.includes('application/group-drag')) return;
      if (!group.contains(e.relatedTarget)) {
        group.classList.remove('drag-over');
      }
    });

    group.addEventListener('drop', async (e) => {
      if (e.dataTransfer.types.includes('application/group-drag')) return;
      e.preventDefault();
      group.classList.remove('drag-over');

      const personId = e.dataTransfer.getData('text/plain') || draggedPersonId;
      const groupId = group.dataset.groupId;

      if (!personId || !groupId) return;

      try {
        await peopleApi.setPersonGroup(personId, groupId);
        const person = peopleState.people.find(p => p.id === personId);
        if (person) {
          person.group_id = groupId;
        }
        renderPeopleSidebar();
        attachPeopleSidebarListeners();
      } catch (error) {
        console.error('Failed to move person to group:', error);
      }
    });
  });

  // Make ungrouped section a drop target
  const ungroupedSection = document.querySelector('.people-sidebar-ungrouped');
  if (ungroupedSection) {
    ungroupedSection.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      ungroupedSection.classList.add('drag-over');
    });

    ungroupedSection.addEventListener('dragleave', (e) => {
      if (!ungroupedSection.contains(e.relatedTarget)) {
        ungroupedSection.classList.remove('drag-over');
      }
    });

    ungroupedSection.addEventListener('drop', async (e) => {
      e.preventDefault();
      ungroupedSection.classList.remove('drag-over');

      const personId = e.dataTransfer.getData('text/plain') || draggedPersonId;
      if (!personId) return;

      try {
        await peopleApi.setPersonGroup(personId, null);
        const person = peopleState.people.find(p => p.id === personId);
        if (person) {
          person.group_id = null;
        }
        renderPeopleSidebar();
        attachPeopleSidebarListeners();
      } catch (error) {
        console.error('Failed to ungroup person:', error);
      }
    });
  }
}

function initPeopleGroupDragDrop() {
  let draggedGroupId = null;
  let draggedGroupEl = null;
  let placeholder = null;

  document.querySelectorAll('#people-sidebar-content .sidebar-group').forEach(group => {
    const handle = group.querySelector('.sidebar-group-drag-handle');
    if (!handle) return;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      draggedGroupId = group.dataset.groupId;
      draggedGroupEl = group;

      const startY = e.clientY;
      const groups = Array.from(document.querySelectorAll('#people-sidebar-content .sidebar-group'));

      placeholder = document.createElement('div');
      placeholder.className = 'sidebar-group-placeholder';
      placeholder.style.height = group.offsetHeight + 'px';

      const onMouseMove = (moveEvent) => {
        if (!draggedGroupEl.classList.contains('group-dragging')) {
          draggedGroupEl.classList.add('group-dragging');
          draggedGroupEl.parentNode.insertBefore(placeholder, draggedGroupEl.nextSibling);
        }

        // Find position to insert
        for (const g of groups) {
          if (g === draggedGroupEl) continue;
          const rect = g.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;

          if (moveEvent.clientY < midY) {
            g.parentNode.insertBefore(placeholder, g);
            g.parentNode.insertBefore(draggedGroupEl, placeholder);
            break;
          } else if (g === groups[groups.length - 1]) {
            g.parentNode.insertBefore(placeholder, g.nextSibling);
            g.parentNode.insertBefore(draggedGroupEl, placeholder);
          }
        }
      };

      const onMouseUp = async () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (draggedGroupEl) {
          draggedGroupEl.classList.remove('group-dragging');
        }
        if (placeholder && placeholder.parentNode) {
          placeholder.remove();
        }

        // Save new order
        const newGroups = Array.from(document.querySelectorAll('#people-sidebar-content .sidebar-group'));
        const order = newGroups.map((g, i) => ({ id: g.dataset.groupId, position: i }));

        try {
          await peopleApi.reorderGroups(order);
          // Update local state
          order.forEach(item => {
            const group = peopleState.groups.find(g => g.id === item.id);
            if (group) group.position = item.position;
          });
          peopleState.groups.sort((a, b) => a.position - b.position);
        } catch (error) {
          console.error('Failed to reorder groups:', error);
        }

        draggedGroupId = null;
        draggedGroupEl = null;
        placeholder = null;
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

// ============================================
// Load Data
// ============================================

async function loadPeople() {
  try {
    const [people, groups] = await Promise.all([
      peopleApi.list(),
      peopleApi.listGroups()
    ]);
    peopleState.people = people;
    peopleState.groups = groups;
    renderPeopleWithSidebar();
  } catch (error) {
    console.error('Failed to load people:', error);
  }
}

// ============================================
// Initialization
// ============================================

let peopleInitialized = false;

function initPeople() {
  if (peopleInitialized) return;

  console.log("[PEOPLE] initPeople() called");
  const peopleTab = document.querySelector('.tab-content[data-tab="people"]');
  if (!peopleTab) return;

  peopleInitialized = true;
  loadPeoplePreferences();

  // Set initial button states
  document.querySelectorAll('.people-display-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.display === peopleState.displayMode);
  });
  document.querySelectorAll('.people-card-size-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === peopleState.cardSize);
  });

  // Set initial state for size control visibility
  const sizeControl = document.getElementById('people-card-size-control');
  if (sizeControl) {
    sizeControl.style.display = peopleState.displayMode === 'cards' ? 'flex' : 'none';
  }

  // ===== STATIC SIDEBAR BUTTON LISTENERS =====
  // Add new person button
  document.getElementById('sidebar-new-person-btn')?.addEventListener('click', showNewPersonModal);

  // Add group button
  document.getElementById('people-add-group-btn')?.addEventListener('click', showAddPeopleGroupModal);

  // Toggle all groups button
  document.getElementById('people-toggle-all-groups-btn')?.addEventListener('click', toggleAllPeopleGroups);

  // Back button
  document.getElementById('back-to-people')?.addEventListener('click', closePerson);

  // Display toggle
  document.querySelectorAll('.people-display-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPeopleDisplay(btn.dataset.display));
  });

  // Card size toggle
  document.querySelectorAll('.people-card-size-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPeopleCardSize(btn.dataset.size));
  });

  // Load data on tab click
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab === 'people') {
        console.log("[PEOPLE] Tab click detected, calling loadPeople");
        loadPeople();
      }
    });
  });

  // If already on people tab, load data
  const activeTab = document.querySelector('.tab.active');
  if (activeTab?.dataset.tab === 'people') {
    loadPeople();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPeople);
} else {
  initPeople();
}

console.log("[PEOPLE] Script loaded, readyState:", document.readyState);

// Export for use in other modules
window.peopleApi = peopleApi;
window.loadPeople = loadPeople;
window.editPerson = editPerson;
window.confirmDeletePerson = confirmDeletePerson;

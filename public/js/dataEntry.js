/**
 * DataOps Manager - Data Entry Page Logic
 * Handles the premium new record entry form, auto-calculations, and API submissions.
 */

let departments = [];
let categories = [];
let currentRecordId = null;

document.addEventListener('DOMContentLoaded', initDataEntry);

/**
 * Initialize data entry page
 */
async function initDataEntry() {
  await Promise.all([loadDepartments(), loadCategories()]);
  
  // Check if editing an existing record
  const urlParams = new URLSearchParams(window.location.search);
  const recordId = urlParams.get('id');

  if (recordId) {
    currentRecordId = recordId;
    document.querySelector('h1').textContent = 'Edit Record';
    document.querySelector('p.text-slate-500').textContent = 'Modify and update the centralized ledger with your operational data.';
    await loadRecordData(recordId);
  } else {
    // Set default date to today for new records
    const dateInput = document.getElementById('recordDate');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  }

  setupEventListeners();
}

/**
 * Load existing record data for editing
 */
async function loadRecordData(recordId) {
  try {
    const response = await API.records.getById(recordId);
    if (!response.success) {
      Utils.showToast('Failed to load record data', 'error');
      return;
    }

    const record = response.data;
    
    // Fill classification
    const deptId = record.department?._id || '';
    document.getElementById('department').value = deptId;
    updateCategoryDropdown(deptId);
    document.getElementById('category').value = record.category?._id || '';
    document.getElementById('unit').value = record.unit || '';
    document.getElementById('recordDate').value = Utils.formatDate(record.date, 'iso');
    
    // Fill operational
    document.getElementById('recordsReceived').value = record.recordsReceived || '';
    document.getElementById('recordsProcessed').value = record.recordsProcessed || '';
    
    // Status
    setStatus(record.status || 'received');

    // Financial
    document.getElementById('calculatedValue').value = record.calculatedValue || '';
    document.getElementById('notes').value = record.notes || '';

    // Trigger calculations
    updateCalculations();
    
    // Update button text
    const btn = document.getElementById('saveRecordBtn');
    if (btn) btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">update</span> Update Record`;
    
  } catch (error) {
    console.error('Error loading record:', error);
    Utils.showToast('Error loading record data', 'error');
  }
}

/**
 * Load departments for dropdown
 */
async function loadDepartments() {
  try {
    const response = await API.departments.getAll();
    if (response.success) {
      departments = response.data;
      const select = document.getElementById('department');
      if (select) {
        select.innerHTML =
          '<option value="">Select Department</option>' +
          departments
            .filter((d) => d.active)
            .map((d) => `<option value="${d._id}">${d.name}</option>`)
            .join('');
      }
    }
  } catch (error) {
    Utils.showToast('Failed to load departments', 'error');
  }
}

/**
 * Load categories for matching logic
 */
async function loadCategories() {
  try {
    const response = await API.categories.getAll();
    if (response.success) {
      categories = response.data;
    }
  } catch (error) {
    Utils.showToast('Failed to load categories', 'error');
  }
}

/**
 * Update modal category dropdown based on department selection
 */
function updateCategoryDropdown(departmentId) {
  const categorySelect = document.getElementById('category');
  if (!categorySelect) return;

  categorySelect.innerHTML = '<option value="">Select Category</option>';
  
  if (!departmentId) {
    categorySelect.disabled = true;
    return;
  }
  
  categorySelect.disabled = false;

  const deptCategories = categories.filter(c => 
    c.active && (c.department === departmentId || c.department?._id === departmentId || !c.department)
  );
  
  categorySelect.innerHTML += deptCategories
    .map(c => `<option value="${c._id}">${c.name}</option>`)
    .join('');
}

/**
 * Calculate totals for the right sidebar
 */
function updateCalculations() {
  const received = parseFloat(document.getElementById('recordsReceived')?.value) || 0;
  const processed = parseFloat(document.getElementById('recordsProcessed')?.value) || 0;
  const value = parseFloat(document.getElementById('calculatedValue')?.value) || 0;
  
  const pending = received - processed;

  document.getElementById('calcReceived').textContent = received.toLocaleString();
  document.getElementById('calcProcessed').textContent = processed.toLocaleString();
  
  const pendingEl = document.getElementById('calcPending');
  pendingEl.textContent = pending.toLocaleString();
  if (pending < 0) {
    pendingEl.classList.remove('text-amber-200');
    pendingEl.classList.add('text-red-300');
  } else {
    pendingEl.classList.remove('text-red-300');
    pendingEl.classList.add('text-amber-200');
  }

  document.getElementById('calcValue').textContent = '$' + value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Change status and update visual badges
 */
function setStatus(statusValue) {
  document.getElementById('recordStatus').value = statusValue;
  document.querySelectorAll('.status-badge').forEach(btn => {
    if (btn.dataset.status === statusValue) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Department change
  document.getElementById('department')?.addEventListener('change', (e) => {
    updateCategoryDropdown(e.target.value);
  });

  // Numeric inputs for live calculations
  ['recordsReceived', 'recordsProcessed', 'calculatedValue'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateCalculations);
  });

  // Status badges
  document.querySelectorAll('.status-badge').forEach(btn => {
    btn.addEventListener('click', (e) => {
      setStatus(e.target.dataset.status);
    });
  });

  // Save record
  document.getElementById('saveRecordBtn')?.addEventListener('click', saveRecord);
}

/**
 * Submit Record to API
 */
async function saveRecord(e) {
  e.preventDefault();

  const form = document.getElementById('recordForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = {
    department: document.getElementById('department').value,
    unit: document.getElementById('unit').value,
    category: document.getElementById('category').value,
    date: document.getElementById('recordDate').value,
    recordsReceived: parseInt(document.getElementById('recordsReceived').value) || 0,
    recordsProcessed: parseInt(document.getElementById('recordsProcessed').value) || 0,
    status: document.getElementById('recordStatus').value,
    calculatedValue: parseFloat(document.getElementById('calculatedValue').value) || 0,
    notes: document.getElementById('notes').value,
  };

  try {
    const btn = document.getElementById('saveRecordBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span> Saving...`;
    btn.disabled = true;

    let response;
    if (currentRecordId) {
      response = await API.records.update(currentRecordId, data);
    } else {
      response = await API.records.create(data);
    }

    if (response.success) {
      Utils.showToast(currentRecordId ? 'Record updated successfully!' : 'Record created successfully!', 'success');
      setTimeout(() => {
        window.location.href = 'records.html';
      }, 1000);
    }
  } catch (error) {
    Utils.showToast(error.message || 'Failed to save record. Please check inputs.', 'error');
    const btn = document.getElementById('saveRecordBtn');
    btn.innerHTML = currentRecordId ? `<span class="material-symbols-outlined text-[18px]">update</span> Update Record` : `<span class="material-symbols-outlined text-[18px]">save</span> Save Record`;
    btn.disabled = false;
  }
}

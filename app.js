const API_URL = 'https://script.google.com/macros/s/AKfycbz7tPrVsKyZ85-ga8iplEC7hZ-Uhg6cUIGjnEkO-aN6IAhtrrRyzU7CT8xlKrhInyal/exec';

let authToken = null;
let currentUser = null;
let sessionTimer = null;
let sessionExpireTimer = null;
let sessionExpired = false;
let editingShipmentId = null;
let versionTimer = null;
let lastKnownShipmentsVersion = '';
let allShipments = [];
let shipmentOptions = {
  units: [],
  destinations: []
};

const SHIPMENT_STATUSES = [
  'Нова доставка',
  'В процесі',
  'Виконано',
  'Не виконано',
  'Втрачено/знищено'
];

const DEFAULT_SHIPMENT_STATUS = 'Нова доставка';

const DASHBOARD_FILTERS = [
  {
    key: 'status',
    label: 'Статус'
  },
  {
    key: 'unit',
    label: 'Підрозділ'
  },
  {
    key: 'destination',
    label: 'Куди'
  }
];

const toggleFormBtn =
  document.getElementById('toggleFormBtn');

const shipmentForm =
  document.getElementById('shipmentForm');

const toggleFormText =
  document.getElementById('toggleFormText');

const toggleFormIcon =
  document.getElementById('toggleFormIcon');

const loadBtn =
  document.getElementById('loadBtn');

const adminDashboard =
  document.getElementById('adminDashboard');

const dashboardFrom =
  document.getElementById('dashboardFrom');

const dashboardTo =
  document.getElementById('dashboardTo');

const dashboardFilters =
  document.getElementById('dashboardFilters');

const dashboardResult =
  document.getElementById('dashboardResult');

const addDashboardFilterBtn =
  document.getElementById('addDashboardFilterBtn');

const buildDashboardBtn =
  document.getElementById('buildDashboardBtn');

let formOpened = false;

toggleFormBtn.addEventListener('click', () => {

  formOpened = !formOpened;

  if (formOpened) {

    shipmentForm.classList.add('form-open');

    toggleFormText.innerText =
      'Закрити форму';

    toggleFormIcon.style.transform =
      'rotate(45deg)';

  } else {

    shipmentForm.classList.remove('form-open');

    toggleFormText.innerText =
      'Створити заявку';

    toggleFormIcon.style.transform =
      'rotate(0deg)';
  }
});

function startSessionTimer() {

  clearTimeout(sessionTimer);
  clearTimeout(sessionExpireTimer);

  sessionExpired = false;

  sessionTimer = setTimeout(() => {

    document
      .getElementById('sessionWarning')
      .classList.remove('hidden');

  }, 50 * 60 * 1000);

  sessionExpireTimer = setTimeout(() => {

    sessionExpired = true;
    stopVersionTimer();

    document
      .getElementById('sessionExpired')
      .classList.remove('hidden');

  }, 55 * 60 * 1000);
}

async function handleCredentialResponse(response) {

  authToken = response.credential;

  document.getElementById('loginBlock')
    .classList.add('hidden');

  document.getElementById('loader')
    .classList.remove('hidden');

  let result;

  try {
    result = await api('auth');
  } catch (e) {
    console.error(e);

    document.getElementById('loader')
      .classList.add('hidden');

    showLoginScreen();

    return;
  }

  if (!result.success) {

    document.getElementById('loader')
      .classList.add('hidden');

    document.getElementById('deniedScreen')
      .classList.remove('hidden');

    return;
  }

  currentUser = result.data.user;

  startSessionTimer();
  startVersionTimer();

  document.getElementById('userInfo')
    .innerText = currentUser.name;

  await loadShipmentOptions();
  setupAdminDashboard();
  await loadShipments();

  document.getElementById('loader')
    .classList.add('hidden');

  document.getElementById('app')
    .classList.remove('hidden');
}

async function api(
  action,
  data = {}
) {

  const formData = new URLSearchParams();

  formData.append(
    'payload',
    JSON.stringify({
      token: authToken,
      action,
      data
    })
  );

  const response = await fetch(API_URL, {
    method: 'POST',
    body: formData
  });

  const result = await response.json();

  if (
    !result.success &&
    result.error === 'AUTH_REQUIRED'
  ) {

    document
      .getElementById('sessionExpired')
      .classList.remove('hidden');
  
    throw new Error('AUTH_REQUIRED');
  }

  return result;
}

let toastTimeout = null;

function showLoginScreen() {

  document.getElementById('app')
    .classList.add('hidden');

  document.getElementById('loader')
    .classList.add('hidden');

  document.getElementById('deniedScreen')
    .classList.add('hidden');

  document.getElementById('loginBlock')
    .classList.remove('hidden');
}

function showToast(message, type = 'error') {

  const toast = document.getElementById('toast');

  toast.innerText = message;

  toast.classList.remove('success');

  if (type === 'success') {
    toast.classList.add('success');
  }

  toast.classList.add('show');

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {

    toast.classList.remove('show');

  }, 2500);
}

function getShipmentsVersion(items) {

  return items.reduce((version, item) => {

    const itemVersion = Number(
      item.updatedAtVersion || 0
    );

    return itemVersion > version
      ? itemVersion
      : version;

  }, 0).toString();
}

function setUpdateNotice(hasUpdates) {

  if (hasUpdates) {
    loadBtn.innerText = 'Є оновлення';
    loadBtn.classList.add('has-updates');
    return;
  }

  loadBtn.innerText = 'Оновити';
  loadBtn.classList.remove('has-updates');
}

function startVersionTimer() {

  clearInterval(versionTimer);

  versionTimer = setInterval(
    checkShipmentsVersion,
    60 * 1000
  );
}

function stopVersionTimer() {

  clearInterval(versionTimer);
  versionTimer = null;
}

async function checkShipmentsVersion() {

  if (
    sessionExpired ||
    editingShipmentId
  ) {
    return;
  }

  try {
    const result = await api('getShipmentsVersion');

    if (!result.success) {
      return;
    }

    const version = result.data.version || '';

    if (
      lastKnownShipmentsVersion &&
      version &&
      version !== lastKnownShipmentsVersion
    ) {
      setUpdateNotice(true);
    }

  } catch (e) {
    console.error(e);
  }
}

function validateLength(value, min, max) {

  return value.length >= min &&
         value.length <= max;
}

function escapeHtml(value) {

  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTimeInput(value) {

  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return '';
  }

  date.setMinutes(
    date.getMinutes() - date.getTimezoneOffset()
  );

  return date.toISOString().slice(0, 16);
}

function formatDateInput(date) {

  const value = new Date(date);

  value.setMinutes(
    value.getMinutes() - value.getTimezoneOffset()
  );

  return value.toISOString().slice(0, 10);
}

function isAdmin() {

  return currentUser &&
         String(currentUser.role).toLowerCase() === 'admin';
}

function canEditShipment(item) {

  return Boolean(currentUser);
}

function buildOptions(options, selectedValue) {

  const values = [...options];

  if (
    selectedValue &&
    !values.includes(selectedValue)
  ) {
    values.unshift(selectedValue);
  }

  return values
    .map(option => `
      <option
        value="${escapeHtml(option)}"
        ${option === selectedValue ? 'selected' : ''}
      >
        ${escapeHtml(option)}
      </option>
    `)
    .join('');
}

function populateSelect(select, options, placeholder) {

  select.innerHTML = `
    <option value="" disabled selected>
      ${escapeHtml(placeholder)}
    </option>
  `;

  options.forEach(option => {
    const item = document.createElement('option');

    item.value = option;
    item.innerText = option;

    select.appendChild(item);
  });
}

function populateCreateOptions() {

  populateSelect(
    document.getElementById('unit'),
    shipmentOptions.units,
    'Оберіть підрозділ'
  );

  populateSelect(
    document.getElementById('destination'),
    shipmentOptions.destinations,
    'Оберіть куди'
  );
}

async function loadShipmentOptions() {

  const result = await api('getShipmentOptions');

  if (!result.success) {
    showToast(result.error);
    return;
  }

  shipmentOptions = {
    units: result.data.units || [],
    destinations: result.data.destinations || []
  };

  populateCreateOptions();
}

async function createShipment() {

  const product = document.getElementById('product').value.trim();
  const unit = document.getElementById('unit').value.trim();
  const destination = document.getElementById('destination').value.trim();
  const comment = document.getElementById('comment').value.trim();

  if (!product) {
    showToast('Вкажіть тип забезпечення');
    return;
  }

  if (!validateLength(product, 2, 80)) {
    showToast(
      'Тип забезпечення повинен містити від 2 до 80 символів'
    );

    return;
  }

  if (!unit) {
    showToast('Вкажіть підрозділ');
    return;
  }

  if (!validateLength(unit, 2, 30)) {
    showToast(
      'Підрозділ повинен містити від 2 до 30 символів'
    );

    return;
  }

  if (!destination) {
    showToast('Вкажіть куди');
    return;
  }

  if (!validateLength(destination, 2, 180)) {
    showToast(
      'Поле "Куди" повинно містити від 2 до 180 символів'
    );

    return;
  }

  const createBtn = document.getElementById('createBtn');

  createBtn.classList.add('loading');

  try {
    const result = await api(
      'createShipment',
      {
        name: currentUser.name,
        product,
        unit,
        destination,
        comment
      }
    );

    if (!result.success) {
      showToast(result.error);
      return;
    }

    document.getElementById('product').value = '';
    document.getElementById('unit').value = '';
    document.getElementById('destination').value = '';
    document.getElementById('comment').value = '';

    shipmentForm.classList.remove('form-open');

    toggleFormText.innerText =
      'Створити заявку';

    toggleFormIcon.style.transform =
      'rotate(0deg)';

    formOpened = false;

    await loadShipments();

  } catch (e) {
    console.error(e);

    showToast('Помилка створення доставки');

  } finally {
    createBtn.classList.remove('loading');
  }
}

async function loadShipments() {

  const shipments = document.getElementById('shipments');

  const shipmentsLoader = document.getElementById('shipmentsLoader');

  shipments.style.opacity = '0';

  await new Promise(resolve =>
    setTimeout(resolve, 200)
  );

  shipments.innerHTML = '';

  shipmentsLoader.classList.remove('hidden');

  const result = await api('getShipments');

  shipmentsLoader.classList.add('hidden');

  if (!result.success) {

    shipments.style.opacity = '1';
  
    showToast(result.error);
  
    return;
  }
  
  const items = result.data || [];

  allShipments = items;

  lastKnownShipmentsVersion =
    getShipmentsVersion(items);

  setUpdateNotice(false);

  renderShipments(items);
  renderDashboard();

  shipments.style.opacity = '1';
}

function getDashboardValues(key) {

  if (key === 'status') {
    return SHIPMENT_STATUSES;
  }

  if (key === 'unit') {
    return shipmentOptions.units;
  }

  if (key === 'destination') {
    return shipmentOptions.destinations;
  }

  return [];
}

function getDashboardFilterRows() {

  return Array.from(
    dashboardFilters.querySelectorAll('.dashboard-filter-row')
  );
}

function buildFilterTypeOptions(selectedKey) {

  return DASHBOARD_FILTERS
    .map(filter => `
      <option
        value="${escapeHtml(filter.key)}"
        ${filter.key === selectedKey ? 'selected' : ''}
      >
        ${escapeHtml(filter.label)}
      </option>
    `)
    .join('');
}

function buildFilterValueOptions(key, selectedValue) {

  const values = getDashboardValues(key);

  return values
    .map(value => `
      <option
        value="${escapeHtml(value)}"
        ${value === selectedValue ? 'selected' : ''}
      >
        ${escapeHtml(value)}
      </option>
    `)
    .join('');
}

function syncDashboardRemoveButtons() {

  const rows = getDashboardFilterRows();

  rows.forEach(row => {
    const removeBtn = row.querySelector('.dashboard-remove-filter');

    removeBtn.disabled = rows.length === 1;
  });
}

function addDashboardFilter(
  key = 'status',
  value = DEFAULT_SHIPMENT_STATUS
) {

  const values = getDashboardValues(key);
  const selectedValue = values.includes(value)
    ? value
    : values[0] || '';

  const row = document.createElement('div');

  row.className = 'dashboard-filter-row';

  row.innerHTML = `
    <div class="select-wrap">
      <select class="dashboard-filter-type">
        ${buildFilterTypeOptions(key)}
      </select>
    </div>

    <div class="select-wrap">
      <select class="dashboard-filter-value">
        ${buildFilterValueOptions(key, selectedValue)}
      </select>
    </div>

    <button
      type="button"
      class="dashboard-remove-filter"
      aria-label="Прибрати параметр"
    >
      ×
    </button>
  `;

  const typeSelect =
    row.querySelector('.dashboard-filter-type');

  const valueSelect =
    row.querySelector('.dashboard-filter-value');

  typeSelect.addEventListener('change', () => {
    const valuesForType =
      getDashboardValues(typeSelect.value);

    valueSelect.innerHTML = buildFilterValueOptions(
      typeSelect.value,
      valuesForType[0] || ''
    );
  });

  row
    .querySelector('.dashboard-remove-filter')
    .addEventListener('click', () => {
      if (getDashboardFilterRows().length === 1) {
        return;
      }

      row.remove();
      syncDashboardRemoveButtons();
    });

  dashboardFilters.appendChild(row);
  syncDashboardRemoveButtons();
}

function getDashboardFilters() {

  const filters = getDashboardFilterRows()
    .map(row => ({
      key: row.querySelector('.dashboard-filter-type').value,
      value: row.querySelector('.dashboard-filter-value').value
    }))
    .filter(filter => filter.key && filter.value);

  return filters.reduce((groups, filter) => {
    if (!groups[filter.key]) {
      groups[filter.key] = [];
    }

    if (!groups[filter.key].includes(filter.value)) {
      groups[filter.key].push(filter.value);
    }

    return groups;
  }, {});
}

function getShipmentDate(item) {

  const date = new Date(item.createdAtRaw);

  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function isShipmentInDashboardPeriod(item, fromDate, toDate) {

  const date = getShipmentDate(item);

  if (!date) {
    return false;
  }

  return date >= fromDate &&
         date <= toDate;
}

function filterDashboardShipments() {

  const fromDate = new Date(`${dashboardFrom.value}T00:00:00`);
  const toDate = new Date(`${dashboardTo.value}T23:59:59`);
  const filterGroups = getDashboardFilters();

  if (
    isNaN(fromDate.getTime()) ||
    isNaN(toDate.getTime()) ||
    fromDate > toDate
  ) {
    showToast('Перевірте період статистики');
    return null;
  }

  return allShipments.filter(item => {
    if (!isShipmentInDashboardPeriod(item, fromDate, toDate)) {
      return false;
    }

    return Object.keys(filterGroups).every(key => {
      return filterGroups[key].includes(
        String(item[key] || '')
      );
    });
  });
}

function getStatusBreakdown(items) {

  return SHIPMENT_STATUSES
    .map(status => ({
      label: status,
      count: items.filter(item => item.status === status).length
    }))
    .filter(item => item.count > 0);
}

function renderDashboardChart(items) {

  const breakdown = getStatusBreakdown(items);
  const total = items.length;
  const maxCount = Math.max(
    ...breakdown.map(item => item.count),
    1
  );

  if (!total) {
    return `
      <div class="dashboard-empty">
        За вибраними параметрами заявок немає
      </div>
    `;
  }

  return `
    <div class="dashboard-total">
      <span>${total}</span>
      <small>заявок за період</small>
    </div>

    <div class="dashboard-bars">
      ${breakdown
        .map(item => `
          <div class="dashboard-bar-row">
            <div class="dashboard-bar-label">
              ${escapeHtml(item.label)}
            </div>

            <div class="dashboard-bar-track">
              <div
                class="dashboard-bar-fill ${getStatusClass(item.label)}"
                style="width: ${(item.count / maxCount) * 100}%"
              ></div>
            </div>

            <div class="dashboard-bar-count">
              ${item.count}
            </div>
          </div>
        `)
        .join('')
      }
    </div>
  `;
}

function renderDashboard() {

  if (!isAdmin()) {
    return;
  }

  const filteredItems = filterDashboardShipments();

  if (!filteredItems) {
    return;
  }

  dashboardResult.innerHTML =
    renderDashboardChart(filteredItems);
}

function setupAdminDashboard() {

  if (!isAdmin()) {
    adminDashboard.classList.add('hidden');
    return;
  }

  const today = new Date();
  const monthStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  );

  adminDashboard.classList.remove('hidden');

  dashboardFrom.value = formatDateInput(monthStart);
  dashboardTo.value = formatDateInput(today);

  dashboardFilters.innerHTML = '';

  addDashboardFilter(
    'status',
    DEFAULT_SHIPMENT_STATUS
  );
}

function getStatusClass(status) {

  switch (status) {

    case 'Виконано':
      return 'status-success';

    case 'В процесі':
    case 'Нова доставка':
      return 'status-warning';

    case 'Не виконано':
    case 'Втрачено/знищено':
      return 'status-danger';

    default:
      return '';
  }
}

function renderDetailsView(item) {

  const editButton = canEditShipment(item)
    ? `
      <button
        type="button"
        class="details-action edit-shipment-btn"
      >
        Змінити
      </button>
    `
    : '';

  return `
    <div>
      <b>Куди:</b> ${escapeHtml(item.destination)}
    </div>

    <div>
      <b>Тип:</b> ${escapeHtml(item.product)}
    </div>

    <div>
      <b>Підрозділ:</b> ${escapeHtml(item.unit || 'Не вказано')}
    </div>
  
    <div>
      <b>Дата створення заявки:</b> ${escapeHtml(item.createdAt)}
    </div>
  
    <div>
      <b>Тип БПЛА:</b> ${escapeHtml(item.method || 'Не вказано')}
    </div>

    <div>
      <b>Дата відправки:</b> ${escapeHtml(item.sentAt || 'Не вказано')}
    </div>

    <div>
      <b>Екіпаж:</b> ${escapeHtml(item.crew || 'Не вказано')}
    </div>
  
    <div>
      <b>Створив заявку:</b> ${escapeHtml(item.name)}
    </div>
  
    <div>
      <b>Статус:</b>
    
      <span class="${getStatusClass(item.status)}">
        ${escapeHtml(item.status)}
      </span>
    </div>
  
    <div>
      <b>ID:</b> ${escapeHtml(item.id)}
    </div>
  
    ${item.comment
      ? `
        <div>
          <b>Коментар:</b> ${escapeHtml(item.comment)}
        </div>
      `
      : ''
    }

    ${editButton}
  `;
}

function renderEditForm(item) {

  return `
    <div class="details-edit-form">

      <input
        type="text"
        class="edit-product"
        value="${escapeHtml(item.product)}"
        placeholder="Тип забезпечення"
      >

      <div class="select-wrap">
        <select class="edit-unit">
          ${buildOptions(shipmentOptions.units, item.unit)}
        </select>
      </div>

      <div class="select-wrap">
        <select class="edit-destination">
          ${buildOptions(
            shipmentOptions.destinations,
            item.destination
          )}
        </select>
      </div>

      <input
        type="text"
        class="edit-method"
        value="${escapeHtml(item.method)}"
        placeholder="Тип БПЛА"
      >

      <input
        type="datetime-local"
        class="edit-sent-at"
        value="${formatDateTimeInput(item.sentAtRaw)}"
        aria-label="Дата відправки"
      >

      <input
        type="text"
        class="edit-crew"
        value="${escapeHtml(item.crew)}"
        placeholder="Екіпаж"
      >

      <div class="select-wrap">
        <select class="edit-status">
          ${buildOptions(SHIPMENT_STATUSES, item.status)}
        </select>
      </div>

      <textarea
        class="edit-comment"
        placeholder="Коментар"
      >${escapeHtml(item.comment)}</textarea>

      <div class="details-actions">
        <button
          type="button"
          class="details-action save-shipment-btn"
          disabled
        >
          Зберегти
        </button>

        <button
          type="button"
          class="details-action secondary cancel-edit-btn"
        >
          Скасувати
        </button>
      </div>

    </div>
  `;
}

function getEditData(details) {

  return {
    product: details.querySelector('.edit-product').value.trim(),
    unit: details.querySelector('.edit-unit').value.trim(),
    destination: details.querySelector('.edit-destination').value.trim(),
    method: details.querySelector('.edit-method').value.trim(),
    sentAt: details.querySelector('.edit-sent-at').value.trim(),
    crew: details.querySelector('.edit-crew').value.trim(),
    status: details.querySelector('.edit-status').value,
    comment: details.querySelector('.edit-comment').value.trim()
  };
}

function getItemEditData(item) {

  return {
    product: String(item.product || '').trim(),
    unit: String(item.unit || '').trim(),
    destination: String(item.destination || '').trim(),
    method: String(item.method || '').trim(),
    sentAt: formatDateTimeInput(item.sentAtRaw),
    crew: String(item.crew || '').trim(),
    status: String(item.status || ''),
    comment: String(item.comment || '').trim()
  };
}

function setupEditChangeTracking(item, details) {

  const initialData = JSON.stringify(
    getItemEditData(item)
  );
  const saveBtn =
    details.querySelector('.save-shipment-btn');

  const updateSaveState = () => {
    const currentData = JSON.stringify(
      getEditData(details)
    );

    saveBtn.disabled = currentData === initialData;
  };

  details
    .querySelectorAll('input, select, textarea')
    .forEach(input => {
      input.addEventListener('input', updateSaveState);
      input.addEventListener('change', updateSaveState);
    });

  updateSaveState();
}

function validateEditData(data) {

  if (!data.product) {
    showToast('Вкажіть тип забезпечення');
    return false;
  }

  if (!validateLength(data.product, 2, 80)) {
    showToast(
      'Тип забезпечення повинен містити від 2 до 80 символів'
    );

    return false;
  }

  if (!data.unit) {
    showToast('Вкажіть підрозділ');
    return false;
  }

  if (!validateLength(data.unit, 2, 30)) {
    showToast(
      'Підрозділ повинен містити від 2 до 30 символів'
    );

    return false;
  }

  if (
    data.method &&
    !validateLength(data.method, 2, 40)
  ) {
    showToast(
      'Тип БПЛА повинен містити від 2 до 40 символів'
    );

    return false;
  }

  if (
    data.crew &&
    !validateLength(data.crew, 2, 40)
  ) {
    showToast(
      'Екіпаж повинен містити від 2 до 40 символів'
    );

    return false;
  }

  if (!data.destination) {
    showToast('Вкажіть куди');
    return false;
  }

  if (!validateLength(data.destination, 2, 180)) {
    showToast(
      'Поле "Куди" повинно містити від 2 до 180 символів'
    );

    return false;
  }

  return true;
}

async function saveShipmentEdit(item, details) {

  const data = getEditData(details);
  const saveBtn = details.querySelector('.save-shipment-btn');

  if (saveBtn.disabled) {
    return;
  }

  if (!validateEditData(data)) {
    return;
  }

  saveBtn.classList.add('loading');

  try {
    const result = await api(
      'updateShipment',
      {
        id: item.id,
        expectedUpdatedAt: item.updatedAtVersion,
        ...data
      }
    );

    if (!result.success) {
      if (result.error === 'CONFLICT') {
        showToast(
          'Заявку вже змінили. Оновлюю список'
        );

        editingShipmentId = null;
        await loadShipments();
        return;
      }

      if (
        result.error === 'FORBIDDEN' ||
        result.error === 'FORBIDDEN_STATUS'
      ) {
        showToast('Недостатньо прав для редагування');
        editingShipmentId = null;
        await loadShipments();
        return;
      }

      showToast(result.error);
      return;
    }

    editingShipmentId = null;
    showToast('Зміни збережено', 'success');

    await loadShipments();

  } catch (e) {
    console.error(e);

    showToast('Помилка збереження заявки');

  } finally {
    saveBtn.classList.remove('loading');
  }
}

function renderShipments(items) {

  const container =
    document.getElementById('shipments');

  container.innerHTML = '';

  if (!items.length) {

    container.innerHTML = `
      <div class="empty-state">

        <div class="empty-icon">
          ⊹
        </div>

        <div class="empty-title">
          Список порожній
        </div>

        <div class="empty-text">
          У вас ще немає відправок
        </div>

      </div>
    `;

    return;
  }

  items.forEach((item, index) => {

    const div = document.createElement('div');

    div.className = 'card';

    div.style.animationDelay =
      `${index * 70}ms`;

    div.innerHTML = `

      <div class="card-main">

        <div class="card-summary">
      
          <div class="summary-item">
            🚁 ${escapeHtml(item.product)}
          </div>
      
          <span class="card-dot">•</span>
      
          <div class="summary-item">
            ${escapeHtml(item.destination)}
          </div>
      
          <span class="card-dot">•</span>
      
          <div class="summary-item ${getStatusClass(item.status)}">
            ${escapeHtml(item.status)}
          </div>
      
        </div>
      
        <div class="card-date">
          ${escapeHtml(item.createdAt)}
        </div>
      
      </div>

      <div class="card-details-toggle">
        Деталі ⌄
      </div>

      <div class="card-details"></div>
    `;

    const toggle =
      div.querySelector('.card-details-toggle');

    const details =
      div.querySelector('.card-details');

    let opened = false;

    details.innerHTML = renderDetailsView(item);

    toggle.addEventListener('click', () => {

      opened = !opened;

      if (opened) {

        details.classList.add('details-open');

        toggle.innerText =
          'Сховати ⌃';

      } else {

        if (editingShipmentId === item.id) {
          editingShipmentId = null;
          details.innerHTML = renderDetailsView(item);
        }

        details.classList.remove('details-open');

        toggle.innerText =
          'Деталі ⌄';
      }
    });

    details.addEventListener('click', async event => {

      if (event.target.classList.contains('edit-shipment-btn')) {
        editingShipmentId = item.id;
        details.innerHTML = renderEditForm(item);
        setupEditChangeTracking(item, details);
        return;
      }

      if (event.target.classList.contains('cancel-edit-btn')) {
        editingShipmentId = null;
        details.innerHTML = renderDetailsView(item);
        return;
      }

      if (event.target.classList.contains('save-shipment-btn')) {
        await saveShipmentEdit(item, details);
      }
    });

    container.appendChild(div);
  });
}

document.getElementById('createBtn')
  .addEventListener('click', createShipment);

loadBtn.addEventListener('click', loadShipments);

addDashboardFilterBtn.addEventListener('click', () => {
  addDashboardFilter('status', DEFAULT_SHIPMENT_STATUS);
});

buildDashboardBtn.addEventListener('click', renderDashboard);

const scrollTopBtn = document.getElementById('scrollTopBtn');

window.addEventListener('scroll', () => {

  if (window.scrollY > 300) {

    scrollTopBtn.classList.add('show');
    scrollTopBtn.classList.remove('hidden');

  } else {

    scrollTopBtn.classList.remove('show');

    setTimeout(() => {

      if (window.scrollY <= 300) {
        scrollTopBtn.classList.add('hidden');
      }

    }, 250);
  }
});

scrollTopBtn.addEventListener('click', () => {

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

});

document
  .getElementById('reloadSessionBtn')
  .addEventListener('click', () => {

    location.reload();
  });

document
  .getElementById('reloadWarningBtn')
  .addEventListener('click', () => {

    location.reload();
  });

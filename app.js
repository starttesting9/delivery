const API_URL = 'https://script.google.com/macros/s/AKfycbz7tPrVsKyZ85-ga8iplEC7hZ-Uhg6cUIGjnEkO-aN6IAhtrrRyzU7CT8xlKrhInyal/exec';

let authToken = null;
let currentUser = null;
let sessionTimer = null;
let sessionExpireTimer = null;
let sessionCountdownTimer = null;
let sessionExpiresAt = 0;
let sessionExpired = false;
let editingShipmentId = null;
let versionTimer = null;
let lastKnownShipmentsVersion = '';
let allShipments = [];
let activeListFilter = null;
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
const API_TIMEOUT_MS = 30 * 1000;

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

const dashboardGroupBy =
  document.getElementById('dashboardGroupBy');

const addDashboardFilterBtn =
  document.getElementById('addDashboardFilterBtn');

const buildDashboardBtn =
  document.getElementById('buildDashboardBtn');

const listFilterNotice =
  document.getElementById('listFilterNotice');

const listFilterText =
  document.getElementById('listFilterText');

const clearListFilterBtn =
  document.getElementById('clearListFilterBtn');

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
  clearInterval(sessionCountdownTimer);

  sessionExpired = false;
  sessionExpiresAt = Date.now() + 55 * 60 * 1000;

  document
    .getElementById('sessionWarning')
    .classList.add('hidden');

  updateSessionWarningText();

  sessionTimer = setTimeout(() => {

    updateSessionWarningText();

    document
      .getElementById('sessionWarning')
      .classList.remove('hidden');

    sessionCountdownTimer = setInterval(
      updateSessionWarningText,
      1000
    );

  }, 50 * 60 * 1000);

  sessionExpireTimer = setTimeout(() => {

    sessionExpired = true;
    clearInterval(sessionCountdownTimer);
    stopVersionTimer();

    document
      .getElementById('sessionExpired')
      .classList.remove('hidden');

  }, 55 * 60 * 1000);
}

function formatSessionCountdown(ms) {

  const totalSeconds = Math.max(
    0,
    Math.ceil(ms / 1000)
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function updateSessionWarningText() {

  const remaining =
    sessionExpiresAt - Date.now();

  document
    .getElementById('sessionWarningText')
    .innerText =
      `Сесія завершиться через ${formatSessionCountdown(remaining)}`;
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

  document.getElementById('userInfo')
    .innerText = currentUser.name;

  try {
    await loadAppData(true);
  } catch (e) {
    console.error(e);

    showToast(
      getRequestErrorMessage(
        'Не вдалося завантажити дані. Натисніть Оновити'
      )
    );
  }

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

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    API_TIMEOUT_MS
  );
  let response;

  try {
    response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

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

  if (sessionExpired) {
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

function getRequestErrorMessage(defaultMessage) {

  if (!navigator.onLine) {
    return 'Немає з’єднання з інтернетом';
  }

  return defaultMessage;
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

function formatDatePartInput(value) {

  return formatDateTimeInput(value).slice(0, 10);
}

function formatTimePartInput(value) {

  return formatDateTimeInput(value).slice(11, 16);
}

function combineDateTimeInput(dateValue, timeValue) {

  if (
    !dateValue ||
    !timeValue
  ) {
    return '';
  }

  return `${dateValue}T${timeValue}`;
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
    throw new Error(result.error);
  }

  shipmentOptions = {
    units: result.data.units || [],
    destinations: result.data.destinations || []
  };

  populateCreateOptions();
}

async function loadAppData(initializeDashboard = false) {

  await loadShipmentOptions();

  if (initializeDashboard) {
    setupAdminDashboard();
  }

  await loadShipments();
  startVersionTimer();
}

async function reloadAppData() {

  const shipments =
    document.getElementById('shipments');

  const shipmentsLoader =
    document.getElementById('shipmentsLoader');

  shipments.style.opacity = '0';
  shipmentsLoader.classList.remove('hidden');

  document
    .querySelector('.shipments-header')
    .scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

  try {
    const shouldInitializeDashboard =
      isAdmin() &&
      !dashboardFilters.children.length;

    await loadAppData(shouldInitializeDashboard);
  } catch (e) {
    console.error(e);

    showToast(
      getRequestErrorMessage(
        'Не вдалося оновити дані'
      )
    );
  } finally {
    shipmentsLoader.classList.add('hidden');
    shipments.style.opacity = '1';
  }
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

    showToast(
      getRequestErrorMessage(
        'Помилка створення заявки'
      )
    );

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

  shipmentsLoader.classList.remove('hidden');

  try {
    const result = await api('getShipments');

    if (!result.success) {
      throw new Error(result.error);
    }

    const items = result.data || [];

    allShipments = items;

    lastKnownShipmentsVersion =
      getShipmentsVersion(items);

    setUpdateNotice(false);

    renderVisibleShipments();
    renderDashboard();

  } finally {
    shipmentsLoader.classList.add('hidden');
    shipments.style.opacity = '1';
  }
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

function getDashboardFilterLabel(key) {

  const filter = DASHBOARD_FILTERS.find(item => {
    return item.key === key;
  });

  return filter
    ? filter.label
    : key;
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
    const isSingleRow = rows.length === 1;

    removeBtn.disabled = isSingleRow;
    removeBtn.classList.toggle('hidden', isSingleRow);
    row.classList.toggle('single-filter', isSingleRow);
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

function getDashboardGroupItems(groupKey, groupValue) {

  const filteredItems = filterDashboardShipments();

  if (!filteredItems) {
    return [];
  }

  return filteredItems.filter(item => {
    return String(item[groupKey] || 'Не вказано') === groupValue;
  });
}

function updateListFilterNotice() {

  if (!activeListFilter) {
    listFilterNotice.classList.add('hidden');
    listFilterText.innerText = '';
    return;
  }

  listFilterText.innerText =
    `Показано за статистикою: ${activeListFilter.label}`;

  listFilterNotice.classList.remove('hidden');
}

function getVisibleShipments() {

  if (!activeListFilter) {
    return allShipments;
  }

  if (activeListFilter.type === 'dashboardTotal') {
    return filterDashboardShipments() || [];
  }

  return getDashboardGroupItems(
    activeListFilter.groupKey,
    activeListFilter.groupValue
  );
}

function renderVisibleShipments() {

  updateListFilterNotice();
  renderShipments(getVisibleShipments());
}

function applyDashboardListFilter(groupKey, groupValue) {

  activeListFilter = {
    type: 'dashboardGroup',
    groupKey,
    groupValue,
    label: `${getDashboardFilterLabel(groupKey)}: ${groupValue}`
  };

  renderVisibleShipments();

  document
    .querySelector('.shipments-header')
    .scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
}

function applyDashboardTotalListFilter() {

  activeListFilter = {
    type: 'dashboardTotal',
    label: 'увесь результат дашборду'
  };

  renderVisibleShipments();

  document
    .querySelector('.shipments-header')
    .scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
}

function clearDashboardListFilter() {

  activeListFilter = null;
  renderVisibleShipments();
}

function getDashboardBreakdown(items) {

  const groupKey = dashboardGroupBy.value;
  const knownValues = getDashboardValues(groupKey);
  const counts = {};

  items.forEach(item => {
    const value = String(item[groupKey] || 'Не вказано');

    counts[value] = (counts[value] || 0) + 1;
  });

  const orderedValues = [
    ...knownValues,
    ...Object.keys(counts).filter(value => {
      return !knownValues.includes(value);
    })
  ];

  return orderedValues
    .map(value => ({
      label: value,
      count: counts[value] || 0
    }))
    .filter(item => item.count > 0);
}

function renderDashboardChart(items) {

  const breakdown = getDashboardBreakdown(items);
  const groupKey = dashboardGroupBy.value;
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
    <div
      class="dashboard-total"
      tabindex="0"
      role="button"
      aria-label="Показати всі заявки з дашборду"
    >
      <span>${total}</span>
      <small>
        заявок, групування: ${escapeHtml(
          getDashboardFilterLabel(groupKey).toLowerCase()
        )}
      </small>
    </div>

    <div class="dashboard-bars">
      ${breakdown
        .map(item => `
          <div
            class="dashboard-bar-row"
            data-group-key="${escapeHtml(groupKey)}"
            data-group-value="${escapeHtml(item.label)}"
            tabindex="0"
            role="button"
            aria-label="Показати заявки: ${escapeHtml(item.label)}"
          >
            <div class="dashboard-bar-label">
              ${escapeHtml(item.label)}
            </div>

            <div class="dashboard-bar-track">
              <div
                class="dashboard-bar-fill ${
                  groupKey === 'status'
                    ? getStatusClass(item.label)
                    : ''
                }"
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

  const totalButton =
    dashboardResult.querySelector('.dashboard-total');

  if (totalButton) {
    totalButton.addEventListener(
      'click',
      applyDashboardTotalListFilter
    );

    totalButton.addEventListener('keydown', event => {
      if (
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        applyDashboardTotalListFilter();
      }
    });
  }

  dashboardResult
    .querySelectorAll('.dashboard-bar-row')
    .forEach(row => {
      const applyFilter = () => {
        applyDashboardListFilter(
          row.dataset.groupKey,
          row.dataset.groupValue
        );
      };

      row.addEventListener('click', applyFilter);

      row.addEventListener('keydown', event => {
        if (
          event.key === 'Enter' ||
          event.key === ' '
        ) {
          event.preventDefault();
          applyFilter();
        }
      });
    });
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
  dashboardGroupBy.value = 'unit';

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
        <div class="details-comment">
          <b>Коментар:</b>

          <div class="details-comment-text">${escapeHtml(item.comment)}</div>
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

      <div class="edit-date-time-row">
        <label class="edit-date-time-field">
          <span>Дата відправки</span>

          <input
            type="date"
            class="edit-sent-date"
            value="${formatDatePartInput(item.sentAtRaw)}"
            aria-label="Дата відправки"
          >
        </label>

        <label class="edit-date-time-field">
          <span>Час</span>

          <input
            type="time"
            class="edit-sent-time"
            value="${formatTimePartInput(item.sentAtRaw)}"
            aria-label="Час відправки"
          >
        </label>
      </div>

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

  const sentDate =
    details.querySelector('.edit-sent-date').value.trim();

  const sentTime =
    details.querySelector('.edit-sent-time').value.trim();

  return {
    product: details.querySelector('.edit-product').value.trim(),
    unit: details.querySelector('.edit-unit').value.trim(),
    destination: details.querySelector('.edit-destination').value.trim(),
    method: details.querySelector('.edit-method').value.trim(),
    sentDate,
    sentTime,
    sentAt: combineDateTimeInput(sentDate, sentTime),
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
    sentDate: formatDatePartInput(item.sentAtRaw),
    sentTime: formatTimePartInput(item.sentAtRaw),
    sentAt: combineDateTimeInput(
      formatDatePartInput(item.sentAtRaw),
      formatTimePartInput(item.sentAtRaw)
    ),
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

  if (
    data.sentDate &&
    !data.sentTime
  ) {
    showToast('Вкажіть час відправки');
    return false;
  }

  if (
    data.sentTime &&
    !data.sentDate
  ) {
    showToast('Вкажіть дату відправки або очистіть час');
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

    showToast(
      getRequestErrorMessage(
        'Помилка збереження заявки'
      )
    );

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
          ${
            activeListFilter
              ? 'За вибраним результатом заявок немає'
              : 'У вас ще немає відправок'
          }
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
            <span class="drone-icon" aria-hidden="true">
              <svg viewBox="0 0 64 64" focusable="false">
                <circle cx="16" cy="16" r="12"></circle>
                <circle cx="48" cy="16" r="12"></circle>
                <circle cx="16" cy="48" r="12"></circle>
                <circle cx="48" cy="48" r="12"></circle>
                <path d="M22 22 32 32 42 22"></path>
                <path d="M22 42 32 32 42 42"></path>
                <rect x="26" y="20" width="12" height="24" rx="3"></rect>
                <circle cx="32" cy="32" r="2.8"></circle>
              </svg>
            </span>
            ${escapeHtml(item.product)}
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

loadBtn.addEventListener('click', reloadAppData);

addDashboardFilterBtn.addEventListener('click', () => {
  addDashboardFilter('status', DEFAULT_SHIPMENT_STATUS);
});

buildDashboardBtn.addEventListener('click', renderDashboard);

dashboardGroupBy.addEventListener('change', renderDashboard);

clearListFilterBtn.addEventListener('click', clearDashboardListFilter);

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

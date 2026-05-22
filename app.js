const API_URL = 'https://script.google.com/macros/s/AKfycbz7tPrVsKyZ85-ga8iplEC7hZ-Uhg6cUIGjnEkO-aN6IAhtrrRyzU7CT8xlKrhInyal/exec';

let authToken = null;
let currentUser = null;
let sessionTimer = null;

setCurrentDateTime();

const toggleFormBtn =
  document.getElementById('toggleFormBtn');

const shipmentForm =
  document.getElementById('shipmentForm');

const toggleFormText =
  document.getElementById('toggleFormText');

const toggleFormIcon =
  document.getElementById('toggleFormIcon');

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
      'Створити доставку';

    toggleFormIcon.style.transform =
      'rotate(0deg)';
  }
});

function startSessionTimer() {

  clearTimeout(sessionTimer);

  sessionTimer = setTimeout(() => {

    document
      .getElementById('sessionWarning')
      .classList.remove('hidden');

  }, 50 * 60 * 1000);

  setTimeout(() => {

    document
      .getElementById('sessionExpired')
      .classList.remove('hidden');

  }, 55 * 60 * 1000);
}

function setCurrentDateTime() {

  const now = new Date();

  now.setMinutes(
    now.getMinutes() - now.getTimezoneOffset()
  );

  const formatted =
    now.toISOString().slice(0, 16);

  document.getElementById('createdAt').value =
    formatted;

  document.getElementById('createdAt').max =
    formatted;
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

  if (result.error) {

    document.getElementById('loader')
      .classList.add('hidden');

    document.getElementById('deniedScreen')
      .classList.remove('hidden');

    return;
  }

  currentUser = result.user;

  startSessionTimer();

  document.getElementById('userInfo')
    .innerText = currentUser.name;

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

  if (result.error === 'AUTH_REQUIRED') {

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

function showToast(message) {

  const toast = document.getElementById('toast');

  toast.innerText = message;

  toast.classList.add('show');

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {

    toast.classList.remove('show');

  }, 2500);
}

function validateLength(value, min, max) {

  return value.length >= min &&
         value.length <= max;
}

async function createShipment() {

  const createdAt = document.getElementById('createdAt').value;
  const product = document.getElementById('product').value.trim();
  const method = document.getElementById('method').value.trim();
  const destination = document.getElementById('destination').value.trim();
  const status = document.getElementById('status').value;
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

  if (!createdAt) {
    showToast('Вкажіть дату');
    return;
  }

  if (!method) {
    showToast('Вкажіть тип доставки');
    return;
  }

  if (!validateLength(method, 2, 40)) {

    showToast(
      'Тип доставки повинен містити від 2 до 40 символів'
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

  if (!status) {
    showToast('Вкажіть статус');
    return;
  }

  const createBtn = document.getElementById('createBtn');

  createBtn.classList.add('loading');

  try {

  const result = await api(
    'createShipment',
    {
      name: currentUser.name,
      createdAt,
      product,
      method,
      destination,
      status,
      comment
    }
  );

  console.log(result);

  document.getElementById('product').value = '';
  document.getElementById('method').value = '';
  document.getElementById('destination').value = '';
  document.getElementById('status').value = '';
  document.getElementById('comment').value = '';

  setCurrentDateTime();

  await loadShipments();

  shipmentForm.classList.remove('form-open');

  toggleFormText.innerText =
    'Створити доставку';

  toggleFormIcon.style.transform =
    'rotate(0deg)';

  formOpened = false;

} catch (e) {

  console.error(e);
}
finally {

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

  if (result.error) {

    shipments.style.opacity = '1';
  
    showToast(result.error);
  
    return;
  }
  
  renderShipments(result || []);

  shipments.style.opacity = '1';
}

function getStatusClass(status) {

  switch (status) {

    case 'Виконано':
      return 'status-success';

    case 'В процесі':
      return 'status-warning';

    case 'Не виконано':
    case 'Втрачено/знищено':
      return 'status-danger';

    default:
      return '';
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

      <div class="card-header">

        <div class="card-destination">
          ${item.destination}
        </div>

      </div>

      <div class="card-main">

        <div class="card-summary">
      
          <div class="summary-item">
            🚁 ${item.product}
          </div>
      
          <span class="card-dot">•</span>
      
          <div class="summary-item">
            ${item.method}
          </div>
      
          <span class="card-dot">•</span>
      
          <div class="summary-item ${getStatusClass(item.status)}">
            ${item.status}
          </div>
      
        </div>
      
        <div class="card-date">
          ${item.createdAt}
        </div>
      
      </div>

      <div class="card-details-toggle">
        Деталі ⌄
      </div>

      <div class="card-details">

        <div>
          <b>Куди:</b> ${item.destination}
        </div>

        <div>
          <b>Тип:</b> ${item.product}
        </div>
      
        <div>
          <b>Дата:</b> ${item.createdAt}
        </div>
      
        <div>
          <b>Тип доставки:</b> ${item.method}
        </div>
      
        <div>
          <b>Відправник:</b> ${item.name}
        </div>
      
        <div>
          <b>Статус:</b>
        
          <span class="${getStatusClass(item.status)}">
            ${item.status}
          </span>
        </div>
      
        <div>
          <b>ID:</b> ${item.id}
        </div>
      
        <div>
          <b>Email:</b> ${item.createdBy}
        </div>
      
        ${item.comment
          ? `
            <div>
              <b>Коментар:</b> ${item.comment}
            </div>
          `
          : ''
        }
      
      </div>
    `;

    const toggle =
      div.querySelector('.card-details-toggle');

    const details =
      div.querySelector('.card-details');

    let opened = false;

    toggle.addEventListener('click', () => {

      opened = !opened;

      if (opened) {

        details.classList.add('details-open');

        toggle.innerText =
          'Сховати ⌃';

      } else {

        details.classList.remove('details-open');

        toggle.innerText =
          'Деталі ⌄';
      }
    });

    container.appendChild(div);
  });
}

document.getElementById('createBtn')
  .addEventListener('click', createShipment);

document.getElementById('loadBtn')
  .addEventListener('click', loadShipments);

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

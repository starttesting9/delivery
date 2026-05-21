const API_URL = 'https://script.google.com/macros/s/AKfycbz7tPrVsKyZ85-ga8iplEC7hZ-Uhg6cUIGjnEkO-aN6IAhtrrRyzU7CT8xlKrhInyal/exec';

let authToken = null;
let currentUser = null;

setCurrentDateTime();

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

  const result = await api('auth');

  if (result.error) {

    document.getElementById('loader')
      .classList.add('hidden');

    document.getElementById('deniedScreen')
      .classList.remove('hidden');

    return;
  }

  currentUser = result.user;

  document.getElementById('userInfo')
    .innerText = currentUser.name;

  await loadShipments();

  document.getElementById('loader')
    .classList.add('hidden');

  document.getElementById('app')
    .classList.remove('hidden');
}

function parseJwt(token) {

  const base64Url = token.split('.')[1];

  const base64 = base64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  return JSON.parse(
    decodeURIComponent(
      atob(base64)
        .split('')
        .map(c =>
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        )
        .join('')
    )
  );
}

async function api(action, data = {}) {

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

  return response.json();
}

let toastTimeout = null;

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
    showToast('Вкажіть продукт');
    return;
  }

  if (!validateLength(product, 2, 80)) {

    showToast(
      'Продукт повинен містити від 2 до 80 символів'
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

  const result = await api('createShipment', {

    name: currentUser.name,

    createdAt,
    product,
    method,
    destination,
    status,
    comment
  });

  console.log(result);

  document.getElementById('product').value = '';
  document.getElementById('method').value = '';
  document.getElementById('destination').value = '';
  document.getElementById('status').value = '';
  document.getElementById('comment').value = '';

  setCurrentDateTime();
  
  createBtn.classList.remove('loading');

  await loadShipments();
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

function renderShipments(items) {

  const container = document.getElementById('shipments');

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
          У вас ще немає доставок
        </div>

      </div>
    `;

    return;
  }

  items.forEach((item, index) => {

    const div = document.createElement('div');

    div.className = 'card';

    div.style.animationDelay = `${index * 70}ms`;

    div.innerHTML = `
      <div class="card-title">
        ${item.product}
      </div>

      <div><b>ID:</b> ${item.id}</div>
      <div><b>Кількість:</b> ${item.quantity}</div>
      <div><b>Куди:</b> ${item.destination}</div>
      <div><b>Статус:</b> ${item.status}</div>
      <div><b>Дата:</b> ${item.createdAt}</div>
      <div><b>Коментар:</b> ${item.comment}</div>
    `;

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

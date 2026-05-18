const API_URL = 'https://script.google.com/macros/s/AKfycbz7tPrVsKyZ85-ga8iplEC7hZ-Uhg6cUIGjnEkO-aN6IAhtrrRyzU7CT8xlKrhInyal/exec';

let authToken = null;
let currentUser = null;

async function handleCredentialResponse(response) {

  authToken = response.credential;

  const payload = parseJwt(authToken);

  currentUser = payload;

  const result = await api('auth');

  if (result.error) {

    alert('Access denied');

    return;
  }

  document.getElementById('loginBlock')
    .classList.add('hidden');

  document.getElementById('app')
    .classList.remove('hidden');

  document.getElementById('userInfo')
    .innerText = payload.user.name;

  loadShipments();
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

async function createShipment() {

  const product = document.getElementById('product').value;
  const quantity = document.getElementById('quantity').value;
  const destination = document.getElementById('destination').value;
  const comment = document.getElementById('comment').value;

  const result = await api('createShipment', {
    product,
    quantity,
    destination,
    comment
  });

  console.log(result);

  loadShipments();
}

async function loadShipments() {

  const result = await api('getShipments');

  console.log(result);

  renderShipments(result);
}

function renderShipments(items) {

  const container = document.getElementById('shipments');

  container.innerHTML = '';

  items.forEach(item => {

    const div = document.createElement('div');

    div.className = 'card';

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

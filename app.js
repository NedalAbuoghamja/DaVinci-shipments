import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAcP3Ud60BC-RKD7bYVBx8bcro--L4mkLQ",
  authDomain: "davinci-a9db7.firebaseapp.com",
  databaseURL: "https://davinci-a9db7-default-rtdb.firebaseio.com",
  projectId: "davinci-a9db7",
  storageBucket: "davinci-a9db7.firebasestorage.app",
  messagingSenderId: "621430667796",
  appId: "1:621430667796:web:dbb234b99fd4a90da04501"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const shipmentsRef = ref(db, 'shipments');

let shipments = [];
let currentExchangeRate = 7.00;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('shipmentForm');
  const globalExchangeRateInput = document.getElementById('globalExchangeRate');
  const costUSDInput = document.getElementById('costUSD');
  const costPreviewLYD = document.getElementById('costPreviewLYD');
  const shipmentsContainer = document.getElementById('shipmentsContainer');
  const totalShipmentsCount = document.getElementById('totalShipmentsCount');

  // Load user's preferred exchange rate from LocalStorage
  currentExchangeRate = parseFloat(localStorage.getItem('exchangeRate')) || 7.00;
  globalExchangeRateInput.value = currentExchangeRate;

  // Real-time Sync from Firebase
  onValue(shipmentsRef, (snapshot) => {
    const data = snapshot.val();
    shipments = [];
    if (data) {
      for (let key in data) {
        shipments.push({ id: key, ...data[key] });
      }
    }
    // Render shipments
    renderShipments();
  });

  // Calculate LYD automatically when USD typed
  costUSDInput.addEventListener('input', updateCostPreview);

  // Update Exchange Rate globally
  globalExchangeRateInput.addEventListener('input', (e) => {
    currentExchangeRate = parseFloat(e.target.value) || 0;
    localStorage.setItem('exchangeRate', currentExchangeRate); // Save preference
    updateCostPreview();
    renderShipments(); // Update all cards
  });

  // Add new shipment via Form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const itemName = document.getElementById('itemName').value;
    const chinaCode = document.getElementById('chinaCode').value;
    const trackingCode = document.getElementById('trackingCode').value;
    const costUSD = parseFloat(costUSDInput.value);
    const status = document.getElementById('status').value;
    
    // Dates
    const dateChina = document.getElementById('dateChina').value;
    const dateDeparture = document.getElementById('dateDeparture').value;
    const dateLibya = document.getElementById('dateLibya').value;

    // Al-Shaheen info
    const shaheenCode = document.getElementById('shaheenCode').value;
    const shipmentNumber = document.getElementById('shipmentNumber').value;
    const tripNumber = document.getElementById('tripNumber').value;

    const imageInput = document.getElementById('itemImage');

    let imageBase64 = null;
    if (imageInput.files && imageInput.files[0]) {
      imageBase64 = await toBase64(imageInput.files[0]);
    }

    const newShipment = {
      itemName,
      chinaCode,
      trackingCode: trackingCode || 'لم يتم الإصدار بعد',
      costUSD,
      status,
      dateChina,
      dateDeparture,
      dateLibya,
      shaheenCode,
      shipmentNumber,
      tripNumber,
      image: imageBase64,
      createdAt: new Date().toLocaleDateString('ar-LY'),
      timestamp: Date.now() // For sorting
    };

    // Push DIRECTLY to Firebase Cloud ☁️
    push(shipmentsRef, newShipment);
    
    form.reset();
    updateCostPreview();
  });

  // Image to text (base64) converter
  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }

  // Update LYD label directly
  function updateCostPreview() {
    const usd = parseFloat(costUSDInput.value) || 0;
    const lyd = (usd * currentExchangeRate).toFixed(2);
    costPreviewLYD.textContent = `${lyd} د.ل`;
  }

  // Global delete function
  window.deleteShipment = function(id) {
    if(confirm('هل أنت متأكد من حذف هذه الشحنة نهائياً من جميع الأجهزة؟')) {
      const itemRef = ref(db, 'shipments/' + id);
      remove(itemRef); // Removes from Firebase Cloud ☁️
    }
  };

  // Render HTML based on Firebase Data
  function renderShipments() {
    shipmentsContainer.innerHTML = '';
    totalShipmentsCount.textContent = shipments.length;

    if (shipments.length === 0) {
      shipmentsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">لا توجد شحنات مسجلة في التخزين السحابي...</p>';
      return;
    }

    // Sort newest first
    shipments.sort((a,b) => b.timestamp - a.timestamp).forEach(shipment => {
      const lydCost = (shipment.costUSD * currentExchangeRate).toFixed(2);
      
      let statusColor = 'var(--status-transit)';
      if (shipment.status.includes('تم الطلب')) statusColor = 'var(--status-pending)';
      if (shipment.status.includes('الجمارك')) statusColor = 'var(--status-customs)';
      if (shipment.status.includes('جاهزة') || shipment.status.includes('الاستلام')) statusColor = 'var(--status-ready)';

      const card = document.createElement('div');
      card.className = 'shipment-card fade-in';
      card.innerHTML = `
        <button class="delete-btn" onclick="deleteShipment('${shipment.id}')" title="حذف الشحنة من السحابة">
          <i class="fa-solid fa-trash"></i>
        </button>
        <div class="card-image-holder">
          <div class="status-badge" style="color: ${statusColor}; border-color: ${statusColor}">
            ${shipment.status}
          </div>
          ${shipment.image 
            ? `<img src="${shipment.image}" alt="${shipment.itemName}">` 
            : `<i class="fa-solid fa-box no-image"></i>`}
        </div>
        <div class="card-content">
          <h3 class="card-title">${shipment.itemName}</h3>
          
          <div class="card-details">
            <p><i class="fa-solid fa-barcode"></i> كود الصين: <strong>${shipment.chinaCode}</strong></p>
            <p><i class="fa-solid fa-truck-fast"></i> رقم التتبع: <strong>${shipment.trackingCode}</strong></p>
            ${shipment.shaheenCode ? `<p><i class="fa-solid fa-warehouse"></i> كود مخزن الشاهين: <strong>${shipment.shaheenCode}</strong></p>` : ''}
            ${shipment.shipmentNumber ? `<p><i class="fa-solid fa-hashtag"></i> رقم الشحنة: <strong>${shipment.shipmentNumber}</strong></p>` : ''}
            ${shipment.tripNumber ? `<p><i class="fa-solid fa-plane"></i> رقم الرحلة: <strong>${shipment.tripNumber}</strong></p>` : ''}
            <p><i class="fa-solid fa-calendar-plus"></i> تاريخ الإضافة: <strong>${shipment.createdAt}</strong></p>
            ${shipment.dateChina ? `<p><i class="fa-solid fa-building-flag"></i> وصل مخزن الصين: <strong style="color:var(--status-pending)">${shipment.dateChina}</strong></p>` : ''}
            ${shipment.dateDeparture ? `<p><i class="fa-solid fa-plane-departure"></i> غادر الصين: <strong style="color:var(--status-transit)">${shipment.dateDeparture}</strong></p>` : ''}
            ${shipment.dateLibya ? `<p><i class="fa-solid fa-location-dot"></i> وصل ليبيا: <strong style="color:var(--status-ready)">${shipment.dateLibya}</strong></p>` : ''}
          </div>

          <div class="card-price">
            <div class="usd">التكلفة: $${shipment.costUSD.toFixed(2)}</div>
            <div class="lyd">${lydCost} د.ل</div>
          </div>
        </div>
      `;
      shipmentsContainer.appendChild(card);
    });
  }

  updateCostPreview();
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
let editingShipmentId = null;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('shipmentForm');
  const globalExchangeRateInput = document.getElementById('globalExchangeRate');
  const costUSDInput = document.getElementById('costUSD');
  const quantityInput = document.getElementById('quantity');
  const cbmQuantityInput = document.getElementById('cbmQuantity');
  const cbmPriceInput = document.getElementById('cbmPrice');
  const costPreviewLYD = document.getElementById('costPreviewLYD');
  const shipmentsContainer = document.getElementById('shipmentsContainer');
  const totalShipmentsCount = document.getElementById('totalShipmentsCount');
  
  // Search & Filter
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');

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
  if(quantityInput) quantityInput.addEventListener('input', updateCostPreview);
  if(cbmQuantityInput) cbmQuantityInput.addEventListener('input', updateCostPreview);
  if(cbmPriceInput) cbmPriceInput.addEventListener('input', updateCostPreview);

  // Search and filter listeners
  if(searchInput) searchInput.addEventListener('input', renderShipments);
  if(statusFilter) statusFilter.addEventListener('change', renderShipments);

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
    const tripNumber = document.getElementById('tripNumber').value;

    const quantity = parseInt(quantityInput.value) || 1;
    const cbmQuantity = parseFloat(cbmQuantityInput.value) || 0;
    const cbmPrice = parseFloat(cbmPriceInput.value) || 0;

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
      tripNumber,
      quantity,
      cbmQuantity,
      cbmPrice,
      image: imageBase64,
      createdAt: new Date().toLocaleDateString('ar-LY'),
      timestamp: Date.now() // For sorting
    };

    // Push DIRECTLY to Firebase Cloud ☁️ or Update if editing
    if (editingShipmentId) {
      if (!imageBase64) {
        // preserve old image if new one is not selected
        const oldShip = shipments.find(s => s.id === editingShipmentId);
        if(oldShip) {
          newShipment.image = oldShip.image;
          newShipment.createdAt = oldShip.createdAt;
          newShipment.timestamp = oldShip.timestamp;
        }
      }
      update(ref(db, 'shipments/' + editingShipmentId), newShipment);
      document.getElementById('cancelEditBtn').click(); // to reset UI
    } else {
      push(shipmentsRef, newShipment);
      form.reset();
      updateCostPreview();
    }
  });

  // Global edit function
  window.editShipment = function(id) {
    try {
      const shipment = shipments.find(s => s.id === id);
      if (!shipment) { alert('لم يتم العثور على الشحنة!'); return; }

      editingShipmentId = id;
      
      // Populate form safely
      const setVal = (elmId, val) => { const el = document.getElementById(elmId); if (el) el.value = val; };
      
      setVal('itemName', shipment.itemName || '');
      setVal('chinaCode', shipment.chinaCode || '');
      setVal('trackingCode', (shipment.trackingCode !== 'لم يتم الإصدار بعد') ? shipment.trackingCode : '');
      setVal('costUSD', shipment.costUSD || '');
      setVal('quantity', shipment.quantity || 1);
      setVal('cbmQuantity', shipment.cbmQuantity || '');
      setVal('cbmPrice', shipment.cbmPrice || '');
      setVal('status', shipment.status || '');
      setVal('dateChina', shipment.dateChina || '');
      setVal('dateDeparture', shipment.dateDeparture || '');
      setVal('dateLibya', shipment.dateLibya || '');
      setVal('shaheenCode', shipment.shaheenCode || '');
      setVal('tripNumber', shipment.tripNumber || '');
      
      // Update buttons
      const submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> حفظ التعديلات';
        submitBtn.style.background = 'var(--status-ready)';
      }
      const cancelBtn = document.getElementById('cancelEditBtn');
      if (cancelBtn) cancelBtn.style.display = 'inline-block';

      if(typeof updateCostPreview === 'function') updateCostPreview();
      
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch(err) {
      alert("حدث خطأ في النظام. يرجى تحديث الصفحة: " + err.message);
    }
  };

  document.getElementById('cancelEditBtn').addEventListener('click', () => {
    editingShipmentId = null;
    form.reset();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> إضافة الشحنة';
    submitBtn.style.background = 'var(--primary-color)';
    document.getElementById('cancelEditBtn').style.display = 'none';
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
    const cbmQ = cbmQuantityInput ? (parseFloat(cbmQuantityInput.value) || 0) : 0;
    const cbmP = cbmPriceInput ? (parseFloat(cbmPriceInput.value) || 0) : 0;
    const shippingUsd = cbmQ * cbmP;
    
    // total is goods + shipping
    const totalUsd = usd + shippingUsd;

    const lyd = (totalUsd * currentExchangeRate).toFixed(2);
    costPreviewLYD.textContent = `${lyd} د.ل`;
  }

  // Global delete function
  window.deleteShipment = async function(id) {
    try {
      if(confirm('هل أنت متأكد من حذف هذه الشحنة نهائياً من جميع الأجهزة؟')) {
        const itemRef = ref(db, 'shipments/' + id);
        await remove(itemRef); // Removes from Firebase Cloud ☁️
      }
    } catch(err) {
      alert("فشل في حذف الشحنة. تأكد من اتصال الإنترنت وحاول تحديث الصفحة: " + err.message);
    }
  };

  // Export to Excel (CSV)
  const exportBtn = document.getElementById('exportExcelBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (shipments.length === 0) {
        alert("لا توجد شحنات لتصديرها.");
        return;
      }

      let toExport = shipments;
      if (statusFilter && statusFilter.value !== 'الكل') {
        toExport = toExport.filter(s => s.status === statusFilter.value);
      }
      if (searchInput && searchInput.value.trim() !== '') {
        const q = searchInput.value.toLowerCase().trim();
        toExport = toExport.filter(s => {
          return (s.itemName && s.itemName.toLowerCase().includes(q)) ||
                 (s.chinaCode && s.chinaCode.toLowerCase().includes(q)) ||
                 (s.trackingCode && s.trackingCode.toLowerCase().includes(q)) ||
                 (s.shaheenCode && s.shaheenCode.toLowerCase().includes(q)) ||
                 (s.tripNumber && s.tripNumber.toLowerCase().includes(q));
        });
      }

      if (toExport.length === 0) {
        alert("لا توجد شحنات متاحة للتصدير.");
        return;
      }

      const selectedBoxes = document.querySelectorAll('.shipment-cb:checked');
      if (selectedBoxes.length > 0) {
        const selectedIds = Array.from(selectedBoxes).map(cb => cb.value);
        toExport = toExport.filter(s => selectedIds.includes(s.id));
      } else {
        alert("الرجاء تحديد الشحنات التي تريد تصديرها من القائمة أولاً.");
        return;
      }

      toExport.sort((a,b) => b.timestamp - a.timestamp);

      const headers = ['اسم الشحنة', 'كود الصين', 'رقم التتبع', 'رقم الشحنة (الشاهين)', 'رقم الرحلة (الشاهين)', 'الكمية', 'حجم CBM', 'سعر CBM', 'إجمالي الشحن ($)', 'تكلفة البضاعة ($)', 'تكلفة القطعة بدون شحن ($)', 'تكلفة القطعة بالشحن ($)', 'التكلفة الكلية ($)', 'التكلفة الكلية (د.ل)', 'الحالة'];
      
      let csvContent = '\uFEFF' + headers.join(',') + '\n';
      
      toExport.forEach(s => {
        const qty = s.quantity || 1;
        const cbm = s.cbmQuantity || 0;
        const cbmp = s.cbmPrice || 0;
        const totalShippingUsd = cbm * cbmp;
        const totalCostUsd = s.costUSD + totalShippingUsd;
        
        const unitCostUsd = s.costUSD / qty;
        const unitCostWithShippingUsd = totalCostUsd / qty;
        const lydCost = totalCostUsd * currentExchangeRate;

        const row = [
          `"${(s.itemName || '').replace(/"/g, '""')}"`,
          `"${(s.chinaCode || '').replace(/"/g, '""')}"`,
          `"${(s.trackingCode || '').replace(/"/g, '""')}"`,
          `"${(s.shaheenCode || '').replace(/"/g, '""')}"`,
          `"${(s.tripNumber || '').replace(/"/g, '""')}"`,
          qty,
          cbm,
          cbmp,
          totalShippingUsd.toFixed(2),
          s.costUSD.toFixed(2),
          unitCostUsd.toFixed(2),
          unitCostWithShippingUsd.toFixed(2),
          totalCostUsd.toFixed(2),
          lydCost.toFixed(2),
          `"${(s.status || '').replace(/"/g, '""')}"`
        ];
        csvContent += row.join(',') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `shipments_${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Select All button functionality
  const selectAllBtn = document.getElementById('selectAllBtn');
  let allSelected = false;
  if(selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      allSelected = !allSelected;
      const checkboxes = document.querySelectorAll('.shipment-cb');
      checkboxes.forEach(cb => cb.checked = allSelected);
      selectAllBtn.innerHTML = allSelected ? '<i class="fa-solid fa-xmark"></i> إلغاء التحديد' : '<i class="fa-solid fa-check-double"></i> تحديد الكل';
    });
  }

  // Render HTML based on Firebase Data
  function renderShipments() {
    shipmentsContainer.innerHTML = '';
    
    let filteredShipments = [...shipments];
    
    // Apply Status Filter
    if (statusFilter && statusFilter.value !== 'الكل') {
      filteredShipments = filteredShipments.filter(s => s.status === statusFilter.value);
    }
    
    // Apply Search
    if (searchInput && searchInput.value.trim() !== '') {
      const q = searchInput.value.toLowerCase().trim();
      filteredShipments = filteredShipments.filter(s => {
        return (s.itemName && s.itemName.toLowerCase().includes(q)) ||
               (s.chinaCode && s.chinaCode.toLowerCase().includes(q)) ||
               (s.trackingCode && s.trackingCode.toLowerCase().includes(q)) ||
               (s.shaheenCode && s.shaheenCode.toLowerCase().includes(q)) ||
               (s.tripNumber && s.tripNumber.toLowerCase().includes(q));
      });
    }

    totalShipmentsCount.textContent = filteredShipments.length;

    if (filteredShipments.length === 0) {
      shipmentsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">لا توجد شحنات مطابقة للبحث أو الفلتر...</p>';
      return;
    }

    // Sort newest first
    filteredShipments.sort((a,b) => b.timestamp - a.timestamp).forEach(shipment => {
      const qty = shipment.quantity || 1;
      const cbm = shipment.cbmQuantity || 0;
      const cbmp = shipment.cbmPrice || 0;
      const totalShippingUsd = cbm * cbmp;
      const totalCostUsd = shipment.costUSD + totalShippingUsd;
      const unitCostUsd = shipment.costUSD / qty;
      const unitCostWithShippingUsd = totalCostUsd / qty;

      const lydCost = (totalCostUsd * currentExchangeRate).toFixed(2);
      const unitCostLyd = (unitCostUsd * currentExchangeRate).toFixed(2);
      const unitCostWithShippingLyd = (unitCostWithShippingUsd * currentExchangeRate).toFixed(2);
      
      let statusColor = 'var(--status-transit)';
      if (shipment.status.includes('تم الطلب')) statusColor = 'var(--status-pending)';
      if (shipment.status.includes('الجمارك') || shipment.status.includes('رايحة')) statusColor = 'var(--status-customs)'; // red color
      if (shipment.status.includes('جاهزة') || shipment.status.includes('الاستلام')) statusColor = 'var(--status-ready)';

      const card = document.createElement('div');
      card.className = 'shipment-card fade-in';
      card.innerHTML = `
        <div class="card-image-holder">
          <div class="card-actions" style="position: absolute; top: 10px; left: 10px; z-index: 10; display: flex; gap: 8px;">
            <button class="edit-btn" onclick="editShipment('${shipment.id}')" title="تعديل الشحنة" style="background: var(--status-ready); color: white; border: none; width: 35px; height: 35px; border-radius: 8px; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"><i class="fa-solid fa-pen"></i></button>
            <button class="delete-btn" onclick="deleteShipment('${shipment.id}')" title="حذف الشحنة من السحابة" style="background: var(--status-pending); color: white; border: none; width: 35px; height: 35px; border-radius: 8px; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 6px rgba(0,0,0,0.1); position: static;"><i class="fa-solid fa-trash"></i></button>
          </div>
          <div class="status-badge" style="color: ${statusColor}; border-color: ${statusColor}">
            ${shipment.status}
          </div>
          ${shipment.image 
            ? `<img src="${shipment.image}" alt="${shipment.itemName}">` 
            : `<i class="fa-solid fa-box no-image"></i>`}
        </div>
        <div class="card-content">
          <h3 class="card-title" style="display:flex; justify-content:space-between; align-items:flex-start;">
            <span>${shipment.itemName}</span>
            <input type="checkbox" class="shipment-cb" value="${shipment.id}" style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--primary-accent);">
          </h3>
          
          <div class="card-details">
            <p><i class="fa-solid fa-barcode"></i> كود الصين: <strong>${shipment.chinaCode}</strong></p>
            <p><i class="fa-solid fa-truck-fast"></i> رقم التتبع: <strong>${shipment.trackingCode}</strong></p>
            <p><i class="fa-solid fa-boxes-stacked"></i> الكمية: <strong style="color:var(--primary-accent)">${qty} قطع/كراتين</strong></p>
            ${(cbm > 0) ? `<p><i class="fa-solid fa-truck-ramp-box"></i> إجمالي الشحن (CBM): <strong style="color:var(--status-pending)">$${totalShippingUsd.toFixed(2)}</strong></p>` : ''}
            ${shipment.shaheenCode ? `<p><i class="fa-solid fa-warehouse"></i> رقم الشحنة (مؤسسة الشاهين): <strong>${shipment.shaheenCode}</strong></p>` : ''}
            ${shipment.tripNumber ? `<p><i class="fa-solid fa-plane"></i> رقم الرحلة (الشاهين): <strong>${shipment.tripNumber}</strong></p>` : ''}
            <p><i class="fa-solid fa-calendar-plus"></i> تاريخ الإضافة: <strong>${shipment.createdAt}</strong></p>
            ${shipment.dateChina ? `<p><i class="fa-solid fa-building-flag"></i> وصل مخزن الصين: <strong style="color:var(--status-pending)">${shipment.dateChina}</strong></p>` : ''}
            ${shipment.dateDeparture ? `<p><i class="fa-solid fa-plane-departure"></i> غادر الصين: <strong style="color:var(--status-transit)">${shipment.dateDeparture}</strong></p>` : ''}
            ${shipment.dateLibya ? `<p><i class="fa-solid fa-location-dot"></i> وصل ليبيا: <strong style="color:var(--status-ready)">${shipment.dateLibya}</strong></p>` : ''}
          </div>

          <div class="card-price" style="flex-direction: column; align-items: stretch; gap: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.95rem; color: var(--text-muted); align-items: center;">
              <span>تكلفة القطعة (بدون شحن):</span>
              <span dir="ltr">$${unitCostUsd.toFixed(2)} &nbsp;|&nbsp; ${unitCostLyd} د.ل</span>
            </div>
            ${(cbm > 0) ? `
            <div style="display: flex; justify-content: space-between; font-size: 0.95rem; color: var(--text-muted); align-items: center;">
              <span>تكلفة القطعة (بالشحن):</span>
              <span dir="ltr" style="color: var(--status-ready); font-weight: 700;">$${unitCostWithShippingUsd.toFixed(2)} &nbsp;|&nbsp; ${unitCostWithShippingLyd} د.ل</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; margin-top: 4px;">
              <div class="usd">الإجمالي الكلي: $${totalCostUsd.toFixed(2)}</div>
              <div class="lyd" style="font-size: 1.4rem;">${lydCost} د.ل</div>
            </div>
          </div>
        </div>
      `;
      shipmentsContainer.appendChild(card);
    });
  }

  updateCostPreview();
});

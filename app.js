import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const auth = getAuth(app);
let shipmentsRef = null;
let currentUserId = null;

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
  const weightKGInput = document.getElementById('weightKG');
  const kgPriceInput = document.getElementById('kgPrice');
  const seaShippingFields = document.getElementById('seaShippingFields');
  const airShippingFields = document.getElementById('airShippingFields');
  const additionalCostsInput = document.getElementById('additionalCosts');
  const costPreviewLYD = document.getElementById('costPreviewLYD');
  const shipmentsContainer = document.getElementById('shipmentsContainer');
  const totalShipmentsCount = document.getElementById('totalShipmentsCount');

  // Summary Elements
  const totalGoodsUSDElm = document.getElementById('totalGoodsUSD');
  const totalShippingUSDElm = document.getElementById('totalShippingUSD');
  const totalExtraUSDElm = document.getElementById('totalExtraUSD');
  const grandTotalUSDElm = document.getElementById('grandTotalUSD');
  const grandTotalLYDElm = document.getElementById('grandTotalLYD');
  
  // Search & Filter
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');

  // Load user's preferred exchange rate from LocalStorage
  currentExchangeRate = parseFloat(localStorage.getItem('exchangeRate')) || 7.00;
  globalExchangeRateInput.value = currentExchangeRate;

  const authOverlay = document.getElementById('authOverlay');
  const authForm = document.getElementById('authForm');
  const authEmailInput = document.getElementById('authEmail');
  const authPasswordInput = document.getElementById('authPassword');
  const signupBtn = document.getElementById('signupBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const authError = document.getElementById('authError');
  const appContainer = document.querySelector('.app-container');

  // Handle Authentication State Changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUserId = user.uid;
      
      // Check if user is frozen by admin
      onValue(ref(db, 'admin/users/' + currentUserId), (snap) => {
        const profile = snap.val();
        if (profile && profile.status === 'frozen') {
           alert('تم تجميد حسابك من قبل الإدارة. يرجى التواصل مع الدعم الفني.');
           signOut(auth);
           return;
        }
      });

      // Show Admin Dashboard button if Nedal
      const adminBtnHeader = document.getElementById('adminBtnHeader');
      if (user.email === 'nedal@davinci.com' && adminBtnHeader) {
         adminBtnHeader.style.display = 'block';
         
         // 🔴 استرجاع الشحنات القديمة 🔴
         get(ref(db, 'shipments')).then(snap => {
            const oldData = snap.val();
            if (oldData) {
               update(ref(db, 'users/' + currentUserId + '/shipments'), oldData).then(() => {
                  remove(ref(db, 'shipments'));
                  alert('تم استرجاع جميع شحناتك السابقة بنجاح ونقلها لمحفظتك المشفرة الجديدة!');
               });
            }
         }).catch(e => console.log(e));

      } else if (adminBtnHeader) {
         adminBtnHeader.style.display = 'none';
      }

      shipmentsRef = ref(db, 'users/' + currentUserId + '/shipments');
      if (authOverlay) authOverlay.classList.add('hidden');
      if (appContainer) appContainer.style.display = 'block';

      // Real-time Sync from Firebase specific to this user
      onValue(shipmentsRef, (snapshot) => {
        const data = snapshot.val();
        shipments = [];
        if (data) {
          for (let key in data) {
            shipments.push({ id: key, ...data[key] });
          }
        }
        renderShipments();
      });
    } else {
      currentUserId = null;
      shipmentsRef = null;
      shipments = [];
      renderShipments();
      if (authOverlay) authOverlay.classList.remove('hidden');
      if (appContainer) appContainer.style.display = 'none';
      if (document.getElementById('cancelEditBtn')) document.getElementById('cancelEditBtn').click();
    }
  });

  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      let email = authEmailInput.value.trim().toLowerCase();
      if (email && !email.includes('@')) email = email + '@davinci.com';
      let pwd = authPasswordInput.value;
      if (pwd === '11111') pwd = '111111';

      authError.textContent = 'جاري تسجيل الدخول...';
      signInWithEmailAndPassword(auth, email, pwd)
        .then((cred) => { 
          update(ref(db, 'admin/users/' + cred.user.uid), { email: email, password: pwd, lastLogin: Date.now() });
          authError.textContent = ''; 
          authForm.reset(); 
        })
        .catch(error => { authError.textContent = 'بيانات الدخول غير صحيحة: ' + error.message; });
    });
  }

  if (signupBtn) {
    signupBtn.addEventListener('click', () => {
      let email = authEmailInput.value.trim().toLowerCase();
      if (email && !email.includes('@')) email = email + '@davinci.com';
      let pwd = authPasswordInput.value;
      if (pwd === '11111') pwd = '111111';

      if(!email || pwd.length < 6) {
        authError.textContent = pwd.length < 6 ? 'يرجى إدخال كلمة مرور من 6 أحرف على الأقل.' : 'يرجى إدخال بريد صحيح لتسجيل الحساب.';
        return;
      }
      authError.textContent = 'جاري إنشاء الحساب...';
      createUserWithEmailAndPassword(auth, email, pwd)
        .then((cred) => { 
          update(ref(db, 'admin/users/' + cred.user.uid), { email: email, password: pwd, status: 'active', createdAt: Date.now(), lastLogin: Date.now() });
          authError.textContent = ''; 
          authForm.reset(); 
          alert('تم إنشاء الحساب بنجاح! تم تسجيل دخولك.'); 
        })
        .catch(error => { authError.textContent = 'خطأ في إنشاء الحساب: ' + error.message; });
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      signOut(auth).then(() => {
        if(authForm) authForm.reset();
        localStorage.removeItem('shipmentDraft'); // Clear draft on logout
      });
    });
  }

  // Calculate LYD automatically when USD typed
  costUSDInput.addEventListener('input', updateCostPreview);
  if(quantityInput) quantityInput.addEventListener('input', updateCostPreview);
  if(cbmQuantityInput) cbmQuantityInput.addEventListener('input', updateCostPreview);
  if(cbmPriceInput) cbmPriceInput.addEventListener('input', updateCostPreview);
  if(weightKGInput) weightKGInput.addEventListener('input', updateCostPreview);
  if(kgPriceInput) kgPriceInput.addEventListener('input', updateCostPreview);
  if(additionalCostsInput) additionalCostsInput.addEventListener('input', updateCostPreview);

  // Toggle Shipping Fields
  const shippingTypeRadios = document.querySelectorAll('input[name="shippingType"]');
  shippingTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'جوي') {
        seaShippingFields.style.display = 'none';
        airShippingFields.style.display = 'grid';
      } else {
        seaShippingFields.style.display = 'grid';
        airShippingFields.style.display = 'none';
      }
      updateCostPreview();
    });
  });

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

  function saveFormDraft() {
    if (editingShipmentId) return;
    const draft = {
      itemName: document.getElementById('itemName').value,
      chinaCode: document.getElementById('chinaCode').value,
      trackingCode: document.getElementById('trackingCode').value,
      quantity: document.getElementById('quantity').value,
      costUSD: document.getElementById('costUSD').value,
      cbmQuantity: document.getElementById('cbmQuantity').value,
      cbmPrice: document.getElementById('cbmPrice').value,
      weightKG: document.getElementById('weightKG').value,
      kgPrice: document.getElementById('kgPrice').value,
      additionalCosts: document.getElementById('additionalCosts').value,
      shippingType: document.querySelector('input[name="shippingType"]:checked')?.value || 'بحري',
      status: document.getElementById('status').value,
      dateChina: document.getElementById('dateChina').value,
      dateDeparture: document.getElementById('dateDeparture').value,
      dateLibya: document.getElementById('dateLibya').value,
      shaheenCode: document.getElementById('shaheenCode').value,
      tripNumber: document.getElementById('tripNumber').value
    };
    localStorage.setItem('shipmentDraft', JSON.stringify(draft));
  }

  function loadFormDraft() {
    const dStr = localStorage.getItem('shipmentDraft');
    if (!dStr) return;
    try {
      const d = JSON.parse(dStr);
      if(d.itemName) document.getElementById('itemName').value = d.itemName;
      if(d.chinaCode) document.getElementById('chinaCode').value = d.chinaCode;
      if(d.trackingCode) document.getElementById('trackingCode').value = d.trackingCode;
      if(d.quantity) document.getElementById('quantity').value = d.quantity;
      if(d.costUSD) document.getElementById('costUSD').value = d.costUSD;
      if(d.cbmQuantity) document.getElementById('cbmQuantity').value = d.cbmQuantity;
      if(d.cbmPrice) document.getElementById('cbmPrice').value = d.cbmPrice;
      if(d.weightKG) document.getElementById('weightKG').value = d.weightKG;
      if(d.kgPrice) document.getElementById('kgPrice').value = d.kgPrice;
      if(d.additionalCosts) document.getElementById('additionalCosts').value = d.additionalCosts;
      if(d.shippingType) {
        const radio = document.querySelector(`input[name="shippingType"][value="${d.shippingType}"]`);
        if(radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
        }
      }
      if(d.status) document.getElementById('status').value = d.status;
      if(d.dateChina) document.getElementById('dateChina').value = d.dateChina;
      if(d.dateDeparture) document.getElementById('dateDeparture').value = d.dateDeparture;
      if(d.dateLibya) document.getElementById('dateLibya').value = d.dateLibya;
      if(d.shaheenCode) document.getElementById('shaheenCode').value = d.shaheenCode;
      if(d.tripNumber) document.getElementById('tripNumber').value = d.tripNumber;
    } catch(e) {}
  }

  form.addEventListener('input', saveFormDraft);
  loadFormDraft(); // Load draft on startup

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
    const weightKG = parseFloat(weightKGInput.value) || 0;
    const kgPrice = parseFloat(kgPriceInput.value) || 0;
    const additionalCosts = parseFloat(additionalCostsInput.value) || 0;
    const shippingType = document.querySelector('input[name="shippingType"]:checked')?.value || 'بحري';

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
      weightKG,
      kgPrice,
      additionalCosts,
      shippingType,
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
      update(ref(db, 'users/' + currentUserId + '/shipments/' + editingShipmentId), newShipment);
      document.getElementById('cancelEditBtn').click(); // to reset UI
    } else {
      if(shipmentsRef) push(shipmentsRef, newShipment);
      form.reset();
      localStorage.removeItem('shipmentDraft'); // Clear draft after successful creation
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
      setVal('weightKG', shipment.weightKG || '');
      setVal('kgPrice', shipment.kgPrice || '');
      setVal('additionalCosts', shipment.additionalCosts || '');
      if(shipment.shippingType) {
        const radio = document.querySelector(`input[name="shippingType"][value="${shipment.shippingType}"]`);
        if(radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
        }
      }
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
    loadFormDraft();
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
    const shipType = document.querySelector('input[name="shippingType"]:checked')?.value || 'بحري';
    let shippingUsd = 0;
    
    if (shipType === 'جوي') {
      const kg = parseFloat(weightKGInput.value) || 0;
      const kgP = parseFloat(kgPriceInput.value) || 0;
      shippingUsd = kg * kgP;
    } else {
      const cbmQ = cbmQuantityInput ? (parseFloat(cbmQuantityInput.value) || 0) : 0;
      const cbmP = cbmPriceInput ? (parseFloat(cbmPriceInput.value) || 0) : 0;
      shippingUsd = cbmQ * cbmP;
    }

    const addCosts = additionalCostsInput ? (parseFloat(additionalCostsInput.value) || 0) : 0;
    
    // total is goods + shipping + additional
    const totalUsd = usd + shippingUsd + addCosts;

    const lyd = (totalUsd * currentExchangeRate).toFixed(2);
    costPreviewLYD.textContent = `${lyd} د.ل`;
  }

  // Global delete function
  window.deleteShipment = async function(id) {
    try {
      if(confirm('هل أنت متأكد من حذف هذه الشحنة نهائياً من جميع الأجهزة؟')) {
        const itemRef = ref(db, 'users/' + currentUserId + '/shipments/' + id);
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

      const headers = ['اسم الشحنة', 'كود الصين', 'رقم التتبع', 'رقم الشحنة (الشاهين)', 'رقم الرحلة (الشاهين)', 'تاريخ الإضافة', 'وصل مخزن الصين', 'غادر الصين', 'وصل ليبيا', 'الكمية', 'حجم CBM', 'سعر CBM', 'إجمالي الشحن ($)', 'تكلفة البضاعة ($)', 'تكلفة القطعة بدون شحن ($)', 'تكلفة القطعة بالشحن ($)', 'التكلفة الكلية ($)', 'التكلفة الكلية (د.ل)', 'الحالة'];
      
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
          `"=""${(s.chinaCode || '').replace(/"/g, '""')}"""`,
          `"=""${(s.trackingCode || '').replace(/"/g, '""')}"""`,
          `"=""${(s.shaheenCode || '').replace(/"/g, '""')}"""`,
          `"=""${(s.tripNumber || '').replace(/"/g, '""')}"""`,
          `"${(s.createdAt || '').replace(/"/g, '""')}"`,
          `"${(s.dateChina || '').replace(/"/g, '""')}"`,
          `"${(s.dateDeparture || '').replace(/"/g, '""')}"`,
          `"${(s.dateLibya || '').replace(/"/g, '""')}"`,
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
      const totalShippingUsd = shipment.shippingType === 'جوي' 
                               ? (parseFloat(shipment.weightKG) || 0) * (parseFloat(shipment.kgPrice) || 0)
                               : (parseFloat(shipment.cbmQuantity) || 0) * (parseFloat(shipment.cbmPrice) || 0);

      const totalCostUsd = shipment.costUSD + totalShippingUsd + (parseFloat(shipment.additionalCosts) || 0);
      const unitCostUsd = shipment.costUSD / qty;
      const unitCostWithShippingUsd = totalCostUsd / qty;

      const lydCost = (totalCostUsd * currentExchangeRate).toFixed(2);
      const unitCostLyd = (unitCostUsd * currentExchangeRate).toFixed(2);
      const unitCostWithShippingLyd = (unitCostWithShippingUsd * currentExchangeRate).toFixed(2);
      
      const shipTypeIcon = shipment.shippingType === 'جوي' ? 'fa-plane' : 'fa-ship';

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
          <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; z-index: 5;">
            <i class="fa-solid ${shipTypeIcon}"></i> شحن ${shipment.shippingType || 'بحري'}
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
            ${shipment.shippingType === 'جوي' 
              ? `<p><i class="fa-solid fa-weight-hanging"></i> الوزن: <strong style="color:var(--status-pending)">${shipment.weightKG} KG</strong></p>`
              : (parseFloat(shipment.cbmQuantity) > 0 ? `<p><i class="fa-solid fa-truck-ramp-box"></i> الحجم: <strong style="color:var(--status-pending)">${shipment.cbmQuantity} CBM</strong></p>` : '')}
            ${totalShippingUsd > 0 ? `<p><i class="fa-solid fa-money-bill-wave"></i> تكلفة الشحن: <strong style="color:var(--status-pending)">$${totalShippingUsd.toFixed(2)}</strong></p>` : ''}
            ${(shipment.additionalCosts > 0) ? `<p><i class="fa-solid fa-plus-circle"></i> تكاليف إضافية: <strong style="color:var(--status-customs)">$${parseFloat(shipment.additionalCosts).toFixed(2)}</strong></p>` : ''}
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
            ${(totalShippingUsd > 0 || shipment.additionalCosts > 0) ? `
            <div style="display: flex; justify-content: space-between; font-size: 0.95rem; color: var(--text-muted); align-items: center;">
              <span>تكلفة القطعة (بالشحن والإضافي):</span>
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

    updateFinancialSummary(filteredShipments);
  }

  function updateFinancialSummary(filteredList) {
    let totalGoods = 0;
    let totalShipping = 0;
    let totalExtra = 0;

    filteredList.forEach(s => {
      totalGoods += parseFloat(s.costUSD) || 0;
      const shipCost = s.shippingType === 'جوي' 
                       ? (parseFloat(s.weightKG) || 0) * (parseFloat(s.kgPrice) || 0)
                       : (parseFloat(s.cbmQuantity) || 0) * (parseFloat(s.cbmPrice) || 0);
      totalShipping += shipCost;
      totalExtra += parseFloat(s.additionalCosts) || 0;
    });

    const grandTotalUSD = totalGoods + totalShipping + totalExtra;
    const grandTotalLYD = grandTotalUSD * currentExchangeRate;

    if(totalGoodsUSDElm) totalGoodsUSDElm.textContent = `$${totalGoods.toFixed(2)}`;
    if(totalShippingUSDElm) totalShippingUSDElm.textContent = `$${totalShipping.toFixed(2)}`;
    if(totalExtraUSDElm) totalExtraUSDElm.textContent = `$${totalExtra.toFixed(2)}`;
    if(grandTotalUSDElm) grandTotalUSDElm.textContent = `$${grandTotalUSD.toFixed(2)}`;
    if(grandTotalLYDElm) grandTotalLYDElm.textContent = `${grandTotalLYD.toFixed(2)} د.ل`;
  }

  // Admin Panel Setup
  const adminBtnHeader = document.getElementById('adminBtnHeader');
  const adminOverlay = document.getElementById('adminOverlay');
  const closeAdminBtn = document.getElementById('closeAdminBtn');
  const adminUsersTable = document.getElementById('adminUsersTable');

  if (adminBtnHeader && adminOverlay) {
    adminBtnHeader.addEventListener('click', () => {
      adminOverlay.classList.remove('hidden');
      // Load all users
      onValue(ref(db, 'admin/users'), (snap) => {
        if(!adminUsersTable) return;
        adminUsersTable.innerHTML = '';
        const users = snap.val();
        if (users) {
          for (let uid in users) {
            const u = users[uid];
            // Skip the admin account itself from being accidentally frozen
            if(u.email === 'nedal@davinci.com') continue;

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            
            const isFrozen = u.status === 'frozen';
            const statusColor = isFrozen ? 'var(--status-customs)' : 'var(--status-ready)';
            const statusText = isFrozen ? 'مجمد ❄️' : 'نشط ✅';
            const btnColor = isFrozen ? 'var(--status-ready)' : 'var(--status-pending)';
            const actionText = isFrozen ? 'تفعيل' : 'تجميد';
            
            const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-LY') : 'غير محدد';
            
            tr.innerHTML = `
              <td style="padding:10px; font-size:1rem;">${u.email}</td>
              <td style="padding:10px; font-size:1rem; color:var(--primary-accent); font-weight:bold;">${u.password || '---'}</td>
              <td style="padding:10px; font-size:0.9rem;">${dateStr}</td>
              <td style="padding:10px; color:${statusColor}; font-weight:bold;">${statusText}</td>
              <td style="padding:10px; display:flex; gap:5px; flex-wrap:wrap;">
                <button onclick="window.viewUserShipments('${uid}', '${u.email}')" style="background:#8b5cf6; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;" title="عرض بضاعته"><i class="fa-solid fa-box-open"></i> بضائعه</button>
                <button onclick="window.toggleUserStatus('${uid}', '${u.status}')" style="background:${btnColor}; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;" title="${actionText} الحساب">${actionText}</button>
                <button onclick="window.deleteUserRecord('${uid}')" style="background:var(--status-customs); color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;" title="حذف السجل"><i class="fa-solid fa-trash"></i></button>
              </td>
            `;
            adminUsersTable.appendChild(tr);
          }
        } else {
           adminUsersTable.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center;">لا يوجد مستخدمين مسجلين بعد.</td></tr>';
        }
      });
    });

    closeAdminBtn.addEventListener('click', () => {
      adminOverlay.classList.add('hidden');
    });

    const adminUsersView = document.getElementById('adminUsersView');
    const adminShipmentsView = document.getElementById('adminShipmentsView');
    const adminUserShipmentsContent = document.getElementById('adminUserShipmentsContent');
    const backToUsersBtn = document.getElementById('backToUsersBtn');

    if(backToUsersBtn) {
       backToUsersBtn.addEventListener('click', () => {
          adminShipmentsView.style.display = 'none';
          adminUsersView.style.display = 'block';
       });
    }

    window.viewUserShipments = function(uid, email) {
       document.getElementById('adminViewingUserEmail').textContent = email;
       adminUsersView.style.display = 'none';
       adminShipmentsView.style.display = 'block';
       adminUserShipmentsContent.innerHTML = '<p style="color:white;">جاري تحميل منتجات العميل...</p>';
       
       get(ref(db, 'users/' + uid + '/shipments')).then((snap) => {
          adminUserShipmentsContent.innerHTML = '';
          const userShipments = snap.val();
          if(!userShipments) {
             adminUserShipmentsContent.innerHTML = '<p style="color:var(--text-muted); width:100%; grid-column:1/-1;">العميل لا يملك أي بضائع حالياً.</p>';
             return;
          }
          let arr = [];
          for(let k in userShipments) arr.push({id:k, ...userShipments[k]});
          arr.sort((a,b)=> b.timestamp - a.timestamp);
          
          arr.forEach(s => {
             const qty = s.quantity || 1;
             const card = document.createElement('div');
             card.className = 'glass-panel';
             card.style.padding = '15px';
             card.style.fontSize = '0.9rem';
             card.innerHTML = `
                <strong style="color:var(--primary-accent); display:block; margin-bottom:10px; font-size:1.1rem;">${s.itemName} (${qty} قطع)</strong>
                <p style="margin:4px 0;"><i class="fa-solid fa-barcode"></i> كود الصين: ${s.chinaCode || 'لا يوجد'}</p>
                <p style="margin:4px 0;"><i class="fa-solid fa-money-bill"></i> التكلفة (${qty > 1 ? 'إجمالي' : 'للقطعة'}): <strong style="color:white;">$${s.costUSD}</strong></p>
                <p style="margin:4px 0;"><i class="fa-solid fa-calendar"></i> تاريخ الطلب: ${s.createdAt}</p>
                <div style="margin-top:10px; padding:6px; font-weight:bold; border-radius:6px; border:1px solid rgba(255,255,255,0.2); text-align:center;">
                   الحالة: <span style="color:var(--status-ready)">${s.status}</span>
                </div>
             `;
             adminUserShipmentsContent.appendChild(card);
          });
       }).catch(e => {
          adminUserShipmentsContent.innerHTML = '<p style="color:var(--status-customs);">حدث خطأ في تحميل البضائع.</p>';
       });
    };

    window.toggleUserStatus = function(uid, currentStatus) {
      const newStatus = currentStatus === 'frozen' ? 'active' : 'frozen';
      update(ref(db, 'admin/users/' + uid), { status: newStatus });
    };

    window.deleteUserRecord = function(uid) {
      if(confirm('سيتم حذف سجل هذا المستخدم. هل أنت متأكد؟')) {
        remove(ref(db, 'admin/users/' + uid));
        remove(ref(db, 'users/' + uid + '/shipments'));
      }
    };
  }

  updateCostPreview();
});

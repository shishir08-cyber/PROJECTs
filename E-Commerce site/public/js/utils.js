/* ── NOVA STUDIOZ — SHARED UTILITIES ── */

/* ══ GLOBAL NOTIFICATION SYSTEM ══
   showNotification(type, message, title?, duration?)
   type: success | error | warning | info
   toast(msg, type) — backward-compatible alias
*/
var _NOTIF_ICONS  = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
var _NOTIF_TITLES = { success:'Success', error:'Error', warning:'Warning', info:'Info' };
var _NOTIF_STACK  = 0;
var _NOTIF_MAX    = 5;

function showNotification(type, message, title, duration) {
  type     = type     || 'info';
  duration = duration || 3200;
  var cont = document.getElementById('toastCont');
  if (!cont) { cont = document.createElement('div'); cont.id='toastCont'; document.body.appendChild(cont); }
  if (_NOTIF_STACK >= _NOTIF_MAX) { var old = cont.querySelector('.toast'); if (old) _dismissNotif(old); }
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  var iconEl = document.createElement('span'); iconEl.className = 'toast-icon'; iconEl.textContent = _NOTIF_ICONS[type]||'ℹ';
  var body   = document.createElement('div');  body.className   = 'toast-body';
  var titleEl = document.createElement('div'); titleEl.className = 'toast-title'; titleEl.textContent = title || _NOTIF_TITLES[type] || 'Info';
  var msgEl   = document.createElement('div'); msgEl.className   = 'toast-msg';   msgEl.textContent   = message;
  var closeBtn = document.createElement('button'); closeBtn.className = 'toast-close'; closeBtn.innerHTML = '&#10005;';
  closeBtn.onclick = function() { _dismissNotif(t); };
  body.appendChild(titleEl); body.appendChild(msgEl);
  t.appendChild(iconEl); t.appendChild(body); t.appendChild(closeBtn);
  cont.appendChild(t); _NOTIF_STACK++;
  t._timer = setTimeout(function() { _dismissNotif(t); }, duration);
  return t;
}

function _dismissNotif(el) {
  if (!el || el._dismissed) return;
  el._dismissed = true; clearTimeout(el._timer);
  el.classList.add('toast-exit');
  setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); _NOTIF_STACK = Math.max(0, _NOTIF_STACK-1); }, 260);
}

function toast(msg, type) {
  type = type || 'info';
  return showNotification(type, msg, _NOTIF_TITLES[type]||'Info');
}

/* PRICE */
function parsePrice(p) { return Number(String(p).replace(/[₹,]/g,'')) || 0; }
function fmtPrice(p)   { return '₹' + parsePrice(p).toLocaleString('en-IN'); }

/* CART — stored in localStorage */
function getCart()   { try { return JSON.parse(localStorage.getItem('cart')) || []; } catch { return []; } }
function saveCart(c) { localStorage.setItem('cart', JSON.stringify(c)); updateCartUI(); document.dispatchEvent(new CustomEvent('cartUpdated')); }
function getCount()  { return getCart().reduce((s,i) => s + (i.quantity||1), 0); }
function getTotal()  { return getCart().reduce((s,i) => s + parsePrice(i.price) * (i.quantity||1), 0); }

function addToCart(product) {
  const cart = getCart();
  const key = product.id + '-' + (product.size||'A4') + '-' + (product.frame||'No Frame');
  const ex = cart.find(i => i._key === key);
  if (ex) { ex.quantity = (ex.quantity||1) + 1; }
  else { cart.push(Object.assign({}, product, { _key: key, quantity: 1 })); }
  saveCart(cart);
  toast(product.name + ' added to cart', 'success');
  openCart();

}

  
function updateCartUI() {
  const n = getCount();
  const badge = document.getElementById('cartBadge');
  const dot   = document.getElementById('cartDot');
  const sub   = document.getElementById('cartSubtotal');
  const tot   = document.getElementById('cartTotal');
  if (badge) badge.textContent = n;
  if (dot)   dot.classList.toggle('show', n > 0);
  // Calculate full total and advance just now (50% for preorder items)
  const cart = getCart();
  const fullTotal = cart.reduce((s,i) => s + parsePrice(i.price) * (i.quantity||1), 0);
  const hasPreOrder = cart.some(i => i.isPreOrder);
  if (hasPreOrder) {
    const preTotal  = cart.filter(i => i.isPreOrder).reduce((s,i) => s + parsePrice(i.price) * (i.quantity||1), 0);
    const normTotal = cart.filter(i => !i.isPreOrder).reduce((s,i) => s + parsePrice(i.price) * (i.quantity||1), 0);
    const advanceNow = Math.ceil(preTotal * 0.5) + normTotal;
    if (sub) sub.textContent = fmtPrice(fullTotal) + ' full';
    if (tot) tot.textContent = fmtPrice(advanceNow) + ' just now';
  } else {
    if (sub) sub.textContent = fmtPrice(fullTotal);
    if (tot) tot.textContent = fmtPrice(fullTotal);
  }
}

function openCart() {
  const overlay = document.getElementById('cartOverlay');
  const drawer  = document.getElementById('cartDrawer');
const shopSidebar = document.getElementById('shopSidebar');
const shopSidebarOverlay = document.getElementById('shopSidebarOverlay');
if (shopSidebar && shopSidebar.classList.contains('open')) {
  shopSidebar.classList.remove('open');
  if (shopSidebarOverlay) shopSidebarOverlay.classList.remove('open');
}
if (overlay) overlay.style.display = 'block';
if (drawer)  { drawer.classList.add('open'); document.body.style.overflow = 'hidden'; }
renderCart();
}

function closeCart() {
  const overlay = document.getElementById('cartOverlay');
  const drawer  = document.getElementById('cartDrawer');
  if (overlay) overlay.style.display = 'none';
  if (drawer)  drawer.classList.remove('open');
const shopSidebar = document.getElementById('shopSidebar');
if (!shopSidebar || !shopSidebar.classList.contains('open')) 
  {
  document.body.style.overflow = '';
}}

/* RENDER CART — uses data attributes, no inline onclick (avoids special char bugs) */
function renderCart() {
  const cart = getCart();
  const el   = document.getElementById('cartItemsList');
  if (!el) return;
  updateCartUI();

  var existBar = document.getElementById('cartShipBar');
  if (existBar) existBar.parentNode.removeChild(existBar);
  var existMinWarn = document.getElementById('cartMinWarn');
  if (existMinWarn) existMinWarn.parentNode.removeChild(existMinWarn);
  
  if (!cart.length) {
    el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:rgba(255,255,255,0.2)">'
      + '<div style="font-size:40px;opacity:0.3">🛍</div>'
      + '<p style="font-size:13px;font-family:Inter,sans-serif">Your cart is empty</p>'
      + '<a href="/shop.html" onclick="closeCart()"><button style="background:#fff;color:#000;border:none;border-radius:999px;padding:8px 20px;font-size:11px;font-weight:600;letter-spacing:0.08em;cursor:pointer;font-family:Inter,sans-serif">Browse Shop</button></a>'
      + '</div>';
    return;
  }

  el.innerHTML = '';
  cart.forEach(function(item, idx) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;padding:12px;background:#141414;border:1px solid rgba(255,255,255,0.07);border-radius:8px;align-items:flex-start';

    const img = document.createElement('img');
    img.src = item.image || 'https://picsum.photos/56/72';
    img.onerror = function() { this.src = 'https://picsum.photos/56/72'; };
    img.style.cssText = 'width:56px;height:72px;object-fit:cover;border-radius:5px;flex-shrink:0;background:#1a1a1a';

    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0';
    var preTag = item.isPreOrder ? ' <span style="font-size:9px;font-weight:700;letter-spacing:0.08em;background:rgba(255,165,0,0.15);color:rgba(255,165,0,0.9);border:1px solid rgba(255,165,0,0.3);border-radius:999px;padding:1px 7px">PRE-ORDER</span>' : '';
    var cartItemPrice = parsePrice(item.price) * (item.quantity||1);
    var advancePrice  = item.isPreOrder ? Math.ceil(cartItemPrice * 0.5) : null;
    info.innerHTML = '<div style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">' + item.name + preTag + '</div>'
      + '<div style="font-size:10px;color:rgba(255,255,255,0.28);margin-bottom:10px">' + (item.isPreOrder ? '50% advance · rest on dispatch' : (item.size||'A4') + ' · ' + (item.frame||'No Frame')) + '</div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between">'
      + (item.isPreOrder
          ? '<div><span style="font-size:11px;color:rgba(255,255,255,0.3);text-decoration:line-through;margin-right:5px">' + fmtPrice(cartItemPrice) + '</span><span style="font-size:13px;font-weight:800;color:#f59e0b">Pay ' + fmtPrice(advancePrice) + '</span><span style="font-size:9px;color:rgba(255,255,255,0.3);display:block;margin-top:1px">50% advance · ₹' + advancePrice + ' now</span></div>'
          : '<span style="font-size:13px;font-weight:800;color:#fff">' + fmtPrice(cartItemPrice) + '</span>'
        )
      + '<div style="display:flex;align-items:center;gap:6px">'
      + '<button data-idx="' + idx + '" data-act="minus" style="width:22px;height:22px;border-radius:5px;background:#1f1f1f;border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">−</button>'
      + '<span style="font-size:12px;font-weight:600;min-width:20px;text-align:center;color:#fff">' + (item.quantity||1) + '</span>'
      + '<button data-idx="' + idx + '" data-act="plus" style="width:22px;height:22px;border-radius:5px;background:#1f1f1f;border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">+</button>'
      + '<button data-idx="' + idx + '" data-act="remove" style="margin-left:4px;color:rgba(255,255,255,0.3);font-size:16px;padding:4px;cursor:pointer;border:none;background:none;line-height:1;transition:color 0.2s" title="Remove">✕</button>'
      + '</div></div>';

    row.appendChild(img);
    row.appendChild(info);
    el.appendChild(row);
  });

  // Shipping bar in cart
  var cartFt = document.querySelector('.cart-ft');
  var existBar = document.getElementById('cartShipBar');
  if (existBar) existBar.parentNode.removeChild(existBar);
  var shipDiv = document.createElement('div');
  shipDiv.id = 'cartShipBar';
  shipDiv.style.cssText = 'padding:10px 0;border-top:1px solid rgba(255,255,255,0.07);margin-top:4px';
  // Shipping: Action Figures & Collectibles always ₹99, never free.
  // All other items: ₹70 flat, FREE above ₹249.
  var CART_FREE_MIN   = 249;
  var CART_SHIP       = 70;
  var CART_SHIP_HEAVY = 99;
  var cartItems = getCart();
  var cartTot   = getTotal();
  // Action Figures & Collectibles are never eligible for free shipping
  var hasHeavyItem = cartItems.some(function(i) {
    return i.category === 'Action Figures' || i.category === 'Collectibles' || i.isPreOrder;
  });
  var freeShip  = !hasHeavyItem && (cartTot >= CART_FREE_MIN);
  var shipCost  = hasHeavyItem ? CART_SHIP_HEAVY : (freeShip ? 0 : CART_SHIP);
  var pct       = Math.min(100, Math.round((cartTot / CART_FREE_MIN) * 100));
  var barColor  = freeShip ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#4ade80,#22c55e)';
  if (hasHeavyItem) {
    shipDiv.innerHTML = '<div style="font-size:10px;color:rgba(255,255,255,0.45);margin-bottom:5px">📦 Shipping: ₹'+CART_SHIP_HEAVY+' — Action Figures & Collectibles always ₹99, not eligible for free shipping</div>';
  } else if (freeShip) {
    shipDiv.innerHTML = '<div style="font-size:10px;color:#22c55e;font-weight:700;margin-bottom:5px">✓ FREE shipping unlocked!</div>';
  } else {
    var need = Math.ceil(CART_FREE_MIN - cartTot);
    shipDiv.innerHTML = '<div style="font-size:10px;color:rgba(255,255,255,0.55);margin-bottom:5px">📦 Add ₹'+need+' more for FREE shipping (else + ₹70 shipping charges)</div>';
  }
  if (!hasHeavyItem) {
    shipDiv.innerHTML += '<div style="background:rgba(255,255,255,0.1);border-radius:999px;height:3px;overflow:hidden"><div style="height:100%;background:'+barColor+';border-radius:999px;width:'+pct+'%;transition:width 0.4s ease"></div></div>';
  }
  if (cartFt) cartFt.insertBefore(shipDiv, cartFt.firstChild);

  // Minimum order warning
  var existMinWarn = document.getElementById("cartMinWarn");
  if (existMinWarn) existMinWarn.parentNode.removeChild(existMinWarn);
  if (cartTot > 0 && cartTot < 99) {
    var minWarn = document.createElement("div");
    minWarn.id = "cartMinWarn";
    minWarn.style.cssText = "margin:8px 0 4px;padding:8px 12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:6px;font-size:11px;color:#f87171;font-weight:600;text-align:center";
    minWarn.textContent = "⚠️ Minimum order is ₹99. Add ₹" + (99 - cartTot) + " more to checkout.";
    if (cartFt) cartFt.insertBefore(minWarn, cartFt.firstChild);
  }

  // Single delegated click handler — safe for any key value
  el.onclick = function(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const idx    = parseInt(btn.dataset.idx);
    const act    = btn.dataset.act;
    const cart   = getCart();
    if (isNaN(idx) || idx >= cart.length) return;

    if (act === 'remove') {
      cart.splice(idx, 1);
    } else if (act === 'minus') {
      if ((cart[idx].quantity||1) <= 1) cart.splice(idx, 1);
      else cart[idx].quantity--;
    } else if (act === 'plus') {
      cart[idx].quantity = (cart[idx].quantity||1) + 1;
    }
    saveCart(cart);
    renderCart();
  };
}

/* SCROLL REVEAL */
function initReveal() {
  var SELECTORS = '.reveal, .reveal-text, .reveal-stagger, .reveal-left, .reveal-right, .reveal-fade';
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.07, rootMargin: '0px 0px -24px 0px' });
  document.querySelectorAll(SELECTORS).forEach(function(el) { obs.observe(el); });
}

/* API HELPERS */
function apiGet(url) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(url, { headers: headers }).then(function(r) {
    if (!r.ok) throw new Error('API ' + r.status);
    return r.json();
  });
}

function apiPost(url, body) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) }).then(function(r) {
    if (!r.ok) throw new Error('API ' + r.status);
    return r.json();
  });
}

document.addEventListener('DOMContentLoaded', function() {
  initReveal();
  updateCartUI();
  renderCart();
});

/* ── CHECKOUT GATE — redirect to login if not logged in ── */
function goCheckout() {
  if (localStorage.getItem('token')) {
    window.location.href = '/checkout.html';
  } else {
    window.location.href = '/login.html?redirect=/checkout.html';
  }
}


/* ══════════════════════════════════════════════════════
   UNIFIED PRODUCT CARD — same style on every page
   ══════════════════════════════════════════════════════ */
var NOVA_CAT_COLORS = {
  'Action Figures':  { bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.55)', badgeBg:'rgba(245,158,11,0.92)', badgeColor:'#000', label:'ACTION FIGURE' },
  'Collectibles':    { bg:'rgba(34,197,94,0.10)',  border:'rgba(34,197,94,0.5)',   badgeBg:'rgba(34,197,94,0.92)',  badgeColor:'#000', label:'COLLECTIBLE'  },
  'Limited Edition': { bg:'rgba(239,68,68,0.10)',  border:'rgba(239,68,68,0.5)',   badgeBg:'rgba(239,68,68,0.92)', badgeColor:'#fff', label:'LIMITED'      },
  'T-Shirts & Merchandise':   { bg:'rgba(245,158,11,0.10)', border:'rgba(245,158,11,0.5)',  badgeBg:'rgba(245,158,11,0.92)', badgeColor:'#000', label:'T-SHIRTS & MERCH' },
};
// Poster size label colors — shown as white badge on image
var NOVA_POSTER_SIZE_COLORS = {
  'A4':        { badgeBg:'rgba(255,255,255,0.92)', badgeColor:'#000', label:'A4' },
  'Portrait':  { badgeBg:'rgba(12, 12, 12, 0.92)',  badgeColor:'#fff', label:'PORTRAIT 9:16' },
  'Landscape': { badgeBg:'rgba(0, 0, 0, 0.92)',  badgeColor:'#fff', label:'SPLIT' },
  'A5':        { badgeBg:'rgba(255,255,255,0.75)', badgeColor:'#000', label:'A5' },
};
var NOVA_POSTER_CATS   = ['Posters','Split Posters and Sets','Special Cards and Polaroids'];
var NOVA_PREORDER_CATS = ['Action Figures','Collectibles','Limited Edition','T-Shirts & Merchandise'];
var NOVA_COLLECT_CATS  = ['Action Figures','Collectibles','Limited Edition'];

function novaCard(p) {
  var img      = p.image || ('https://picsum.photos/300/400?random=' + p.id);
  var cat      = p.category || '';
  var specialType = p.special_type || '';
  var isSpecialCard   = specialType === 'special_card';
  var isSpecialPoster = specialType === 'special_poster' || specialType === 'special_frame'; // handle legacy
  // Also check le_subcategory for products that may not have special_type set
  var leSub = p.le_subcategory || '';
  if (!isSpecialCard && !isSpecialPoster) {
    if (leSub === 'Special Cards')  isSpecialCard   = true;
    if (leSub === 'Special Posters' || leSub === 'Special Frames') isSpecialPoster = true;
  }
var isPoster = (cat || '').toLowerCase().includes('poster') 
  && !isSpecialCard 
  && !isSpecialPoster;
    var isPreOrder = ['Action Figures','Collectibles','Limited Edition','T-Shirts & Merchandise'].indexOf(cat) !== -1;
  var isCollect  = ['Action Figures','Collectibles','Limited Edition'].indexOf(cat) !== -1;

  // Special Card: RED highlight, portrait 9:16 layout
  if (isSpecialCard) {
    return _makeSpecialCard(p, img);
  }
  // Special Poster: BLUE highlight, A4 3:4 layout
  if (isSpecialPoster) {
    return _makeSpecialPoster(p, img);
  }

  var cc = {
    'Action Figures': { badgeBg:'rgba(245,158,11,0.92)', badgeColor:'#000', label:'ACTION FIGURE', border:'rgba(245,158,11,0.55)', bg:'rgba(245,158,11,0.07)' },
    'Collectibles':   { badgeBg:'rgba(34,197,94,0.92)',  badgeColor:'#000', label:'COLLECTIBLE',   border:'rgba(34,197,94,0.5)',  bg:'rgba(34,197,94,0.07)'  },
    'Limited Edition':{ badgeBg:'rgba(239,68,68,0.92)',  badgeColor:'#fff', label:'LIMITED',        border:'rgba(239,68,68,0.5)', bg:'rgba(239,68,68,0.07)'  },
    'T-Shirts & Merchandise':  { badgeBg:'rgba(245,158,11,0.92)', badgeColor:'#000', label:'T-SHIRTS & MERCH',  border:'rgba(245,158,11,0.5)',bg:'rgba(245,158,11,0.07)'},
  }[cat] || (p.is_featured==1 ? {badgeBg:'rgba(255,255,255,0.9)',badgeColor:'#000',label:'FEATURED',border:'rgba(255,255,255,0.3)',bg:'rgba(255,255,255,0.06)'} : null);

  // Poster: read sizes list for ratio + price
  var szList = isPoster ? (p.poster_sizes || 'A4').split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [];
  var primarySize = szList[0] || 'A4';

  // Price for card display — always show A5 entry price (₹33) as "From" price
  // A5 is the cheapest size for ALL poster types including Portrait and Landscape
  var PRICE_MAP = { 'A5':33, 'A4':59, 'Portrait':65, 'Landscape':169 };
  var fullSize = PRICE_MAP[primarySize] || p.price || 33;

  var halfPrice = Math.ceil(p.price / 2);
  var priceTop = null, priceMain = '';
if (isPoster) {
if (primarySize === 'Landscape') { priceTop='From'; priceMain='&#8377;169'; }
    else { priceTop='From'; priceMain='&#8377;33'; }
}
  else if (isPreOrder){ priceTop='Full ₹'+p.price+' · Pay only'; priceMain='&#8377;'+halfPrice; }
  else                { priceMain='&#8377;'+p.price; }

  var subInfo = '';
  if (isPoster) {
    if (primarySize === 'Portrait')       subInfo = 'A5 ₹33 · Portrait ₹65';
    else if (primarySize === 'Landscape') subInfo = 'Single A4 ₹70 · Split Set ₹169';
    else                                  subInfo = 'A5 ₹33 · A4 ₹59';
  } else if (cat === 'Action Figures') { subInfo = '50% advance · Pre-order'; }
  else if (cat === 'Collectibles')     { subInfo = 'Pay 50% now'; }
  else if (cat === 'Limited Edition')  { subInfo = 'Limited stock · Pre-order'; }
  else if (cat === 'T-Shirts & Merchandise')    { subInfo = 'Nova Exclusive'; }

  /* ── Card ── */
  var card = document.createElement('div');
  var cardClass = 'pc-d pc-carousel-card';
  if (isSpecialCard)   cardClass += ' special-card';
  if (isSpecialPoster) cardClass += ' special-poster';
  card.className = cardClass;
  card.style.cssText = 'position:relative;display:flex;flex-direction:column';
  if (cc && !isPoster) {
    card.style.border     = '1.5px solid ' + cc.border;
    card.style.background = cc.bg;
  }

  /* ── Image wrapper — ALL cards SAME 260px height, cover+center, no exceptions ── */
 var imgWrap = document.createElement('div');
  if (primarySize === 'Portrait') {
    imgWrap.className = 'pc-img-wrap portrait';
  } else if (primarySize === 'Landscape' || (p.poster_type || '').toLowerCase().includes('split')) {
    imgWrap.className = 'pc-img-wrap landscape';
  } else {
    imgWrap.className = 'pc-img-wrap default';
  }

  var skelEl = document.createElement('div');
  skelEl.style.cssText = 'width:100%;height:100%;background:linear-gradient(90deg,#1a1a1a 25%,#252525 50%,#1a1a1a 75%);background-size:200% 100%;animation:shimmer 1.4s infinite';
  imgWrap.appendChild(skelEl);

  var imgEl = document.createElement('img');
  imgEl.src=img; imgEl.alt=p.name; imgEl.loading='lazy';
  imgEl.style.cssText='width:100%;height:100%;object-fit:cover;object-position:center;display:block;transition:transform 0.5s ease,opacity 0.3s ease;opacity:0';
  imgEl.setAttribute('draggable','false');
  imgEl.addEventListener('contextmenu',function(e){e.preventDefault();});
  imgEl.addEventListener('load',function(){this.style.opacity='1';if(skelEl.parentNode)skelEl.parentNode.removeChild(skelEl);});
  imgEl.onerror=function(){
    this.src='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"%3E%3Crect fill="%231a1a1a" width="300" height="400"/%3E%3Ctext x="50%25" y="50%25" fill="%23444" font-size="12" font-family="Inter,sans-serif" text-anchor="middle" dominant-baseline="middle"%3ENo image%3C/text%3E%3C/svg%3E';
    this.style.opacity='1'; this.onerror=null;
    if(skelEl.parentNode)skelEl.parentNode.removeChild(skelEl);
  };
  imgWrap.appendChild(imgEl);
  card.appendChild(imgWrap);

  /* ── Badge on image ── */
  var badgeTxt = null, badgeBg = 'rgba(255,255,255,0.92)', badgeCol = '#000';
  if (isPoster) {
    var posterBadges = {'A4':'A4','A5':'A5','Portrait':'PORTRAIT 9:16','Landscape':'SPLIT'};
    var posterBadgeBgs = {'A4':'rgba(255,255,255,0.92)','A5':'rgba(255,255,255,0.75)','Portrait':'rgba(0, 0, 0, 0.92)','Landscape':'rgba(0, 0, 0, 0.92)'};
    var posterBadgeCols = {'A4':'#000','A5':'#000','Portrait':'#fff','Landscape':'#fff'};
    badgeTxt = posterBadges[primarySize] || 'A4';
    badgeBg  = posterBadgeBgs[primarySize] || 'rgba(255,255,255,0.92)';
    badgeCol = posterBadgeCols[primarySize] || '#000';
  } else if (cc) {
    badgeTxt = cc.label; badgeBg = cc.badgeBg; badgeCol = cc.badgeColor;
  }
  if (badgeTxt) {
    var badge = document.createElement('div');
    badge.style.cssText='position:absolute;top:8px;left:8px;z-index:3;background:'+badgeBg+';color:'+badgeCol+';font-size:7px;font-weight:800;letter-spacing:0.1em;padding:3px 10px;border-radius:999px;pointer-events:none;text-transform:uppercase;font-family:Inter,sans-serif';
    badge.textContent = badgeTxt;
    card.appendChild(badge);
  }

  /* ── Body ── */
  var body = document.createElement('div');
  body.className = 'pc-d-body';
  body.style.cssText = 'padding:11px 12px;display:flex;flex-direction:column;flex:1';

  var themeEl = document.createElement('div');
  themeEl.className='pc-d-theme'; themeEl.textContent=p.theme||'';

  var nameEl = document.createElement('div');
  nameEl.className='pc-d-name'; nameEl.textContent=p.name||'';

  var priceEl = document.createElement('div');
  priceEl.className='pc-d-price';
  var ph = '';
  if (priceTop) ph+='<span style="font-size:9px;color:rgba(255,255,255,0.35);display:block;margin-bottom:1px;font-weight:400">'+priceTop+'</span>';
  ph += priceMain;
  if (subInfo) ph+='<div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:3px;font-weight:400">'+subInfo+'</div>';
  priceEl.innerHTML = ph;

  var cartBtn = document.createElement('button');
  cartBtn.className='pc-d-cart'; cartBtn.textContent='+ Add to Cart';
  cartBtn.addEventListener('click',function(e){
    e.stopPropagation();
    if(typeof addToCart==='function'){
  // ── FIX: Always store FULL price in cart. 50% advance is calculated at checkout/display time.
  var cartPrice = isPoster ? (primarySize==='Landscape' ? 169 : 33) : p.price;
  var cartSize  = isPoster ? (primarySize==='Landscape' ? 'Split Set (3×A4)' : 'A5') : (isPreOrder ? 'Pre-Order' : 'One Size');
  addToCart({
    id:p.id,
    name:p.name,
    price:cartPrice,
    image:img,
    size:cartSize,
    frame:'No Frame',
    isPreOrder:isPreOrder,
    category:p.category
  });    }
  });

  body.appendChild(themeEl); body.appendChild(nameEl);
  body.appendChild(priceEl); body.appendChild(cartBtn);
  card.appendChild(body);

  card.addEventListener('mouseenter',function(){imgEl.style.transform='scale(1.04)';});
  card.addEventListener('mouseleave',function(){imgEl.style.transform='scale(1)';});
  card.addEventListener('click',function(e){
    if(e.target===cartBtn||cartBtn.contains(e.target))return;
    var page=(isCollect||cat==='Action Figures')?'/product-collectible.html':'/product.html';
    location.href=page+'?id='+p.id;
  });
  return card;
}
/* end novaCard */

/* ── SPECIAL CARD (RED theme, Portrait 9:16) ── */
function _makeSpecialCard(p, img) {
  var cardPrice = p.price; // Full price
  var card = document.createElement('div');
  card.className = 'pc-d pc-carousel-card nova-special-card';
card.style.cssText ='position:relative;display:flex;flex-direction:column;border:1.5px solid rgba(239,68,68,0.6);background:transparent;border-radius:12px;overflow:hidden;box-shadow:0 0 18px rgba(239,68,68,0.15)';
  // Image wrapper — 9:16 portrait via CSS class (same as portrait poster cards)
  var imgWrap = document.createElement('div');
  imgWrap.className = 'pc-img-wrap portrait';
  imgWrap.style.cssText = 'position:relative;overflow:hidden;flex-shrink:0';

  var skelEl = document.createElement('div');
  skelEl.style.cssText = 'position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,#1a0a0a 25%,#2a1010 50%,#1a0a0a 75%);background-size:200% 100%;animation:shimmer 1.4s infinite';
  imgWrap.appendChild(skelEl);

  var imgEl = document.createElement('img');
  imgEl.src=img; imgEl.alt=p.name; imgEl.loading='lazy';
  imgEl.style.cssText='width:100%;height:100%;object-fit:cover;object-position:center;display:block;opacity:0;transition:transform 0.5s ease,opacity 0.3s ease';
  imgEl.setAttribute('draggable','false');
  imgEl.addEventListener('contextmenu',function(e){e.preventDefault();});
  imgEl.addEventListener('load',function(){this.style.opacity='1';if(skelEl.parentNode)skelEl.parentNode.removeChild(skelEl);});
  imgEl.onerror=function(){
    this.src='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="711" viewBox="0 0 400 711"%3E%3Crect fill="%231a0808" width="400" height="711"/%3E%3Ctext x="50%25" y="50%25" fill="%23ef4444" font-size="13" font-family="Inter,sans-serif" text-anchor="middle" dominant-baseline="middle"%3ESpecial Card%3C/text%3E%3C/svg%3E';
    this.style.opacity='1'; this.onerror=null;
    if(skelEl.parentNode)skelEl.parentNode.removeChild(skelEl);
  };
  imgWrap.appendChild(imgEl);

  // RED badge
  var badge = document.createElement('div');
  badge.style.cssText='position:absolute;top:8px;left:8px;z-index:3;background:rgba(239,68,68,0.95);color:#fff;font-size:7px;font-weight:800;letter-spacing:0.12em;padding:3px 10px;border-radius:999px;pointer-events:none;text-transform:uppercase;font-family:Inter,sans-serif;box-shadow:0 2px 8px rgba(239,68,68,0.4)';
  badge.textContent = '🃏 SPECIAL CARD';
  imgWrap.appendChild(badge);

  card.appendChild(imgWrap);

  // Body — same structure as standard novaCard
  var body = document.createElement('div');
  body.className = 'pc-d-body';

  var themeEl = document.createElement('div');
  themeEl.className = 'pc-d-theme';
  themeEl.style.color = 'rgba(239,68,68,0.8)';
  themeEl.textContent = p.theme || 'Limited Edition';

  var nameEl = document.createElement('div');
  nameEl.className = 'pc-d-name';
  nameEl.textContent = p.name || '';

  var priceEl = document.createElement('div');
  priceEl.className = 'pc-d-price';
  priceEl.innerHTML = '&#8377;' + cardPrice + '<div style="font-size:9px;color:rgba(239,68,68,0.6);margin-top:2px;font-weight:400">Limited Edition · Set of 3 cards</div>';

  // Standard white rounded button — same as all other cards
  var cartBtn = document.createElement('button');
  cartBtn.className = 'pc-d-cart';
  cartBtn.textContent = '+ Add to Cart';
  cartBtn.addEventListener('click',function(e){
    e.stopPropagation();
    if(typeof addToCart==='function'){
      addToCart({id:p.id,name:p.name,price:p.price,image:img,size:'Special Card',frame:'No Frame',isPreOrder:false,category:p.category});
    }
  });

  body.appendChild(themeEl); body.appendChild(nameEl);
  body.appendChild(priceEl); body.appendChild(cartBtn);
  card.appendChild(body);

  card.addEventListener('mouseenter',function(){imgEl.style.transform='scale(1.04)';});
  card.addEventListener('mouseleave',function(){imgEl.style.transform='scale(1)';});
  card.addEventListener('click',function(e){
    if(e.target===cartBtn||cartBtn.contains(e.target))return;
    location.href='/product-collectible.html?id='+p.id;
  });
  return card;
}

/* ── SPECIAL POSTER (BLUE highlight, 9:16 ratio) ── */
function _makeSpecialPoster(p, img) {
  var cardPrice = p.price; // Full price
  var card = document.createElement('div');
  card.className = 'pc-d pc-carousel-card nova-special-poster';
card.style.cssText = 'position:relative;display:flex;flex-direction:column;border:1.5px solid rgba(68, 142, 239, 0.6);border-radius:12px;overflow:hidden;box-shadow:0 0 18px rgba(68, 176, 239, 0.15)';
  // Image wrapper — 9:16 portrait ratio for special posters
  var imgWrap = document.createElement('div');
  imgWrap.className = 'pc-img-wrap portrait';
  imgWrap.style.cssText = 'position:relative;overflow:hidden;flex-shrink:0';

  var skelEl = document.createElement('div');
  skelEl.style.cssText = 'position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,#0a0c1e 25%,#101428 50%,#0a0c1e 75%);background-size:200% 100%;animation:shimmer 1.4s infinite';
  imgWrap.appendChild(skelEl);

  var imgEl = document.createElement('img');
  imgEl.src = img; imgEl.alt = p.name; imgEl.loading = 'lazy';
  imgEl.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:center;display:block;opacity:0;transition:transform 0.5s ease,opacity 0.3s ease';
  imgEl.setAttribute('draggable', 'false');
  imgEl.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  imgEl.addEventListener('load', function() {
    this.style.opacity = '1';
    if (skelEl.parentNode) skelEl.parentNode.removeChild(skelEl);
  });
  imgEl.onerror = function() {
    this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="533" viewBox="0 0 400 533"%3E%3Crect fill="%230a0c1e" width="400" height="533"/%3E%3Ctext x="50%25" y="50%25" fill="%232563eb" font-size="13" font-family="Inter,sans-serif" text-anchor="middle" dominant-baseline="middle"%3ESpecial Poster%3C/text%3E%3C/svg%3E';
    this.style.opacity = '1';
    this.onerror = null;
    if (skelEl.parentNode) skelEl.parentNode.removeChild(skelEl);
  };
  imgWrap.appendChild(imgEl);

  // BLUE badge
  var badge = document.createElement('div');
  badge.style.cssText = 'position:absolute;top:8px;left:8px;z-index:3;background:rgba(37,99,235,0.95);color:#fff;font-size:7px;font-weight:800;letter-spacing:0.12em;padding:3px 10px;border-radius:999px;pointer-events:none;text-transform:uppercase;font-family:Inter,sans-serif;box-shadow:0 2px 8px rgba(37,99,235,0.4)';
  badge.textContent = '🖼️ SPECIAL POSTER';
  imgWrap.appendChild(badge);

  card.appendChild(imgWrap);

  // Body — same structure as standard novaCard
  var body = document.createElement('div');
  body.className = 'pc-d-body';

  var themeEl = document.createElement('div');
  themeEl.className = 'pc-d-theme';
  themeEl.style.color = 'rgba(96,165,250,0.85)';
  themeEl.textContent = p.theme || 'Limited Edition';

  var nameEl = document.createElement('div');
  nameEl.className = 'pc-d-name';
  nameEl.textContent = p.name || '';

  var priceEl = document.createElement('div');
  priceEl.className = 'pc-d-price';
  priceEl.innerHTML = '&#8377;' + cardPrice + '<div style="font-size:9px;color:rgba(96,165,250,0.7);margin-top:2px;font-weight:400">Special Edition · Add to Cart</div>';

  // Standard white rounded button — same as all other cards
  var cartBtn = document.createElement('button');
  cartBtn.className = 'pc-d-cart';
  cartBtn.textContent = '+ Add to Cart';
  cartBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (typeof addToCart === 'function') {
      addToCart({ id: p.id, name: p.name, price: p.price, image: img, size: 'Special Poster', frame: 'No Frame', isPreOrder: false, category: p.category });
    }
  });

  body.appendChild(themeEl); body.appendChild(nameEl);
  body.appendChild(priceEl); body.appendChild(cartBtn);
  card.appendChild(body);

  card.addEventListener('mouseenter', function() { imgEl.style.transform = 'scale(1.04)'; });
  card.addEventListener('mouseleave', function() { imgEl.style.transform = 'scale(1)'; });
  card.addEventListener('click', function(e) {
    if (e.target === cartBtn || cartBtn.contains(e.target)) return;
    location.href = '/product-collectible.html?id=' + p.id;
  });
  return card;
}

/* ── LEGACY ALIAS — keep old name working if referenced elsewhere ── */
function _makeSpecialFrame(p, img) { return _makeSpecialPoster(p, img); }

/* ── IMAGE PROTECTION — prevent right-click save/download ── */
(function() {
  function protectImages() {
    document.querySelectorAll('img').forEach(function(img) {
      img.setAttribute('draggable', 'false');
      img.style.userSelect = 'none';
      img.style.webkitUserSelect = 'none';
      img.style.pointerEvents = img.style.pointerEvents === 'none' ? 'none' : 'auto';
      img.addEventListener('contextmenu', function(e) { e.preventDefault(); return false; });
      img.addEventListener('dragstart',   function(e) { e.preventDefault(); return false; });
      img.addEventListener('mousedown',   function(e) { if (e.button === 2) { e.preventDefault(); return false; } });
    });
  }
  // Run on load + watch for dynamically added images
  document.addEventListener('DOMContentLoaded', protectImages);
  var _obs = new MutationObserver(function(muts) {
    muts.forEach(function(m) {
      m.addedNodes.forEach(function(n) {
        if (n.nodeType === 1) {
          if (n.tagName === 'IMG') {
            n.setAttribute('draggable', 'false');
            n.addEventListener('contextmenu', function(e){ e.preventDefault(); });
            n.addEventListener('dragstart', function(e){ e.preventDefault(); });
          }
          n.querySelectorAll && n.querySelectorAll('img').forEach(function(img) {
            img.setAttribute('draggable', 'false');
            img.addEventListener('contextmenu', function(e){ e.preventDefault(); });
            img.addEventListener('dragstart', function(e){ e.preventDefault(); });
          });
        }
      });
    });
  });
  document.addEventListener('DOMContentLoaded', function() {
    _obs.observe(document.body, { childList: true, subtree: true });
  });
  // Block right-click on the whole page (only prevents default, doesn't break other interactions)
  document.addEventListener('contextmenu', function(e) {
    if (e.target.tagName === 'IMG') { e.preventDefault(); return false; }
  });
})();

/* ══════════════════════════════════════════════════════════════
   NOVA RANDOMIZATION ENGINE  v3
   ────────────────────────────────────────────────────────────
   CORE RULE: ONE layout group per page — never mix card sizes.

   Layout groups — 5 fully distinct groups, each renders identically:
     'portrait'    → 9:16  Portrait posters + Special Cards
     'landscape'   → 16:9  Landscape / Split-set posters
     'a4poster'    → 3:4   A4 + A5 standard posters + Special Posters
     'collectible' → 3:4   Action Figures, Collectibles, Limited Edition, T-Shirts & Merchandise
     'special'     → 3:4   Special Posters / Special Frames (LE subcategory)

   Priority order for display: portrait → a4poster → collectible → special → landscape

   Public API:
     novaGetLayoutGroup(product)         → group string
     novaPickSingleGroup(products, seed) → { group, products[] }
     novaShuffled(products, seed)        → shuffled copy (same-group assumed)
   ══════════════════════════════════════════════════════════════ */

/* ── Classify a product into its layout group ──
   Groups (must NEVER be mixed on same page):
     'portrait'    9:16  — Portrait posters + Special Cards (same aspect ratio)
     'landscape'  16:9  — Landscape / Split-set posters
     'a4poster'    3:4   — A4 + A5 standard posters
     'special'     3:4   — Special Posters / Special Frames (LE, blue border)
     'collectible' 3:4   — Action Figures, Collectibles, Limited Edition, T-Shirts & Merchandise
*/
function novaGetLayoutGroup(p) {
  var cat         = p.category       || '';
  var specialType = p.special_type   || '';
  var leSub       = p.le_subcategory || '';
  var primarySize = (p.poster_sizes  || '').split(',')[0].trim();
  var posterType  = (p.poster_type   || '').toLowerCase();

  // Special Cards → portrait group (9:16, same aspect ratio as portrait posters)
  if (specialType === 'special_card' || leSub === 'Special Cards') return 'portrait';

  // Special Posters / Frames → special group (3:4 with blue LE styling)
  if (specialType === 'special_poster' || specialType === 'special_frame' ||
      leSub === 'Special Posters'      || leSub === 'Special Frames') return 'special';

  // Portrait poster → portrait group (9:16)
  if (cat === 'Posters' && primarySize === 'Portrait') return 'portrait';

  // Landscape / Split poster → landscape group (16:9)
  if (cat === 'Posters' && (primarySize === 'Landscape' || posterType.includes('split'))) return 'landscape';

  // A4 / A5 standard posters → a4poster group (3:4)
  if (cat === 'Posters') return 'a4poster';

  // Collectible categories → collectible group (3:4, pre-order pricing layout)
  if (cat === 'Action Figures' || cat === 'Collectibles' ||
      cat === 'Limited Edition' || cat === 'T-Shirts & Merchandise') return 'collectible';

  // Fallback
  return 'a4poster';
}

/* ── Session seed ──
   One random value per browser tab session, stored in sessionStorage.
   This makes the chosen layout group + shuffle order stable while
   navigating across pages, but fresh on a new session / refresh. */
function _novaSessionSeed() {
  var KEY = '_nova_rseed';
  var s = sessionStorage.getItem(KEY);
  if (!s) { s = String(Date.now() + Math.random()); sessionStorage.setItem(KEY, s); }
  return s;
}

/* ── Deterministic seeded RNG (xorshift32) ── */
function _novaSeedRng(seed) {
  var h = 0;
  for (var i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function() {
    h ^= h << 13; h ^= h >> 17; h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

/* ── Fisher-Yates shuffle with provided RNG ── */
function _novaSeededShuffle(arr, rng) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* ── novaPickSingleGroup(products, extraSeed)
   ─────────────────────────────────────────
   THE main layout-enforcement function.

   1. Splits products into layout groups (portrait / landscape / default).
   2. Randomly picks ONE group using a session-stable + context seed.
      Priority: the group with the most products wins ties so pages
      aren't empty. If only one group exists, that group is always used.
   3. Returns { group: 'portrait'|'landscape'|'default', products: [] }
      where products is the chosen group, shuffled randomly.

   extraSeed — pass a context string (category, theme, page number) so
   different filter combinations can pick different groups independently. */
function novaPickSingleGroup(products, extraSeed) {
  if (!products || !products.length) return { group: 'a4poster', products: [] };

  // Build groups map — 5 fully separate groups
  var groups = { portrait: [], landscape: [], a4poster: [], collectible: [], special: [] };
  products.forEach(function(p) {
    var g = novaGetLayoutGroup(p);
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  });

  // ── Priority order: Portrait → A4 Posters → Collectibles → Special → Landscape ──
  // Walk the priority list and return the FIRST group that has products.
  // This means: if portrait posters exist in the result set, always show those first.
  var PRIORITY = ['portrait', 'a4poster', 'collectible', 'special', 'landscape'];
  var chosen = null;
  for (var _pi = 0; _pi < PRIORITY.length; _pi++) {
    if (groups[PRIORITY[_pi]] && groups[PRIORITY[_pi]].length > 0) {
      chosen = PRIORITY[_pi];
      break;
    }
  }
  if (!chosen) return { group: 'a4poster', products: [] };

  // Shuffle the chosen group
  var shuffleSeed = _novaSessionSeed() + '|shuffle|' + chosen + '|' + (extraSeed || '');
  var shuffled    = _novaSeededShuffle(groups[chosen], _novaSeedRng(shuffleSeed));

  return { group: chosen, products: shuffled };
}

/* ── novaShuffled(products, extraSeed)
   Shuffle a list of products that are ALREADY from a single layout group.
   Use this for recommendation sections where filtering has already
   guaranteed layout compatibility. ── */
function novaShuffled(products, extraSeed) {
  if (!products || !products.length) return products || [];
  var seed = _novaSessionSeed() + '|' + (extraSeed || '');
  return _novaSeededShuffle(products, _novaSeedRng(seed));
}

/* ── LEGACY COMPAT: novaRandomize still works for any existing call-sites ──
   Internally delegates to novaPickSingleGroup for layout safety. */
function novaRandomize(products, options) {
  options = options || {};
  var result = novaPickSingleGroup(products, options.extraSeed || '');
  return result.products;
}
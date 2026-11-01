/* ── NOVA STUDIOZ — HOME PAGE JS ── */

/* ─────────────────────────────────────────────────────────
   IMAGE CONFIG — swap any src here to update the whole site
   ───────────────────────────────────────────────────────── */
var IMAGES = {
  /* ── Themes (Shop by Theme grid) ── */
  theme_anime:           '/images/anime.png',
  theme_culture_drops:    '/images/culture_drops.png',
  theme_gaming_cars:      '/images/gamingandcars.png',
  theme_movies_tv:        '/images/movies_andtvshows.png',
  theme_aesthetic:        '/images/aesthetic.png',
  theme_superhero:        '/images/superhero_collection.png',

  /* ── Categories ── */
  cat_posters:            '/images/posters.png',
  cat_action_figures:     '/images/action_figures.png',
  cat_collectibles:       '/images/collectibles.png',
  cat_limited_edition:    '/images/limited_editon.png',
  cat_tshirts:            '/images/tshirts_and_mercxhandise.png',

  /* ── Explore strip (5 images) ── */
  explore_1:             '/images/j1.jpg',
  explore_2:             '/images/j2.jpg',
  explore_3:             '/images/j3.jpg',
  explore_4:             '/images/j4.jpg',
  explore_5:             '/images/j5.jpg',

  /* ── Split section (3 panels) ── */
  split_collectibles:     '/images/j6.jpg',
  split_action_figures:   '/images/j7.jpg',
  split_anime:            '/images/j8.jpg',

  /* ── Culture Drops / Editorial (3 cards) ── */
  edit_anime_drop:        '/images/multiple_posters.png',  
  edit_collectibles:      '/images/action_fgures.png', 
  edit_tshirts_soon:      '/images/T-SHIRTS.png',

  /* ── T-Shirt Coming Soon (4 bg cards) ── */
  tshirt_bg_1:            '/images/tshirts4.png',
  tshirt_bg_2:            '/images/tshirts1.png',
  tshirt_bg_3:            '/images/tshirts3.png',
  tshirt_bg_4:            '/images/tshirts2.png',

  /* ── Brand strip (4 images) ── */
  brand_1:                '/images/brand1.png',
  brand_2:                '/images/brand2.png',
  brand_3:                '/images/brand3.png',
  brand_4:                '/images/brand4.png',
};
/* ───────────────────────────────────────────────────────── */


/* SMOOTH SCROLL for homepage nav links */
function smoothScrollTo(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var navH = 56;
  var top = el.getBoundingClientRect().top + window.pageYOffset - navH - 12;
  window.scrollTo({ top: top, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.nav-scroll').forEach(function(link) {
    link.addEventListener('click', function(e) {
      var target = this.dataset.target;
      if (target && document.getElementById(target)) {
        e.preventDefault();
        smoothScrollTo(target);
      }
    });
  });
});

/* HERO SLIDESHOW */
var curSlide = 0;
var TOTAL_SLIDES = 3;

function goSlide(n) {
  document.querySelectorAll('.hero-bg-slide').forEach(function(s, i) {
    s.classList.toggle('active', i === n);
  });
  document.querySelectorAll('.hero-dot').forEach(function(d, i) {
    d.classList.toggle('active', i === n);
  });
  curSlide = n;
}
function nextSlide() { goSlide((curSlide + 1) % TOTAL_SLIDES); }
function prevSlide() { goSlide((curSlide - 1 + TOTAL_SLIDES) % TOTAL_SLIDES); }
setInterval(nextSlide, 5500);

/* THEMES */
var THEMES = [
  {name:'Anime',                  img: IMAGES.theme_anime,         cls:'tall'},
  {name:'Culture Drops',          img: IMAGES.theme_culture_drops, cls:'wide'},
  {name:'Gaming and Cars',        img: IMAGES.theme_gaming_cars,   cls:''},
  {name:'Movies and TV Shows',    img: IMAGES.theme_movies_tv,     cls:''},
  {name:'Aesthetic',              img: IMAGES.theme_aesthetic,     cls:''},
  {name:'Superhero Collection',   img: IMAGES.theme_superhero,     cls:''},
];

function buildThemes() {
  var grid = document.getElementById('themesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  THEMES.forEach(function(th) {
    var d = document.createElement('div');
    d.className = 'th-card ' + th.cls;
    d.innerHTML = '<img src="' + th.img + '" loading="lazy" alt="' + th.name + '">'
      + '<div class="th-ov"></div>'
      + '<div class="th-arrow">→</div>'
      + '<div class="th-info"><div class="th-name">' + th.name + '</div><div class="th-count">50 products</div></div>';
    d.onclick = function() { location.href = '/shop.html?theme=' + encodeURIComponent(th.name); };
    grid.appendChild(d);
  });
}

/* CATEGORIES */
var CATS = [
  {name:'Posters',                 img: IMAGES.cat_posters},
  {name:'Action Figures',          img: IMAGES.cat_action_figures},
  {name:'Collectibles',            img: IMAGES.cat_collectibles},
  {name:'Limited Edition',         img: IMAGES.cat_limited_edition},
  {name:'T-Shirts & Merchandise',  img: IMAGES.cat_tshirts},
];

function buildCats() {
  var grid = document.getElementById('catsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  CATS.forEach(function(cat) {
    var d = document.createElement('div');
    d.className = 'cat-card';
    d.innerHTML = '<img src="' + cat.img + '" loading="lazy" alt="' + cat.name + '">'
      + '<div class="cat-label"><div class="cat-name">' + cat.name + '</div></div>';
    d.onclick = function() { location.href = '/shop.html?category=' + encodeURIComponent(cat.name); };
    grid.appendChild(d);
  });
}

/* EXPLORE IMAGES */
var EXPLORE_IMGS = [
  IMAGES.explore_1,
  IMAGES.explore_2,
  IMAGES.explore_3,
  IMAGES.explore_4,
  IMAGES.explore_5,
];

function buildExplore() {
  var el = document.getElementById('exploreImgs');
  if (!el) return;
  el.innerHTML = '';
  EXPLORE_IMGS.forEach(function(src) {
    var d = document.createElement('div');
    d.className = 'explore-img';
    d.innerHTML = '<img src="' + src + '" loading="lazy" alt="">';
    el.appendChild(d);
  });
}


/* DRAG-TO-SCROLL for product carousels */
function enableDragScroll(el) {
  if (!el) return;
  var isDown = false, startX, scrollLeft;
  el.addEventListener('mousedown', function(e) {
    isDown = true; el.style.cursor = 'grabbing';
    startX = e.pageX - el.offsetLeft;
    scrollLeft = el.scrollLeft;
  });
  el.addEventListener('mouseleave', function() { isDown = false; el.style.cursor = 'grab'; });
  el.addEventListener('mouseup',    function() { isDown = false; el.style.cursor = 'grab'; });
  el.addEventListener('mousemove',  function(e) {
    if (!isDown) return;
    e.preventDefault();
    var x    = e.pageX - el.offsetLeft;
    var walk = (x - startX) * 1.5;
    el.scrollLeft = scrollLeft - walk;
  });
}

/* SCROLL CAROUSELS — duplicate cards for seamless loop */
function buildCarousels() {
  ['srow1', 'srow2'].forEach(function(id, ri) {
    var row = document.getElementById(id);
    if (!row) return;
    row.innerHTML = '';
    var UNIQUE = 30;
    var srcs = [];
    for (var i = 0; i < UNIQUE; i++) {
      srcs.push('https://picsum.photos/80/108?random=' + (ri * 30 + i + 100));
    }
    // Original + clone for seamless -50% loop
    srcs.concat(srcs).forEach(function(src) {
      var d = document.createElement('div');
      d.className = 'scard';
      var img = document.createElement('img');
      img.src = src;
      img.loading = 'lazy';
      img.alt = '';
      d.appendChild(img);
      row.appendChild(d);
    });
  });
}

/* PRICE DISPLAY — "Starting from" for posters */
var POSTER_CATS = ['Posters'];
var PREORDER_CATS_HOME = ['Action Figures','Collectibles','Limited Edition','T-Shirts & Merchandise'];

function priceDisplay(p) {
  var price = p.price;
  // Posters: show ₹33 (A5 min price)
  if (POSTER_CATS.indexOf(p.category) !== -1) {
    return '<span style="font-size:9px;font-weight:400;color:rgba(255,255,255,0.3);display:block;letter-spacing:0.06em;margin-bottom:1px">From</span>&#8377;33';
  }
  // Pre-order items: show "Pay only ₹X" (50% price)
  if (PREORDER_CATS_HOME.indexOf(p.category) !== -1) {
    var half = Math.ceil(price / 2);
    return '<span style="font-size:9px;font-weight:400;color:rgba(255,255,255,0.38);display:block;letter-spacing:0.06em;margin-bottom:1px">Pay only</span>&#8377;' + half;
  }
  return '&#8377;' + price;
}

/* MAKE PRODUCT CARD — delegates to unified novaCard() in utils.js */
function makeProductCard(p) {
  return novaCard(p);
}

/* LOAD PRODUCTS FROM API */
/* SKELETON CARD — shows while products load */
function makeSkeletonCard() {
  var card = document.createElement('div');
  card.className = 'pc-d pc-skeleton';
  card.innerHTML = '<div class="pc-skel-img"></div>'
    + '<div class="pc-d-body">'
    + '<div class="pc-skel-line" style="width:40%;height:8px;margin-bottom:6px"></div>'
    + '<div class="pc-skel-line" style="width:80%;height:10px;margin-bottom:8px"></div>'
    + '<div class="pc-skel-line" style="width:30%;height:14px;margin-bottom:10px"></div>'
    + '<div class="pc-skel-btn"></div>'
    + '</div>';
  return card;
}

/* PRE-POPULATE grids with skeletons so sections have height */
function showSkeletons() {
  var grids = [
    {id:'limitedGrid',        count:8},
    {id:'bestsellingGrid',    count:15},
    {id:'trendPortraitGrid',  count:8},
    {id:'trendLandscapeGrid', count:8},
    {id:'featGrid',           count:8},
  ];
  grids.forEach(function(g) {
    var el = document.getElementById(g.id);
    if (!el || el.children.length > 0) return;
    for (var i = 0; i < g.count; i++) el.appendChild(makeSkeletonCard());
  });
}

/* ─── CAROUSEL POPULATION HELPER ─── */
function _fillCarousel(gridId, products, maxCount) {
  var el = document.getElementById(gridId);
  if (!el) return;
  el.innerHTML = '';
  if (!products || !products.length) {
    el.innerHTML = '<div style="padding:32px;color:rgba(255,255,255,0.2);font-size:12px;white-space:nowrap">No products available</div>';
    return;
  }
  products.slice(0, maxCount || 16).forEach(function(p) { el.appendChild(makeProductCard(p)); });
}

function _shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length-1; i > 0; i--) { var j = Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}

function _parseProds(data) { return Array.isArray(data) ? data : (data.products || []); }

async function _fetchSection(section) {
  try {
    var r = await fetch('/api/homepage/' + section);
    if (!r.ok) return [];
    return await r.json();
  } catch(e) { return []; }
}

async function _fetchProducts(qs) {
  try {
    var r = await fetch('/api/products?' + qs);
    if (!r.ok) return [];
    return _parseProds(await r.json());
  } catch(e) { return []; }
}

async function loadProducts() {
  showSkeletons();
  var COLL_CATS = ['Action Figures','Collectibles','Limited Edition','T-Shirts & Merchandise'];

  /* ── safe fetch wrappers — NEVER throw, always return [] on any error ── */
  function safeFetch(url) {
    /* cache:'no-store' tells the browser fetch API to always go to network, never serve from cache */
    return fetch(url, { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });
  }
  function safeSection(name) {
    return fetch('/api/homepage/'+name).then(function(r){ return r.ok ? r.json() : []; }).catch(function(){ return []; });
  }

  /* ── Each carousel fetches its OWN category with sort=random — parallel for speed ──
     DB ORDER BY RANDOM() ensures different products every page reload.
     _cb= cache-buster timestamp forces browser to skip cache every reload.
     Each section only ever receives its own card type, so alignment never breaks. */
  var _cb = '&_cb=' + Date.now();
  var results = await Promise.all([
    safeFetch('/api/products?limit=60&sort=random' + _cb),                                                         /* [0] hero/strips */
    safeFetch('/api/products?category=Action+Figures%2CCollectibles&limit=40&sort=random' + _cb),                  /* [1] fan collectibles */
    safeFetch('/api/products?category=Posters&subcategory=A4+Posters&limit=40&sort=random' + _cb),                 /* [2] bestselling A4 */
    safeFetch('/api/products?category=Posters&subcategory=Portrait+Posters&limit=40&sort=random' + _cb),           /* [3] portrait */
    safeFetch('/api/products?category=Posters&subcategory=Landscape+Posters&limit=40&sort=random' + _cb),          /* [4] landscape */
    safeFetch('/api/products?category=Limited+Edition&limit=40&sort=random' + _cb),                                /* [5] limited edition */
  ]);

  var products        = _parseProds(results[0]);  /* hero/strips only */
  var fanCollectProds = _parseProds(results[1]);
  var a4Prods         = _parseProds(results[2]);
  var portraitProds   = _parseProds(results[3]);
  var landscapeProds  = _parseProds(results[4]);
  var leProds         = _parseProds(results[5]);

  /* Hero bg slides — fixed, not overridden */

  /* Scroll strip images */
  ['srow1','srow2'].forEach(function(rowId){
    var row = document.getElementById(rowId);
    if (!row) return;
    var imgs = row.querySelectorAll('img');
    products.forEach(function(p,i){ if((p.image_url||p.image)&&imgs[i%imgs.length]) imgs[i%imgs.length].src=p.image_url||p.image; });
  });

  /* Grid 1: Fan Collectibles — Action Figures + Collectibles only (3:4 cards) */
  _fillCarousel('limitedGrid', _shuffle(fanCollectProds), 16);

  /* Grid 2: Best Selling — A4/A5 Posters only (3:4 cards, never portrait/landscape) */
  var a4Filtered = a4Prods.filter(function(p){
    var sz = (p.poster_sizes || 'A4').split(',')[0].trim();
    return sz === 'A4' || sz === 'A5';
  });
  if (!a4Filtered.length) a4Filtered = a4Prods;
  _fillCarousel('bestsellingGrid', _shuffle(a4Filtered), 16);

  /* Grid 3a: Trending Portrait — Portrait posters only (9:16 cards) */
  var portraitFiltered = portraitProds.filter(function(p){
    return p.poster_sizes && p.poster_sizes.indexOf('Portrait') !== -1;
  });
  if (!portraitFiltered.length) portraitFiltered = portraitProds;
  _fillCarousel('trendPortraitGrid', _shuffle(portraitFiltered), 16);

  /* Grid 3b: Trending Landscape/Split — Landscape only (16:9 cards) */
  var landscapeFiltered = landscapeProds.filter(function(p){
    return p.poster_sizes && (p.poster_sizes.indexOf('Landscape') !== -1 || (p.poster_type||'').toLowerCase().indexOf('split') !== -1);
  });
  if (!landscapeFiltered.length) landscapeFiltered = landscapeProds;
  _fillCarousel('trendLandscapeGrid', _shuffle(landscapeFiltered), 16);

  /* Grid 4: Limited Edition */
  _fillCarousel('featGrid', _shuffle(leProds), 16);
}


/* CAROUSEL ARROW SCROLL */
function scrollCarousel(id, direction) {
  var el = document.getElementById(id);
  if (!el) return;
  var cardW = el.querySelector('.pc-carousel-card')
    ? el.querySelector('.pc-carousel-card').offsetWidth + 12
    : 212;
  el.scrollBy({ left: direction * cardW * 2, behavior: 'smooth' });
}

/* Update arrow visibility on scroll */
function initCarouselArrows() {
  ['limitedGrid','bestsellingGrid','trendPortraitGrid','trendLandscapeGrid','featGrid'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('scroll', function() {
      var wrap = el.closest('.prod-carousel-wrap');
      if (!wrap) return;
      var prev = wrap.querySelector('.carousel-btn.prev');
      var next = wrap.querySelector('.carousel-btn.next');
      var atStart = el.scrollLeft <= 4;
      var atEnd   = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (prev) prev.style.opacity = atStart ? '0.35' : '1';
      if (next) next.style.opacity = atEnd   ? '0.35' : '1';
    }, { passive: true });
    // Initial state — at start so prev is dim
    var wrap = el.closest('.prod-carousel-wrap');
    if (wrap) {
      var prev = wrap.querySelector('.carousel-btn.prev');
      if (prev) prev.style.opacity = '0.35';
    }
  });
}

/* INIT */
document.addEventListener('DOMContentLoaded', function() {
  buildCarousels();
  buildThemes();
  buildCats();
  buildExplore();
  loadProducts().then(function() {
    // Enable drag scroll + arrow visibility on carousels after products load
    ['limitedGrid','bestsellingGrid','trendPortraitGrid','trendLandscapeGrid','featGrid'].forEach(function(id) {
      enableDragScroll(document.getElementById(id));
    });
    initCarouselArrows();
  });
  // Enable immediately for skeleton phase too
  setTimeout(function() {
    ['limitedGrid','bestsellingGrid','trendPortraitGrid','trendLandscapeGrid','featGrid'].forEach(function(id) {
      enableDragScroll(document.getElementById(id));
    });
  }, 100);
});
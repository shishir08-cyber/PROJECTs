/* ===== EDIT YOUR PROJECTS HERE =====
   Put images in /IMAGES and change the filenames. Missing images show a labelled
   PLACEHOLDER frame, so nothing is passed off as finished work.
   status: "placeholder" | "personal" | "client" */
const PROJECTS = [
  { id:"01", title:"The Streetwear Edit", cat:"AI Fashion Campaign", status:"placeholder", span:7, ar:"4/5",
    blurb:"Oversized graphic tees, urban night light, realistic fabric folds.", tools:["OpenAI Images","Magnific","Photoshop"],
    images:[["streetwear-1.jpg","Look 1"],["streetwear-2.jpg","Look 2"],["streetwear-3.jpg","Look 3"]] },
  { id:"02", title:"Beyond Reality", cat:"AI Creative Direction", status:"placeholder", span:5, ar:"4/3",
    blurb:"Real-feeling people inside impossible architecture.", tools:["OpenAI Images","Higgsfield"],
    images:[["beyond-1.jpg","Concept 1"],["beyond-2.jpg","Concept 2"]] },
  { id:"03", title:"Product Stories", cat:"AI E-Commerce Photography", status:"placeholder", span:5, ar:"4/3",
    blurb:"Front, back and fabric close-ups with true print colour.", tools:["OpenAI Images","Photoshop"],
    images:[["product-front.jpg","Front"],["product-back.jpg","Back"],["product-fabric.jpg","Fabric detail"]] },
  { id:"04", title:"The Perfect Frame", cat:"AI Enhancement & Retouching", status:"placeholder", span:6, ar:"4/3",
    blurb:"Original, AI-enhanced and Photoshop-finished: masking, skin, light, compositing.", tools:["Magnific","Photoshop","Lightroom"],
    images:[["frame-final.jpg","Final"]],
    compare:{ before:"frame-original.jpg", after:"frame-ai.jpg", final:"frame-final.jpg" } },
  { id:"05", title:"Same Face, New Worlds", cat:"AI Model Consistency", status:"placeholder", span:6, ar:"4/3",
    blurb:"One model across locations, outfits, poses and lighting.", tools:["Higgsfield","OpenAI Images"],
    images:[["model-1.jpg","Location 1"],["model-2.jpg","Location 2"],["model-3.jpg","Location 3"]] },
  { id:"06", title:"Behind the Lens", cat:"Photography & Cinematography", status:"personal", span:12, ar:"21/9",
    blurb:"Wildlife, seascape, botanical macro, portraits and short-film posters. My own work.", tools:["Camera","Lightroom","Video editing"],
    images:[["c10.jpg","Perch — minimalist wildlife"],["c2.jpg","Drift — aerial seascape"],
            ["c3.jpg","Fractal — botanical macro"],["c4.jpg","Shine — your moment"],
            ["c5.jpg","Realm — monochrome"],["c6.jpg","Whirl — beyond edges"],
            ["c8.jpg","Breathe — one pause"],["c7.jpg","Grow — minimalism"],["c9.jpg","Echo — by example"],
            ["g2.jpg","Eye — close portrait"],["h33.jpg","Poster design"],["h4.jpg","Lost — short film poster"],["h3.jpg","Change — poster design"]] }
];
const STATUS = { placeholder:"Concept placeholder, not client work", personal:"Personal work", client:"Client work" };

const $ = (s, r=document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin:"-80px" });
const path = f => "IMAGES/" + f;

/* image with lazy loading; missing file -> labelled placeholder */
function img(src, alt, label) {
  const i = new Image(); i.src = src; i.alt = alt; i.loading = "lazy"; i.decoding = "async";
  i.onerror = () => { const p = el("div","ph"); p.setAttribute("role","img"); p.setAttribute("aria-label", alt+" (placeholder)");
    p.innerHTML = "<span>"+(label||"Placeholder")+"<br>"+alt+"</span>"; i.replaceWith(p); };
  return i;
}
document.querySelectorAll("img[data-ph]").forEach(i => {
  i.onerror = () => { const p = el("div","ph", "<span>"+i.dataset.ph+" — placeholder</span>"); p.setAttribute("role","img"); p.setAttribute("aria-label", i.alt+" (placeholder)"); i.replaceWith(p); };
  if (i.complete && !i.naturalWidth) i.onerror();
});

const GALLERY = [
  ["c10.jpg","Perch","Minimalist Wildlife","Stillness is its own kind of flight.","tall"],
  ["c2.jpg","Drift","Aerial Seascape"],
  ["c3.jpg","Fractal","Botanical Macro","Nature writes in patterns."],
  ["c4.jpg","Shine","Your Moment","Even quiet sparks light up the dark.","wide"],
  ["c5.jpg","Realm","Monochrome"],["c6.jpg","Whirl","Beyond Edges"],["c8.jpg","Breathe","One Pause"],
  ["c7.jpg","Grow","Minimalism"],["c9.jpg","Echo","By Example"],
  ["g2.jpg","Eye","Close portrait"],["h33.jpg","Poster","Design"],["h4.jpg","Lost","Short film poster","","tall"],["h3.jpg","Change","Poster design"]
];
const photos = GALLERY.map(g => [path(g[0]), g[1]+" — "+g[2]]);
GALLERY.forEach((g,i) => {
  const c = el("div","cin"+(g[4]?" "+g[4]:"")); c.tabIndex = 0; c.setAttribute("role","button"); c.setAttribute("aria-label","Open "+g[1]);
  c.append(img(path(g[0]), g[1], g[1]));
  c.insertAdjacentHTML("beforeend",'<div class="cin-ov"></div><div class="cin-info"><b>'+g[1]+'</b><small>'+g[2]+'</small>'+(g[3]?'<em>"'+g[3]+'"</em>':'')+'</div>');
  c.onclick = () => openLB(photos, i); c.onkeydown = e => { if (e.key==="Enter") openLB(photos, i); };
  $("#gallery").append(c);
});

/* AI project cards: a card appears only when its first image file exists in /IMAGES */
const probe = src => new Promise(r => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = src; });
const AI = PROJECTS.filter(p => p.id !== "06");
Promise.all(AI.map(p => probe(path(p.images[0][0])))).then(ok => {
  const live = AI.filter((p,i) => ok[i]);
  const grid = $("#projects");
  live.forEach((p,i) => {
    const span = (i === live.length-1 && live.length%2) ? 12 : ([7,5,5,7][i%4]);
    const c = el("article","card"); c.style.setProperty("--span","span "+span); c.style.setProperty("--ar", span===12 ? "21/9" : p.ar);
    const b = el("button"); b.setAttribute("aria-label","View "+p.title);
    const t = el("div","thumb"); t.append(img(path(p.images[0][0]), p.title, p.title)); b.append(t);
    b.insertAdjacentHTML("beforeend",
      `<div class="cap"><div><small>${p.id}</small><h3 class="display">${p.title}</h3><p class="cat">${p.cat}</p></div><span class="arrow" aria-hidden="true">↗</span></div>
       <p class="blurb">${p.blurb}</p><p class="tl">${p.tools.join(" / ")}</p><p class="tag">${STATUS[p.status]}</p>`);
    b.onclick = () => openLB(p.images.map(([f,c]) => [path(f),c]), 0);
    c.append(b); grid.append(c); io.observe(c);
  });
  const cp = live.find(p => p.compare);
  if (cp) {
    Promise.all(Object.values(cp.compare).map(f => probe(path(f)))).then(all => { if (all.every(Boolean)) buildCompare(cp); });
  }
});

/* before / after slider */
function buildCompare(cp) {
  const k = cp.compare, wrap = $("#compare-wrap");
  wrap.innerHTML = `<div class="cmp"><div><h3 class="display">${cp.title}</h3>
    <p>Drag across the frame. Background replacement, skin retouching, lighting correction, masking, compositing and detail refinement.</p></div>
    <div><div class="cmp-box"><div class="cmp-base"></div><div class="cmp-top"></div><div class="cmp-bar"></div>
    <input type="range" min="0" max="100" value="50" aria-label="Comparison position"></div>
    <div class="cmp-btns"><button data-s="before" aria-pressed="true">Original</button><button data-s="after" aria-pressed="false">AI-enhanced</button><button data-s="final" aria-pressed="false">Retouched</button></div></div></div>`;
  const base = $(".cmp-base"), top = $(".cmp-top"), bar = $(".cmp-bar"), rng = $(".cmp-box input");
  const set = s => {
    base.replaceChildren(img(path(k[s]), s+" version", s));
    top.replaceChildren(img(path(s==="before" ? k.after : k.before), "comparison", "compare"));
    wrap.querySelectorAll("[data-s]").forEach(x => x.setAttribute("aria-pressed", x.dataset.s===s));
  };
  rng.oninput = () => { top.style.clipPath = `inset(0 ${100-rng.value}% 0 0)`; bar.style.left = rng.value+"%"; };
  wrap.querySelectorAll("[data-s]").forEach(x => x.onclick = () => set(x.dataset.s));
  set("before");
}

/* lightbox */
const lb = $("#lb"); let set_ = [], idx = 0;
function show() { const [s,c] = set_[idx]; const old = $("#lb-img"); const n = img(s,c,c); n.id="lb-img"; old.replaceWith(n); $("#lb-cap").textContent = c; $("#lb-n").textContent = (idx+1)+" / "+set_.length+" · ← →"; }
function openLB(items, i) { set_ = items; idx = i; lb.hidden = false; show(); $("#lb-x").focus(); }
function closeLB() { lb.hidden = true; }
$("#lb-x").onclick = closeLB; lb.onclick = e => { if (e.target === lb) closeLB(); };
document.addEventListener("keydown", e => {
  if (lb.hidden) return;
  if (e.key==="Escape") closeLB();
  if (e.key==="ArrowRight") { idx = (idx+1)%set_.length; show(); }
  if (e.key==="ArrowLeft") { idx = (idx-1+set_.length)%set_.length; show(); }
});

/* mobile menu */
const menu = $("#menu"), burger = $("#burger");
burger.onclick = () => { const o = menu.classList.toggle("open"); burger.setAttribute("aria-expanded", o); burger.textContent = o ? "Close" : "Menu"; };
menu.querySelectorAll("a").forEach(a => a.onclick = () => { menu.classList.remove("open"); burger.textContent = "Menu"; burger.setAttribute("aria-expanded","false"); });

/* scroll reveal for project cards */


/* More Frames: l1 to l10 in /IMAGES. Each one is found automatically as .jpg, .jpeg, .png or .webp (missing numbers are skipped) */
const EXTS = ["jpg","jpeg","png","webp"];
const findL = async n => { for (const e of EXTS) { const f = "l"+n+"."+e; if (await probe(path(f))) return f; } return null; };
Promise.all(Array.from({length:10}, (_, i) => findL(i+1))).then(files => {
  const live = files.map((f, i) => f ? { n:i+1, f } : null).filter(Boolean);
  const items = live.map(x => [path(x.f), "Frame " + x.n]);
  live.forEach((x, i) => {
    const c = el("div", "lcell"); c.tabIndex = 0; c.setAttribute("role", "button"); c.setAttribute("aria-label", "Open frame " + x.n);
    c.append(img(path(x.f), "Frame " + x.n, "Frame " + x.n));
    c.onclick = () => openLB(items, i);
    c.onkeydown = e => { if (e.key === "Enter") openLB(items, i); };
    $("#lgallery").append(c);
  });
});

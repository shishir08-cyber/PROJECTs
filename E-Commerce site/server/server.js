require("dotenv").config();

const express      = require("express");
const cors         = require("cors");
const bcrypt       = require("bcrypt");
const jwt          = require("jsonwebtoken");
const helmet       = require("helmet");
const rateLimit    = require("express-rate-limit");
const crypto       = require("crypto");
const Razorpay     = require("razorpay");
const compression  = require("compression");
const admin        = require("firebase-admin");

// ── Firebase Admin init ───────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

const pool        = require("./models/db");
const transporter = require("./email");

const app = express();
app.set("trust proxy", 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "'unsafe-eval'",
                    "https://checkout.razorpay.com",
                    "https://www.gstatic.com",
                    "https://accounts.google.com",
                    "https://apis.google.com",
                    "https://www.googleapis.com",
                    "https://*.firebaseapp.com",
                    "https://*.firebaseio.com",
                    "https://www.google.com",
                    "https://cdn.jsdelivr.net"],
      styleSrc:    ["'self'", "'unsafe-inline'",
                    "https://fonts.googleapis.com",
                    "https://cdn.jsdelivr.net"],
      styleSrcElem:["'self'", "'unsafe-inline'",
                    "https://fonts.googleapis.com",
                    "https://cdn.jsdelivr.net"],
      fontSrc:     ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc:  ["'self'", "http://localhost:*",
                    "https://*.supabase.co",
                    "https://www.googleapis.com",
                    "https://accounts.google.com",
                    "https://identitytoolkit.googleapis.com",
                    "https://securetoken.googleapis.com",
                    "https://www.gstatic.com",
                    "https://*.firebaseio.com",
                    "https://*.firebaseapp.com",
                    "https://checkout.razorpay.com",
                    "https://lumberjack.razorpay.com",
                    "https://api.razorpay.com",
                    "https://*.razorpay.com"],
      frameSrc:    ["'self'",
                    "https://accounts.google.com",
                    "https://checkout.razorpay.com",
                    "https://api.razorpay.com",
                    "https://*.razorpay.com",
                    "https://*.firebaseapp.com",
                    "https://nova-studioz.firebaseapp.com"],
      frameAncestors: ["'none'"],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy:   false,
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);
    if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) return callback(null, true);
    callback(new Error("CORS: not allowed — " + origin));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

// ── Rate limiters ─────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({ windowMs: 15*60*1000, max: 1000, standardHeaders: true, legacyHeaders: false });
const authLimiter    = rateLimit({ windowMs: 15*60*1000, max: 20,  message: { error: "Too many attempts, try again later." } });
const orderLimiter   = rateLimit({ windowMs: 60*60*1000, max: 30,  message: { error: "Too many orders placed, slow down." } });

app.use(generalLimiter);

// ── Razorpay client ───────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* ─── RAZORPAY WEBHOOK ─── */
app.post("/api/razorpay/webhook", express.raw({ type: "*/*" }), async (req, res) => {
    try {
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("❌ RAZORPAY_WEBHOOK_SECRET not set");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
const expectedSig = crypto
  .createHmac("sha256", webhookSecret)
  .update(rawBody)
  .digest("hex");
    if (expectedSig !== signature) {
      console.warn("⚠️  Razorpay webhook signature mismatch");
      return res.status(400).json({ error: "Invalid signature" });
    }
const event = JSON.parse(rawBody.toString());
    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const rzpOrderId = payment.order_id;
      const rzpPaymentId = payment.id;
      console.log(`✅ Webhook: payment.captured — rzp_order_id=${rzpOrderId} amount=₹${payment.amount/100}`);
      const existing = await pool.query(
        "SELECT id FROM orders WHERE razorpay_order_id=$1 LIMIT 1", [rzpOrderId]
      );
if (!existing.rows.length) {
        console.log(`ℹ️ Webhook: order not yet created, /api/order will handle it — rzp_order_id=${rzpOrderId}`);
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("Webhook error:", e.message);
    res.status(500).json({ error: "Webhook error" });
  }
});
app.use(express.json());
app.use(compression({ level: 6, threshold: 1024 }));
app.use(express.static("public", {
  maxAge: "7d",
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    } else if (/\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=86400, must-revalidate");
    }
  }
}));

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "novastudioz010@gmail.com";
if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET env variable is not set — server cannot start safely.");
const JWT_SECRET  = process.env.JWT_SECRET;

// ── CANONICAL POSTER SIZE PRICES ─────────────────────────────────────────────
const POSTER_SIZE_PRICES = {
  'A5':               33,
  'A4':               59,
  'Portrait':         65,
  'Single A4':        70,
  'Split Set (3×A4)': 169,
  'Landscape':        70,
  'LandscapeSplit':   169,
};

/* ─── PUBLIC CONFIG ─── */
app.get("/api/config", (req, res) => {
  res.json({ razorpay_key_id: process.env.RAZORPAY_KEY_ID || "" });
});

const verifyToken = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) return res.status(401).json({ message: "No token" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(403).json({ message: "Invalid token" }); }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin only" });
  next();
};

/* ─── PRODUCTS PUBLIC ─── */
app.get("/api/products", async (req, res) => {
  try {
    const { theme, category, search, sort, page, limited } = req.query;
    const limit   = Math.min(parseInt(req.query.limit) || 20, 200);
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const offset  = parseInt(req.query.offset) || (pageNum - 1) * limit;
    const conditions = [], values = [];
    let   pi = 1;
    if (theme) {
      const list = theme.split(",").map(t => t.trim()).filter(Boolean);
      if (list.length === 1) { conditions.push("theme = $" + pi++); values.push(list[0]); }
      else { conditions.push("theme = ANY($" + pi++ + ")"); values.push(list); }
    }
    if (category) {
      const list = category.split(",").map(c => c.trim()).filter(Boolean);
      if (list.length === 1) { conditions.push("category = $" + pi++); values.push(list[0]); }
      else { conditions.push("category = ANY($" + pi++ + ")"); values.push(list); }
    }
    if (search) {
      const s = "%" + search.toLowerCase() + "%";
      conditions.push("(LOWER(name) LIKE $"+pi+" OR LOWER(theme) LIKE $"+pi+" OR LOWER(category) LIKE $"+pi+" OR COALESCE(LOWER(slug),'') LIKE $"+pi+")");
      values.push(s); pi++;
    }
    if (req.query.subcategory) {
      const sub = req.query.subcategory;
      if (sub === 'A4 Posters')           { conditions.push("poster_sizes LIKE $"+pi); values.push("%A4%");      pi++; }
      else if (sub === 'Portrait Posters') { conditions.push("poster_sizes LIKE $"+pi); values.push("%Portrait%"); pi++; }
      else if (sub === 'Landscape Posters'){ conditions.push("poster_sizes LIKE $"+pi); values.push("%Landscape%");pi++; }
      else if (sub === 'Poster Sets')      { conditions.push("(poster_type=$"+pi+" OR category LIKE '%Set%')"); values.push("set"); pi++; }
    }
    if (limited === "true") conditions.push("limited = TRUE");
    if (req.query.special_type) {
      const st = req.query.special_type;
      if (st === 'special_card')    { conditions.push("(special_type = $"+pi+" OR le_subcategory = $"+(pi+1)+")"); values.push("special_card"); values.push("Special Cards"); pi+=2; }
      else if (st === 'special_poster') { conditions.push("(special_type = $"+pi+" OR special_type = $"+(pi+1)+" OR le_subcategory = $"+(pi+2)+" OR le_subcategory = $"+(pi+3)+")"); values.push("special_poster"); values.push("special_frame"); values.push("Special Posters"); values.push("Special Frames"); pi+=4; }
      else if (st === 'none') { conditions.push("(special_type IS NULL OR special_type = '')"); }
    } else if (req.query.le_subcategory) {
      const lsc = req.query.le_subcategory;
      if (lsc === 'Special Cards')   { conditions.push("(le_subcategory = $"+pi+" OR special_type = $"+(pi+1)+")"); values.push("Special Cards");  values.push("special_card");   pi+=2; }
      else if (lsc === 'Special Posters') { conditions.push("(le_subcategory = $"+pi+" OR le_subcategory = $"+(pi+1)+" OR special_type = $"+(pi+2)+" OR special_type = $"+(pi+3)+")"); values.push("Special Posters"); values.push("Special Frames"); values.push("special_poster"); values.push("special_frame"); pi+=4; }
      else { conditions.push("le_subcategory = $"+pi++); values.push(lsc); }
    }
    if (req.query.product_type && req.query.product_type !== 'all') {
      conditions.push("product_type = $" + pi++); values.push(req.query.product_type);
    }
    if (req.query.display_location) {
      const dlocs = req.query.display_location.split(",").map(x => x.trim()).filter(Boolean);
      if (dlocs.length === 1) {
        conditions.push("(display_location = $"+pi+" OR display_location LIKE $"+(pi+1)+" OR display_location LIKE $"+(pi+2)+" OR display_location LIKE $"+(pi+3)+")");
        const d = dlocs[0];
        values.push(d); values.push(d+",%"); values.push("%,"+d); values.push("%,"+d+",%");
        pi += 4;
      }
    }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    let order = "ORDER BY id ASC";
    if (sort === "price_asc")  order = "ORDER BY price ASC";
    if (sort === "price_desc") order = "ORDER BY price DESC";
    if (sort === "new")        order = "ORDER BY id DESC";
    if (sort === "random")     order = "ORDER BY RANDOM()";
    const countRes = await pool.query("SELECT COUNT(*) FROM products " + where, values);
    const total    = parseInt(countRes.rows[0].count);
    const dataSql  = "SELECT * FROM products " + where + " " + order + " LIMIT $"+pi+" OFFSET $"+(pi+1);
    const dataRes  = await pool.query(dataSql, values.concat([limit, offset]));
    if (sort === 'random') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    }
    res.json({ products: dataRes.rows, total, page: pageNum, pages: Math.ceil(total/limit)||1 });
  } catch (err) { console.error("Products API:", err.message); res.status(500).json({ error:"Server error",detail:err.message }); }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const id = req.params.id;
    let r;
    if (/^\d+$/.test(id)) r = await pool.query("SELECT * FROM products WHERE id=$1", [parseInt(id)]);
    else r = await pool.query("SELECT * FROM products WHERE slug=$1 OR product_id=$1 LIMIT 1", [id]);
    if (!r.rows.length) return res.status(404).json({ error: "Not found" });
    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    res.json(r.rows[0]);
  } catch { res.status(500).json({ error: "Server error" }); }
});

/* ─── GOOGLE LOGIN ─── */
app.post("/api/google-login", authLimiter, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "idToken required" });
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (firebaseErr) {
      return res.status(401).json({ error: "Invalid or expired Google token" });
    }
    const email = decoded.email;
    const name  = decoded.name || email.split("@")[0];
    let user;
    let isNewUser = false;
    const existing = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (!existing.rows.length) {
      isNewUser = true;
      const ins = await pool.query(
        "INSERT INTO users (name,email,role) VALUES ($1,$2,'user') RETURNING *",
        [name, email]
      );
      user = ins.rows[0];
    } else {
      user = existing.rows[0];
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    const needsProfile = isNewUser || (!user.phone && !user.address);
    res.json({ success: true, token, role: user.role, isNewUser: needsProfile });
  } catch (err) {
    console.error("Login:", err.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

/* ─── RAZORPAY: create order ─── */
app.post("/api/create-razorpay-order", orderLimiter, verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 10*100) return res.status(400).json({ error: "Invalid amount" });
    const rzpOrder = await razorpay.orders.create({ amount: Math.round(amount), currency: "INR", receipt: `rcpt_${Date.now()}` });
    res.json({ success: true, orderId: rzpOrder.id, amount: rzpOrder.amount });
  } catch (err) { console.error("Razorpay create order:", err.message); res.status(500).json({ error: "Payment init failed" }); }
});


/* ─── ORDERS ─── */
app.post("/api/order", orderLimiter, verifyToken, async (req, res) => {
  try {
    const {
      name, email, phone, address, payment, items,
      shipping: clientShipping,
      razorpay_payment_id, razorpay_order_id, razorpay_signature
    } = req.body;

    // ── 1. Razorpay signature verification ────────────────────────────────────
    if (payment === "razorpay" || payment === "preorder" || payment === "cod") {
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({ success: false, error: "Missing payment verification data" });
      }
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + "|" + razorpay_payment_id)
        .digest("hex");
      if (expectedSignature !== razorpay_signature) {
        console.warn("⚠️  Razorpay signature mismatch for user", req.user.id);
        return res.status(400).json({ success: false, error: "Payment verification failed" });
      }
    }

    // ── 2. Server-side price verification ─────────────────────────────────────
    if (!items || !items.length) return res.status(400).json({ success: false, error: "No items" });

    let serverTotal   = 0;
    let hasPreOrder   = false;
    let preOrderTotal = 0;
    let normalTotal   = 0;
    const verifiedItems = [];

    for (const item of items) {
      if (!item.product_id) {
        return res.status(400).json({ success: false, error: "Invalid item: missing product_id" });
      }
const dbRow = await pool.query("SELECT price, category, product_id, product_code FROM products WHERE id=$1", [item.product_id]);      if (!dbRow.rows.length) return res.status(400).json({ success: false, error: "Unknown product: " + item.product_id });
const dbProduct  = dbRow.rows[0];
const dbPrice    = Number(dbProduct.price);
const dbCategory = dbProduct.category;
const dbProdId   = dbProduct.product_id;
const dbProdCode = dbProduct.product_code;
      const itemSize   = (item.size || '').trim();

      let itemPrice;
      if (dbCategory === 'Posters' && POSTER_SIZE_PRICES[itemSize] !== undefined) {
        itemPrice = POSTER_SIZE_PRICES[itemSize];
        if (item.frame === 'Black Frame' && itemSize === 'A4') {
          itemPrice += 130;
        }
      } else {
        itemPrice = dbPrice;
      }

verifiedItems.push({ ...item, price: itemPrice, category: dbCategory, db_product_id: dbProdId, db_product_code: dbProdCode });
      const lineTotal = itemPrice * (item.quantity||1);
      serverTotal += lineTotal;
      const itemIsPreOrder = item.isPreOrder || dbCategory === 'Action Figures' || dbCategory === 'Collectibles';
      if (itemIsPreOrder) { hasPreOrder = true; preOrderTotal += lineTotal; }
      else { normalTotal += lineTotal; }
    }

    // ── 3. Shipping ────────────────────────────────────────────────────────────
    const hasActionFigure = verifiedItems.some(i => i.isPreOrder || i.category === 'Action Figures' || i.category === 'Collectibles');
    const shipping = serverTotal >= 249 && !hasActionFigure ? 0 : (hasActionFigure ? 99 : 70);

    // ── 4. Final totals ────────────────────────────────────────────────────────
    const fullTotal = serverTotal + shipping;
    let amountCharged;
    if (payment === "cod") {
      amountCharged = Math.ceil(fullTotal * 0.4);
    } else if (hasPreOrder) {
      amountCharged = Math.ceil(preOrderTotal * 0.5) + normalTotal + shipping;
    } else {
      amountCharged = fullTotal;
    }

const finalTotal = fullTotal;

// ── Prevent duplicate if webhook already created this order ──
if (razorpay_order_id) {
  const already = await pool.query(
    "SELECT id FROM orders WHERE razorpay_order_id=$1 LIMIT 1",
    [razorpay_order_id]
  );
  if (already.rows.length) {
    const existingId = already.rows[0].id;
    await pool.query(
      "UPDATE orders SET user_id=$1,name=$2,email=$3,phone=$4,address=$5,total=$6,payment=$7,amount_charged=$8,shipping_amount=$9,razorpay_payment_id=$10 WHERE id=$11",
      [req.user.id, name, email, phone, address, finalTotal, payment, amountCharged, shipping, razorpay_payment_id, existingId]
    );
    for (const item of verifiedItems) {
      let imageSnapshot = null;
      try {
        const imgRow = await pool.query("SELECT image_url, image FROM products WHERE id=$1", [item.product_id]);
        if (imgRow.rows.length) imageSnapshot = imgRow.rows[0].image_url || imgRow.rows[0].image || null;
      } catch(e) {}
      await pool.query(
        "INSERT INTO order_items (order_id,product_id,product_name,price,size,frame,quantity,image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [existingId, item.product_id||null, item.product_name||item.name, item.price, item.size||"A4", item.frame||"No Frame", item.quantity||1, imageSnapshot]
      );
    }
try {
      console.log("📧 Sending email for order:", existingId);
      const itemsText = verifiedItems.map((it,i) => {
        const frame = it.frame||'No Frame'; const size = it.size||'A5';
        const frameNote = (frame==='Black Frame'&&size==='A4') ? '\n  Frame   : Black Frame (+₹130)' : '\n  Frame   : '+frame;
        const pidLine   = it.db_product_id   ? '\n  Product ID   : '+it.db_product_id   : '';
        const pcodeLine = it.db_product_code ? '\n  Product Code : '+it.db_product_code : '';
        return "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nItem "+(i+1)+"\n  Product : "+(it.product_name||it.name||'Unknown')+pidLine+pcodeLine+"\n  Size    : "+size+frameNote+"\n  Qty     : "+(it.quantity||1)+"\n  Price   : ₹"+it.price;      }).join('');
      const shippingLine = "\nShipping  : "+(shipping===0?"Free":"₹"+shipping);
      const paymentNote = payment==="cod" ? "\n💳 Payment : COD — Paid ₹"+amountCharged+" now, ₹"+(finalTotal-amountCharged)+" on delivery" : "\n💳 Payment : Full — ₹"+amountCharged+" paid";
      const adminText = "🛒 NEW ORDER #"+existingId+"\n\n👤 CUSTOMER\nName    : "+name+"\nEmail   : "+email+"\nPhone   : "+phone+"\nAddress : "+address+"\n\n📦 ORDER ITEMS"+itemsText+"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"+shippingLine+"\n\n💰 ORDER TOTAL : ₹"+finalTotal+paymentNote+"\n\n⏱ "+new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});
      await transporter.sendMail({ from:"Nova Studioz <"+process.env.EMAIL_USER+">", to:ADMIN_EMAIL, subject:"🛒 New Order #"+existingId+" — ₹"+finalTotal+" | "+name, text:adminText });
      if (email) {
        const customerText = "Hi "+name+"! 🎉\n\nYour order is confirmed!\n\n📦 ORDER DETAILS\nOrder # : "+existingId+"\n\nItems"+itemsText+"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"+shippingLine+"\n\n💰 Order Total : ₹"+finalTotal+paymentNote+"\n📍 Deliver to  : "+address+"\n\n⏱ Expected dispatch: 2–3 business days\n📬 Delivery: 5–7 business days pan India\n\nThank you for shopping with Nova Studioz! 🎨\n\n— Team Nova Studioz\nnovastudioz010@gmail.com";
        await transporter.sendMail({ from:"Nova Studioz <"+process.env.EMAIL_USER+">", to:email, subject:"✅ Order Confirmed #"+existingId+" — Nova Studioz", text:customerText });
      }
    } catch(e) { console.error("❌ Email failed:", e.message); }

    return res.json({ success: true, orderId: existingId });
  }
}

    const order = await pool.query(
      "INSERT INTO orders (user_id,name,email,phone,address,total,payment,status,amount_charged,shipping_amount,razorpay_order_id,razorpay_payment_id) VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending',$8,$9,$10,$11) RETURNING *",
      [req.user.id, name, email, phone, address, finalTotal, payment, amountCharged, shipping, razorpay_order_id||null, razorpay_payment_id||null]
    );
    const orderId = order.rows[0].id;

    for (const item of verifiedItems) {
      let imageSnapshot = null;
      try {
        const imgRow = await pool.query("SELECT image_url, image FROM products WHERE id=$1", [item.product_id]);
        if (imgRow.rows.length) imageSnapshot = imgRow.rows[0].image_url || imgRow.rows[0].image || null;
      } catch(e) { /* non-fatal */ }
      await pool.query(
        "INSERT INTO order_items (order_id,product_id,product_name,price,size,frame,quantity,image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [orderId, item.product_id||null, item.product_name||item.name, item.price, item.size||"A4", item.frame||"No Frame", item.quantity||1, imageSnapshot]
      );
    }

    // ── Email notifications ────────────────────────────────────────────────────
          console.log("📧 Attempting email to:", ADMIN_EMAIL, "from:", process.env.EMAIL_USER);

      try {
        const itemsText = (verifiedItems||[]).map((it,i) => {
          const itName = it.product_name||it.name||'Unknown';
          const size = it.size||'A5';
          const frame = it.frame||'No Frame';
          const qty = it.quantity||1;
          const basePrice = it.price - (frame === 'Black Frame' && size === 'A4' ? 130 : 0);
          const frameNote = (frame === 'Black Frame' && size === 'A4') ? '\n  Frame   : Black Frame (+₹130)' : '\n  Frame   : '+frame;
          const isPreOrder = it.isPreOrder ? ' [PRE-ORDER - 50% advance]' : '';
          const pidLine   = it.db_product_id   ? '\n  Product ID   : '+it.db_product_id   : '';
          const pcodeLine = it.db_product_code ? '\n  Product Code : '+it.db_product_code : '';
          return "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nItem "+(i+1)+isPreOrder+"\n  Product : "+itName+pidLine+pcodeLine+"\n  Size    : "+size+frameNote+"\n  Qty     : "+qty+"\n  Price   : ₹"+it.price+(frame==='Black Frame'&&size==='A4'?' (₹'+basePrice+' poster + ₹130 frame)':'');        }).join('');
        const shippingLine = "\nShipping  : "+(shipping===0?"Free":"₹"+shipping);
        const paymentNote = payment==="cod"
          ? "\n💳 Payment    : COD (40% advance = ₹"+amountCharged+" charged, ₹"+(finalTotal-amountCharged)+" on delivery)"
          : hasPreOrder
          ? "\n💳 Payment    : Pre-Order (50% = ₹"+amountCharged+" charged, remaining on dispatch)"
          : "\n💳 Payment    : Full — ₹"+amountCharged+" charged";
        const adminText = "🛒 NEW ORDER #"+orderId+"\n\n👤 CUSTOMER DETAILS\nName    : "+name+"\nEmail   : "+email+"\nPhone   : "+phone+"\nAddress : "+address+"\n\n📦 ORDER ITEMS"+itemsText+"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"+shippingLine+"\n\n💰 ORDER TOTAL : ₹"+finalTotal+paymentNote+"\n\n⏱ Received at: "+new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'});
        await transporter.sendMail({ from:"Nova Studioz <"+process.env.EMAIL_USER+">", to:ADMIN_EMAIL, subject:"🛒 New Order #"+orderId+" — ₹"+finalTotal+" | "+name, text:adminText });
        if (email) {
          const paymentNoteCustomer = payment==="cod"
            ? "\n💳 Payment  : COD — ₹"+amountCharged+" paid now, ₹"+(finalTotal-amountCharged)+" on delivery"
            : hasPreOrder
            ? "\n💳 Payment  : Pre-Order — ₹"+amountCharged+" paid now, remaining on dispatch"
            : "\n💳 Payment  : Full — ₹"+amountCharged+" paid";
          const customerText = "Hi "+name+"! 🎉\n\nYour order has been confirmed!\n\n📦 ORDER DETAILS\nOrder # : "+orderId+"\n\nItems"+itemsText+"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"+shippingLine+"\n\n💰 Order Total : ₹"+finalTotal+paymentNoteCustomer+"\n📍 Deliver to  : "+address+"\n\n⏱ Expected dispatch: 2–3 business days\n📬 Delivery: 5–7 business days pan India\n\nThank you for shopping with Nova Studioz! 🎨\n\n— Team Nova Studioz\nnovastudioz010@gmail.com";
          await transporter.sendMail({ from:"Nova Studioz <"+process.env.EMAIL_USER+">", to:email, subject:"✅ Order Confirmed #"+orderId+" — Nova Studioz", text:customerText });
        }
     } catch(e) { console.error("Email:", e.message); }

    res.json({ success:true, orderId });
  } catch (err) { console.error("Order:", err.message); res.status(500).json({ success:false }); }
});

app.get("/api/orders", verifyToken, async (req, res) => {
  try {
    const orders = await pool.query("SELECT * FROM orders WHERE user_id=$1 ORDER BY id DESC", [req.user.id]);
    for (const o of orders.rows) { const items = await pool.query("SELECT * FROM order_items WHERE order_id=$1",[o.id]); o.items = items.rows; }
    res.json(orders.rows);
  } catch { res.status(500).json({ error:"Server error" }); }
});

app.get("/api/admin/orders", verifyToken, isAdmin, async (req, res) => {
  try {
   const orders = await pool.query("SELECT * FROM orders ORDER BY id DESC");
    for (const o of orders.rows) {
      const items = await pool.query(
        "SELECT oi.*, p.product_id AS prod_pid, p.product_code AS prod_pcode FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=$1",
        [o.id]
      );
      o.items = items.rows;
    }
     res.json(orders.rows);
  } catch { res.status(500).json({ error:"Server error" }); }
});

app.post("/api/admin/orders/:id/status", verifyToken, isAdmin, async (req, res) => {
  try { await pool.query("UPDATE orders SET status=$1 WHERE id=$2",[req.body.status, req.params.id]); res.json({ success:true }); }
  catch { res.status(500).json({ success:false }); }
});

/* ─── ADMIN: MARK FINAL PAYMENT RECEIVED (COD/Preorder) ─── */
app.post("/api/admin/orders/:id/payment-received", verifyToken, isAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const r = await pool.query("SELECT * FROM orders WHERE id=$1", [orderId]);
    if (!r.rows.length) return res.status(404).json({ error: "Order not found" });
    const order = r.rows[0];
    await pool.query(
      "UPDATE orders SET amount_charged=$1, payment_fully_received=TRUE WHERE id=$2",
      [order.total, orderId]
    );
    res.json({ success: true, total: order.total });
  } catch(e) { console.error("payment-received:", e.message); res.status(500).json({ success: false, error: e.message }); }
});


/* ─── USER PROFILE ─── */
app.get("/api/user", verifyToken, async (req, res) => {
  try {
    const r = await pool.query("SELECT id,name,email,phone,address,role FROM users WHERE id=$1",[req.user.id]);
    if (!r.rows.length) return res.status(404).json({ error:"Not found" });
    res.json(r.rows[0]);
  } catch { res.status(500).json({ error:"Server error" }); }
});

app.post("/api/update-user", verifyToken, async (req, res) => {
  try { const { name, phone, address, city, pincode } = req.body; await pool.query("UPDATE users SET name=$1,phone=$2,address=$3,city=$4,pincode=$5 WHERE id=$6",[name,phone,address,city||null,pincode||null,req.user.id]); res.json({ success:true }); }
  catch { res.status(500).json({ success:false }); }
});

/* ─── ADMIN STATS ─── */
app.get("/api/admin/stats", verifyToken, isAdmin, async (req, res) => {
  try {
    const [o,p,u,r] = await Promise.all([
      pool.query("SELECT COUNT(*) as c FROM orders"),
      pool.query("SELECT COUNT(*) as c FROM products"),
      pool.query("SELECT COUNT(*) as c FROM users"),
      pool.query("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'Cancelled'")
    ]);
    res.json({ orders:parseInt(o.rows[0].c), products:parseInt(p.rows[0].c), users:parseInt(u.rows[0].c), revenue:parseInt(r.rows[0].s) });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

/* ─── ADMIN: LIST PRODUCTS ─── */
app.get("/api/admin/products", verifyToken, isAdmin, async (req, res) => {
  try {
    const { search, category, theme, limited, page } = req.query;
    const limit   = Math.min(parseInt(req.query.limit)||50, 200);
    const pageNum = Math.max(parseInt(page)||1, 1);
    const offset  = (pageNum-1)*limit;
    const vals=[], conds=[];
    if (search) { conds.push("(LOWER(name) LIKE $"+(vals.length+1)+" OR LOWER(theme) LIKE $"+(vals.length+1)+" OR LOWER(category) LIKE $"+(vals.length+1)+" OR COALESCE(product_id,'') LIKE $"+(vals.length+1)+" OR COALESCE(LOWER(entity),'') LIKE $"+(vals.length+1)+")"); vals.push('%'+search.toLowerCase()+'%'); }
    if (category && category!=='all') { conds.push("category=$"+(vals.length+1)); vals.push(category); }
    if (theme    && theme   !=='all') { conds.push("theme=$"+(vals.length+1));    vals.push(theme); }
    if (limited === 'true')           { conds.push("limited=TRUE"); }
    if (req.query.product_type && req.query.product_type !== 'all') { conds.push("product_type=$"+(vals.length+1)); vals.push(req.query.product_type); }
    const where = conds.length?" WHERE "+conds.join(" AND "):"";
    const cntR  = await pool.query("SELECT COUNT(*) FROM products"+where, vals);
    const total = parseInt(cntR.rows[0].count);
    const r     = await pool.query("SELECT * FROM products"+where+" ORDER BY id DESC LIMIT $"+(vals.length+1)+" OFFSET $"+(vals.length+2), [...vals, limit, offset]);
    res.json({ products:r.rows, total, page:pageNum, pages:Math.ceil(total/limit)||1 });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

/* ─── ADMIN: SEARCH PRODUCTS ─── */
app.get("/api/admin/products/search", verifyToken, isAdmin, async (req, res) => {
  try {
    const q = (req.query.q||"").toLowerCase().trim();
    if (!q) return res.json([]);
    const r = await pool.query("SELECT * FROM products WHERE LOWER(name) LIKE $1 OR COALESCE(LOWER(slug),'') LIKE $1 OR COALESCE(product_id,'') LIKE $1 OR LOWER(category) LIKE $1 OR LOWER(theme) LIKE $1 ORDER BY id DESC LIMIT 50",['%'+q+'%']);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post("/api/admin/products/new", verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, price, image_url, image, image2, image3, category, theme, description, limited, product_type, subcategory, display_location, poster_sizes, poster_type, special_type, le_subcategory, custom_product_id, product_code, entity } = req.body;
    if (!name||!price||!category||!theme) return res.status(400).json({ error:"name/price/category/theme required" });
    let pid;
    if (custom_product_id && custom_product_id.trim()) {
      const existing = await pool.query("SELECT id FROM products WHERE product_id=$1 LIMIT 1",[custom_product_id.trim()]);
      if (existing.rows.length) return res.status(400).json({ error:"Product code '"+custom_product_id+"' already exists." });
      pid = custom_product_id.trim();
    } else {
      const maxR  = await pool.query("SELECT MAX(CAST(SUBSTRING(product_id FROM 4) AS INTEGER)) as mx FROM products WHERE product_id LIKE 'pd_%'");
      const n     = (parseInt(maxR.rows[0].mx)||0)+1;
      pid   = "pd_"+String(n).padStart(4,"0");
    }
    let pcode = product_code && product_code.trim() ? product_code.trim() : pid;
    const codeCheck = await pool.query("SELECT id FROM products WHERE product_code=$1 LIMIT 1",[pcode]);
    if (codeCheck.rows.length) return res.status(400).json({ error:"Product code '"+pcode+"' already in use." });
    const base  = name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").substring(0,70);
    const slugSuffix = pid.replace(/[^a-z0-9]/gi,'-').substring(0,20);
    const slug  = base+"-"+slugSuffix;
    const img   = image_url||image||null;
    const pSizes = poster_sizes || (category === 'Posters' ? 'A4' : null);
    const pType  = poster_type || 'single';
    const isLE   = limited===true || limited==='true' || category==='Limited Edition';
    const sType   = isLE ? (special_type||null) : null;
    const leSubcat = isLE ? (le_subcategory||null) : null;
    let finalPrice = parseInt(price);
    if (category === 'Posters' && pSizes) {
      const sizeKey = pSizes.split(',')[0].trim();
      finalPrice = POSTER_SIZE_PRICES[sizeKey] || finalPrice;
    }
    const r = await pool.query(
      "INSERT INTO products (name,price,image,image2,image3,category,theme,description,product_id,product_code,slug,image_url,limited,product_type,subcategory,display_location,poster_sizes,poster_type,special_type,le_subcategory,entity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *",
      [name,finalPrice,img,image2||null,image3||null,category,theme,description||'',pid,pcode,slug,img,isLE,product_type||'general',subcategory||null,display_location||'main_products',pSizes,pType,sType,leSubcat,entity||null]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

/* ─── ADMIN: PUT UPDATE PRODUCT ─── */
app.put("/api/admin/products/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, price, image_url, image, image2, image3, category, theme, description, slug, limited, is_featured, special_edition, custom_price } = req.body;
    const id = req.params.id;
    const fields=[], vals=[];
    const add = (col,val) => { fields.push(col+"=$"+(vals.length+1)); vals.push(val); };
    if (name          !==undefined) add("name",           name);
    if (price         !==undefined) {
      let finalPrice = parseInt(price);
      if (req.body.category === 'Posters' && req.body.poster_sizes) {
        const sizeKey = req.body.poster_sizes.split(',')[0].trim();
        finalPrice = POSTER_SIZE_PRICES[sizeKey] || finalPrice;
      }
      add("price", finalPrice);
    }
    if (image_url     !==undefined) { add("image_url",image_url); add("image",image_url); }
    if (image         !==undefined) add("image",          image);
    if (image2        !==undefined) add("image2",         image2);
    if (image3        !==undefined) add("image3",         image3);
    if (category      !==undefined) add("category",       category);
    if (theme         !==undefined) add("theme",          theme);
    if (description   !==undefined) add("description",    description);
    if (limited       !==undefined) add("limited",        limited===true||limited==='true');
    if (req.body.product_type      !== undefined) add("product_type",     req.body.product_type||'general');
    if (req.body.subcategory       !== undefined) add("subcategory",      req.body.subcategory||null);
    if (req.body.poster_sizes      !== undefined) add("poster_sizes",     req.body.poster_sizes||'A4');
    if (req.body.poster_type       !== undefined) add("poster_type",      req.body.poster_type||'single');
    if (req.body.display_location  !== undefined) add("display_location", req.body.display_location||'main_products');
    if (req.body.special_type      !== undefined) add("special_type",     req.body.special_type||null);
    if (req.body.le_subcategory    !== undefined) add("le_subcategory",   req.body.le_subcategory||null);
    if (req.body.product_code !== undefined) {
      const pc = req.body.product_code ? req.body.product_code.trim() : null;
      if (pc) {
        const pcc = await pool.query("SELECT COUNT(*) FROM products WHERE product_code=$1 AND id!=$2",[pc,id]);
        if (parseInt(pcc.rows[0].count)>0) return res.status(400).json({ error:"Product code '"+pc+"' already in use" });
      }
      add("product_code", pc);
    }
    if (req.body.entity            !== undefined) add("entity",           req.body.entity||null);
    if (is_featured   !==undefined) add("is_featured",    is_featured?1:0);
    if (special_edition!==undefined) add("special_edition",special_edition?1:0);
    if (custom_price  !==undefined) add("custom_price",   parseInt(custom_price)||0);
    if (slug          !==undefined) {
      const sc = await pool.query("SELECT COUNT(*) FROM products WHERE slug=$1 AND id!=$2",[slug,id]);
      if (parseInt(sc.rows[0].count)>0) return res.status(400).json({ error:"Slug already exists" });
      add("slug",slug);
    }
    if (!fields.length) return res.status(400).json({ error:"Nothing to update" });
    vals.push(id);
    const r = await pool.query("UPDATE products SET "+fields.join(",")+" WHERE id=$"+vals.length+" RETURNING *", vals);
    res.json(r.rows[0]||{ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

/* ─── ADMIN: LEGACY POST UPDATE ─── */
app.post("/api/admin/products/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { price, is_featured, special_edition, category, custom_price, name, image_url, image, theme, description, limited } = req.body;
    const id = req.params.id;
    const fields=[], vals=[];
    if (name         !==undefined) { fields.push("name=$"+(vals.length+1));          vals.push(name); }
    if (price        !==undefined) { fields.push("price=$"+(vals.length+1));         vals.push(parseInt(price)); }
    if (custom_price !==undefined) { fields.push("custom_price=$"+(vals.length+1));  vals.push(parseInt(custom_price)||0); }
    if (is_featured  !==undefined) { fields.push("is_featured=$"+(vals.length+1));   vals.push(is_featured?1:0); }
    if (special_edition!==undefined){ fields.push("special_edition=$"+(vals.length+1)); vals.push(special_edition?1:0); }
    if (category     !==undefined) { fields.push("category=$"+(vals.length+1));      vals.push(category); }
    if (image_url    !==undefined) { fields.push("image_url=$"+(vals.length+1));     vals.push(image_url); fields.push("image=$"+(vals.length+1)); vals.push(image_url); }
    if (image        !==undefined) { fields.push("image=$"+(vals.length+1));         vals.push(image); }
    if (theme        !==undefined) { fields.push("theme=$"+(vals.length+1));         vals.push(theme); }
    if (description  !==undefined) { fields.push("description=$"+(vals.length+1));   vals.push(description); }
    if (limited      !==undefined) { fields.push("limited=$"+(vals.length+1));       vals.push(limited===true||limited==='true'); }
    if (req.body.product_type     !==undefined) { fields.push("product_type=$"+(vals.length+1));    vals.push(req.body.product_type||'general'); }
    if (req.body.subcategory      !==undefined) { fields.push("subcategory=$"+(vals.length+1));     vals.push(req.body.subcategory||null); }
    if (req.body.poster_sizes     !==undefined) { fields.push("poster_sizes=$"+(vals.length+1));    vals.push(req.body.poster_sizes||'A4'); }
    if (req.body.poster_type      !==undefined) { fields.push("poster_type=$"+(vals.length+1));     vals.push(req.body.poster_type||'single'); }
    if (req.body.display_location !==undefined) { fields.push("display_location=$"+(vals.length+1)); vals.push(req.body.display_location||'main_products'); }
    if (req.body.special_type     !==undefined) { fields.push("special_type=$"+(vals.length+1));    vals.push(req.body.special_type||null); }
    if (req.body.le_subcategory   !==undefined) { fields.push("le_subcategory=$"+(vals.length+1));  vals.push(req.body.le_subcategory||null); }
    if (!fields.length) return res.status(400).json({ error:"Nothing to update" });
    vals.push(id);
    await pool.query("UPDATE products SET "+fields.join(",")+" WHERE id=$"+vals.length, vals);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

/* ─── ADMIN: DELETE PRODUCT ─── */
app.delete("/api/admin/products/:id", verifyToken, isAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM products WHERE id=$1",[req.params.id]); res.json({ success:true }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

/* ─── ADMIN: ALL USERS ─── */
app.get("/api/admin/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const { search, page } = req.query;
    const limit   = Math.min(parseInt(req.query.limit)||50, 200);
    const pageNum = Math.max(parseInt(page)||1, 1);
    const offset  = (pageNum-1)*limit;
    const vals=[], conds=[];
    if (search) {
      conds.push("(LOWER(COALESCE(name,'')) LIKE $"+(vals.length+1)+" OR LOWER(COALESCE(email,'')) LIKE $"+(vals.length+1)+" OR COALESCE(phone,'') LIKE $"+(vals.length+1)+")");
      vals.push('%'+search.toLowerCase()+'%');
    }
    const where = conds.length?" WHERE "+conds.join(" AND "):"";
    const cntR  = await pool.query("SELECT COUNT(*) FROM users"+where, vals);
    const total = parseInt(cntR.rows[0].count);
    const r     = await pool.query(
      "SELECT id, COALESCE(name,'') as name, COALESCE(email,'') as email, "+
      "COALESCE(phone,'') as phone, COALESCE(address,'') as address, "+
      "COALESCE(city,'') as city, COALESCE(pincode,'') as pincode, "+
      "COALESCE(role,'user') as role, created_at FROM users"+
      where+" ORDER BY id DESC LIMIT $"+(vals.length+1)+" OFFSET $"+(vals.length+2),
      [...vals, limit, offset]
    );
    const users = r.rows;
    for (const u of users) {
      try {
        const ordR = await pool.query("SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as spend FROM orders WHERE user_id=$1",[u.id]);
        u.order_count = parseInt(ordR.rows[0].cnt);
        u.total_spend = parseInt(ordR.rows[0].spend);
      } catch(e2) { u.order_count = 0; u.total_spend = 0; }
    }
    res.json({ users, total, page:pageNum, pages:Math.ceil(total/limit)||1 });
  } catch(e) { console.error("Admin users error:", e.message); res.status(500).json({ error: e.message }); }
});

/* ─── ADMIN: UPDATE USER ROLE ─── */
app.post("/api/admin/users/:id/role", verifyToken, isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user','admin'].includes(role)) return res.status(400).json({ error:"Invalid role" });
    await pool.query("UPDATE users SET role=$1 WHERE id=$2",[role, req.params.id]);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

/* ─── HOMEPAGE SECTIONS ─── */
app.get("/api/homepage/:section", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT p.* FROM products p JOIN homepage_sections hs ON p.id=hs.product_id WHERE hs.section_name=$1 ORDER BY hs.position ASC",
      [req.params.section]
    );
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.get("/api/homepage-sections", verifyToken, isAdmin, async (req, res) => {
  try {
    const r = await pool.query("SELECT hs.*, p.name as product_name, p.image, p.price, p.product_id FROM homepage_sections hs LEFT JOIN products p ON p.id=hs.product_id ORDER BY section_name, position");
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post("/api/admin/homepage/add", verifyToken, isAdmin, async (req, res) => {
  try {
    const { section_name, product_id, position } = req.body;
    if (!section_name||!product_id) return res.status(400).json({ error:"section_name and product_id required" });
    const posR = await pool.query("SELECT COALESCE(MAX(position),0)+1 as nxt FROM homepage_sections WHERE section_name=$1",[section_name]);
    const pos  = position || posR.rows[0].nxt;
    const r = await pool.query("INSERT INTO homepage_sections (section_name,product_id,position) VALUES ($1,$2,$3) ON CONFLICT (section_name,product_id) DO UPDATE SET position=$3 RETURNING *",[section_name,product_id,pos]);
    res.json(r.rows[0]||{ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.delete("/api/admin/homepage/remove", verifyToken, isAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM homepage_sections WHERE section_name=$1 AND product_id=$2",[req.body.section_name, req.body.product_id]); res.json({ success:true }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

app.post("/api/admin/homepage/reorder", verifyToken, isAdmin, async (req, res) => {
  try {
    for (const item of (req.body.order||[])) {
      await pool.query("UPDATE homepage_sections SET position=$1 WHERE section_name=$2 AND product_id=$3",[item.position, req.body.section_name, item.product_id]);
    }
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

/* ═══ DB MIGRATIONS ═══ */
(async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name TEXT, email TEXT UNIQUE NOT NULL,
      password TEXT, phone TEXT, address TEXT, city TEXT, pincode TEXT,
      role TEXT DEFAULT 'user', created_at TIMESTAMP DEFAULT NOW())`);

    await pool.query(`CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 59,
      image TEXT, image2 TEXT, image3 TEXT, image_url TEXT,
      category TEXT NOT NULL DEFAULT 'Posters', theme TEXT NOT NULL DEFAULT 'Aesthetic',
      description TEXT, product_id TEXT UNIQUE, slug TEXT UNIQUE,
      limited BOOLEAN DEFAULT FALSE, is_featured INTEGER DEFAULT 0,
      special_edition INTEGER DEFAULT 0, custom_price INTEGER DEFAULT 0,
      product_type TEXT DEFAULT 'general', subcategory TEXT,
      display_location TEXT DEFAULT 'main_products',
      poster_sizes TEXT DEFAULT 'A4', poster_type TEXT DEFAULT 'single',
      created_at TIMESTAMP DEFAULT NOW())`);

    await pool.query(`CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, address TEXT,
      total INTEGER NOT NULL, payment TEXT DEFAULT 'razorpay',
      status TEXT DEFAULT 'Pending', promo_code TEXT, discount INTEGER DEFAULT 0,
      items JSONB, created_at TIMESTAMP DEFAULT NOW())`);

    await pool.query(`CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER, product_name TEXT,
      price INTEGER DEFAULT 0, size TEXT DEFAULT 'A4',
      frame TEXT DEFAULT 'No Frame', quantity INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW())`);

    await pool.query(`CREATE TABLE IF NOT EXISTS homepage_sections (
      id SERIAL PRIMARY KEY, section_name TEXT NOT NULL,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      position INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(section_name, product_id))`);

    // Safe ALTER columns
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount INTEGER DEFAULT 0");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_charged INTEGER DEFAULT 0");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_amount INTEGER DEFAULT 0");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT");
    await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_fully_received BOOLEAN DEFAULT FALSE");
    try { await pool.query("CREATE INDEX IF NOT EXISTS idx_orders_rzp_order_id ON orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL"); } catch(e) {}
    await pool.query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS image_url TEXT");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS entity TEXT");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_prod_entity ON products(entity) WHERE entity IS NOT NULL");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS image2 TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS image3 TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured INTEGER DEFAULT 0");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS special_edition INTEGER DEFAULT 0");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_price INTEGER DEFAULT 0");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS product_id TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS limited BOOLEAN DEFAULT FALSE");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'general'");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS display_location TEXT DEFAULT 'main_products'");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_prod_type ON products(product_type)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_prod_display ON products(display_location)");
    await pool.query("UPDATE products SET display_location='main_products' WHERE display_location IS NULL");
    await pool.query("UPDATE products SET product_type='general' WHERE product_type IS NULL");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS poster_sizes TEXT DEFAULT 'A4'");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS poster_type TEXT DEFAULT 'single'");
    await pool.query("UPDATE products SET poster_sizes='A4' WHERE category='Posters' AND (poster_sizes IS NULL OR poster_sizes='')");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_prod_poster_sizes ON products(poster_sizes)");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS special_type TEXT DEFAULT NULL");
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS le_subcategory TEXT DEFAULT NULL");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_prod_special_type ON products(special_type) WHERE special_type IS NOT NULL");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_prod_le_subcat ON products(le_subcategory) WHERE le_subcategory IS NOT NULL");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_prod_name ON products(LOWER(name))");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_prod_cat  ON products(category)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_prod_theme ON products(theme)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_prod_slug ON products(slug)");
    try { await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_prod_pid ON products(product_id) WHERE product_id IS NOT NULL"); } catch(e) {}

    const noId = await pool.query("SELECT id FROM products WHERE product_id IS NULL ORDER BY id ASC");
    const maxR  = await pool.query("SELECT MAX(CAST(SUBSTRING(product_id FROM 4) AS INTEGER)) as mx FROM products WHERE product_id LIKE 'pd_%'");
    let seq = (parseInt(maxR.rows[0].mx)||0)+1;
    for (const row of noId.rows) {
      const pid  = "pd_"+String(seq).padStart(4,"0");
      const slug = "product-"+String(seq).padStart(4,"0");
      await pool.query("UPDATE products SET product_id=$1,slug=$2,image_url=COALESCE(image_url,image) WHERE id=$3 AND product_id IS NULL",[pid,slug,row.id]);
      seq++;
    }

    await pool.query(`DELETE FROM products WHERE category='Limited Edition' AND (special_type NOT IN ('special_card','special_poster') OR special_type IS NULL) AND (le_subcategory NOT IN ('Special Cards','Special Posters') OR le_subcategory IS NULL)`);
    console.log("✅ LE cleanup done");

    await pool.query("UPDATE products SET price=33  WHERE category='Posters' AND poster_sizes='A5'");
    await pool.query("UPDATE products SET price=59  WHERE category='Posters' AND (poster_sizes='A4' OR poster_sizes IS NULL OR poster_sizes='')");
    await pool.query("UPDATE products SET price=65  WHERE category='Posters' AND poster_sizes='Portrait'");
    await pool.query("UPDATE products SET price=169 WHERE category='Posters' AND poster_sizes='Landscape'");
    await pool.query("UPDATE products SET price=99  WHERE category='Limited Edition' AND special_type='special_card'");
    await pool.query("UPDATE products SET price=99  WHERE category='Limited Edition' AND special_type='special_poster'");
    console.log("✅ DB prices fixed: A5=33 A4=59 Portrait=65 Landscape=169 LE=99");

    await pool.query(`UPDATE products SET theme='Aesthetic'          WHERE theme IN ('Nature','Minimal','Abstract','Architecture')`);
    await pool.query(`UPDATE products SET theme='Gaming and Cars'    WHERE theme IN ('Cars','Gaming and Cartoons','Gaming','Sports Cars')`);
    await pool.query(`UPDATE products SET theme='Culture Drops'      WHERE theme IN ('Maratha Legacy','Culture Drop','Hip Hop','Street','Music')`);
    await pool.query(`UPDATE products SET theme='Superhero Collection' WHERE theme IN ('Superheroes','DC','Marvel','Comics')`);
    await pool.query(`UPDATE products SET theme='Movies and TV Shows' WHERE theme IN ('Movies','TV Shows','Hollywood','Bollywood')`);
    await pool.query(`DELETE FROM products WHERE category NOT IN ('Posters','Limited Edition','T-Shirts & Merchandise','Action Figures','Collectibles')`);
    await pool.query(`UPDATE products SET theme='Aesthetic' WHERE theme NOT IN ('Anime','Culture Drops','Gaming and Cars','Movies and TV Shows','Aesthetic','Superhero Collection')`);
    await pool.query(`DELETE FROM products WHERE category='Limited Edition' AND le_subcategory NOT IN ('Special Cards','Special Posters') AND (le_subcategory IS NOT NULL)`);
    await pool.query(`UPDATE products SET special_type='special_poster', le_subcategory='Special Posters' WHERE special_type='special_frame'`);
    await pool.query(`UPDATE products SET special_type='special_poster', le_subcategory='Special Posters' WHERE le_subcategory='Special Frames'`);
    console.log("✅ Price + theme + category cleanup done");

    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code TEXT");
    try { await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_prod_pcode ON products(product_code) WHERE product_code IS NOT NULL"); } catch(e) {}
    await pool.query("UPDATE products SET product_code = product_id WHERE product_code IS NULL AND product_id IS NOT NULL");

    const cntR = await pool.query("SELECT COUNT(*) as c FROM products");
    console.log("✅ Nova Studioz ready — products:", cntR.rows[0].c, "— http://localhost:"+(process.env.PORT||3000));
  } catch(e) { console.error("Migration error:", e.message); }
})();

app.listen(process.env.PORT || 3000);

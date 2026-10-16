const nodemailer = require("nodemailer");

if (!process.env.EMAIL_PASS || process.env.EMAIL_PASS === "your_app_password_here") {
  console.warn("⚠️  WARNING: EMAIL_PASS is not set in .env — emails will fail.");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email transporter error:", error.message);
  } else {
    console.log("✅ Email transporter ready");
  }
});

module.exports = transporter;
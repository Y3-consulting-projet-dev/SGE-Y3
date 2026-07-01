const nodemailer = require('nodemailer');

let transporter;
let transporterInitialized = false;

function getTransporter() {
  if (transporterInitialized) {
    return transporter;
  }

  transporterInitialized = true;

  if (!process.env.SMTP_HOST) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });

  return transporter;
}

async function sendMail({ to, subject, text }) {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    console.warn(`[mailer] SMTP non configure - email ignore (destinataire: ${to}, objet: ${subject})`);
    return;
  }

  try {
    await activeTransporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error(`[mailer] Echec de l'envoi de l'email a ${to}:`, error.message);
  }
}

module.exports = { sendMail };

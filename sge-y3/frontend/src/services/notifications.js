import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export async function sendNotificationEmail(templateParams) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    throw new Error("Configuration EmailJS manquante (voir le fichier .env)");
  }

  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, {
    publicKey: PUBLIC_KEY,
  });
}

// Stub — logs instead of sending. Swap for a real provider (nodemailer +
// SMTP, SendGrid, SES, etc.) once credentials are available; the call shape
// below is provider-agnostic on purpose.
async function sendEmail({ to, subject, body }) {
  console.log(`[email:stub] -> ${to}\nSubject: ${subject}\n${body}\n`);
  return { ok: true, stub: true };
}

module.exports = { sendEmail };

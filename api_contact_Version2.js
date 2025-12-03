// Vercel serverless function: api/contact.js
// Uses SendGrid when SENDGRID_API_KEY is set; otherwise logs payload (useful for local/dev).
// Ensure you set SENDGRID_API_KEY and SENDGRID_FROM/CONTACT_TO in Vercel dashboard for production.

const sgMail = require('@sendgrid/mail');

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

module.exports = async (req, res) => {
  // Allow CORS for static site + Vercel function usage (adjust in production).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Only POST allowed' });
  }

  try {
    const { name, email, phone = '', type = '', message } = req.body || {};

    // Basic validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ ok: false, error: 'Please provide a valid name.' });
    }
    if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
      return res.status(400).json({ ok: false, error: 'Please provide a valid email address.' });
    }
    if (!message || typeof message !== 'string' || message.trim().length < 4) {
      return res.status(400).json({ ok: false, error: 'Please include a short message.' });
    }

    const payload = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      type: (type || '').trim(),
      message: message.trim(),
      receivedAt: new Date().toISOString(),
    };

    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    const CONTACT_TO = process.env.CONTACT_TO || process.env.SENDGRID_FROM || 'info@chargeflow.ca';
    const SENDGRID_FROM = process.env.SENDGRID_FROM || CONTACT_TO;

    // If SendGrid API key present, send email. Otherwise log to console and return success (dev-friendly).
    if (SENDGRID_API_KEY) {
      sgMail.setApiKey(SENDGRID_API_KEY);

      const htmlBody = `
        <h3>New contact request — ChargeFlow</h3>
        <p><strong>Name:</strong> ${payload.name}</p>
        <p><strong>Email:</strong> ${payload.email}</p>
        <p><strong>Phone:</strong> ${payload.phone || '[not provided]'}</p>
        <p><strong>Interest:</strong> ${payload.type || '[not provided]'}</p>
        <p><strong>Message:</strong><br/>${payload.message.replace(/\n/g, '<br/>')}</p>
        <hr/>
        <small>Received: ${payload.receivedAt}</small>
      `;

      const msg = {
        to: CONTACT_TO,
        from: SENDGRID_FROM, // must be a verified sender for SendGrid
        subject: `Website contact from ${payload.name}`,
        text: [
          `Name: ${payload.name}`,
          `Email: ${payload.email}`,
          `Phone: ${payload.phone || '[not provided]'}`,
          `Interest: ${payload.type || '[not provided]'}`,
          '',
          payload.message
        ].join('\n'),
        html: htmlBody,
      };

      await sgMail.send(msg);
      console.log(`[sendgrid] Contact sent: ${payload.email} -> ${CONTACT_TO}`);
      return res.json({ ok: true, message: 'Message sent.' });
    } else {
      // No SendGrid configured — log and return success to allow static site dev/test.
      console.log('[contact] Received (SendGrid not configured):', JSON.stringify(payload, null, 2));
      return res.json({ ok: true, message: 'Received (no SendGrid configured). Check function logs.' });
    }
  } catch (err) {
    console.error('Error in contact function:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};
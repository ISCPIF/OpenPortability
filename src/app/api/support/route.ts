import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { auth } from '@/app/auth';
import logger, { withLogging } from '@/lib/log_utils';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function supportHandler(request: Request) {
  try {
    const session = await auth();
    const { subject, message, email } = await request.json();

    // Construire le sujet avec le statut d'authentification
    const authStatus = session?.user 
      ? `[Auth - ID: ${session.user.id}]` 
      : '[Non Auth]';
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: `Support ${authStatus}: ${subject}`,
      replyTo: email, // Add reply-to field with client's email
      text: message,
      html: `
        <h2>Nouveau message de support</h2>
        ${session?.user ? `<p><strong>Utilisateur ID:</strong> ${session.user.id}</p>` : '<p><strong>Utilisateur:</strong> Non authentifié</p>'}
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Sujet:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown';
    logger.logError('API', 'POST /api/support', error, userId, {
      context: 'Sending support email'
    });
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

export const POST = withLogging(supportHandler);
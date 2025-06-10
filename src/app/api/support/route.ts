import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { auth } from '@/app/auth';
import logger, { withLogging } from '@/lib/log_utils';
import { secureSupportContentExtended, type SupportFormData } from '@/lib/security-utils';

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
    // console.log("@@@@@@@@@@@@@@@@@@")
    const session = await auth();
    const rawData = await request.json();
    
    // Validation de base des champs requis
    if (!rawData.subject || !rawData.message || !rawData.email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validation stricte du format email avant tout traitement
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailString = String(rawData.email).trim();
    
    if (!emailRegex.test(emailString) || emailString.length > 254) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const formData: SupportFormData = {
      subject: String(rawData.subject).trim(),
      message: String(rawData.message).trim(),
      email: emailString
    };

    // SÉCURISATION MULTI-COUCHES
    const securityResult = secureSupportContentExtended(formData, session?.user?.id);
    
    // Rejeter les contenus dangereux
    if (!securityResult.isSecure) {
      console.log("!!!!!!!!")
      
      // Déterminer le message d'erreur selon le type de violation
      let errorMessage = 'Content validation failed. Please check your message.';
      
      if (securityResult.securityReport.sqlInjectionDetected) {
        errorMessage = 'Potential SQL injection detected. Please review your message.';
        console.log('Security', 'SQL injection attempt blocked', new Error('SQL injection attempt blocked'), session?.user?.id || 'anonymous', {
          context: 'Support form - SQL injection detected',
          securityReport: securityResult.securityReport,
          clientIP: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        });
      } else if (securityResult.securityReport.tamperingDetected) {
        errorMessage = 'Invalid request format detected.';
        console.log('Security', 'Tampering attempt blocked', new Error('Tampering attempt blocked'), session?.user?.id || 'anonymous', {
          context: 'Support form - tampering detected',
          securityReport: securityResult.securityReport,
          clientIP: request.headers.get('x-forwarded-for') || 'unknown'
        });
      } else if (securityResult.securityReport.rateLimitExceeded) {
        errorMessage = 'Too many requests. Please try again later.';
        console.log('Security', 'Rate limit exceeded', new Error('Rate limit exceeded'), session?.user?.id || 'anonymous', {
          context: 'Support form - rate limit exceeded',
          clientIP: request.headers.get('x-forwarded-for') || 'unknown'
        });
        return NextResponse.json(
          { error: errorMessage },
          { status: 429 }  // 429 Too Many Requests
        );
      } else {
        // XSS ou autre violation
        console.log('Security', 'Dangerous content blocked', new Error('XSS attempt blocked'), session?.user?.id || 'anonymous', {
          context: 'Support form - dangerous content detected',
          securityReport: securityResult.securityReport,
          clientIP: request.headers.get('x-forwarded-for') || 'unknown'
        });
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // Construire le sujet avec le statut d'authentification
    const authStatus = session?.user 
      ? `[Auth - ID: ${session.user.id}]` 
      : '[Non Auth]';
    
    // Utiliser le contenu sécurisé pour l'email
    const secureSubject = securityResult.securityReport.sanitizedContent 
      ? securityResult.securityReport.sanitizedContent.substring(0, 200)
      : formData.subject;

    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `Support ${authStatus}: ${secureSubject}`,
        replyTo: formData.email,
        // Toujours inclure la version text pour la sécurité
        text: `
Nouveau message de support

${session?.user ? `Utilisateur ID: ${session.user.id}` : 'Utilisateur: Non authentifié'}
Email: ${formData.email}
Sujet: ${formData.subject}

Message:
${securityResult.textContent}

---
Niveau de sécurité: ${securityResult.securityReport.securityLevel}
        `.trim(),
        // Version HTML sécurisée (si disponible et seulement si le niveau de sécurité est 'safe')
        html: securityResult.htmlContent && securityResult.securityReport.securityLevel === 'safe' ? `
          <h2>Nouveau message de support</h2>
          ${session?.user ? `<p><strong>Utilisateur ID:</strong> ${session.user.id}</p>` : '<p><strong>Utilisateur:</strong> Non authentifié</p>'}
          <p><strong>Email:</strong> ${emailString}</p>
          <p><strong>Sujet:</strong> ${secureSubject}</p>
          <p><strong>Message:</strong></p>
          <div style="border-left: 3px solid #ccc; padding-left: 15px; margin: 10px 0;">
            ${securityResult.htmlContent}
          </div>
          <hr>
          <p style="font-size: 12px; color: #666;">
            <strong>Sécurité:</strong> ${securityResult.securityReport.securityLevel} | 
            <strong>Validation:</strong> ${securityResult.securityReport.errors.length === 0 ? 'Passed' : 'Issues detected'}
          </p>
        ` : undefined
      };

      await transporter.sendMail(mailOptions);

      // Log de succès avec informations de sécurité
      console.log('API', 'POST /api/support', session?.user?.id || 'anonymous', {
        context: 'Support email sent successfully',
        securityLevel: securityResult.securityReport.securityLevel,
        hasHtmlContent: !!securityResult.htmlContent
      });

      return NextResponse.json({ success: true });
    } catch (mailError) {
      // Log détaillé de l'erreur d'envoi d'email
      console.error('Mail Send Error', mailError, {
        context: 'Failed to send support email',
        securityLevel: securityResult.securityReport.securityLevel,
        emailLength: formData.email.length,
        subjectLength: secureSubject.length
      });
      
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error) {
    const userId = (await auth())?.user?.id || 'unknown';
    console.log('API', 'POST /api/support', error, userId, {
      context: 'Sending support email'
    });
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

export const POST = withLogging(supportHandler);
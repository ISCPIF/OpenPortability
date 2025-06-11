import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { auth } from '@/app/auth';
import logger from '@/lib/log_utils';
import { secureSupportContentExtended, type SupportFormData } from '@/lib/security-utils';
import { withValidation } from '@/lib/validation/middleware';
import { SupportRequestSchema, type SupportRequestSchema as SupportInput } from '@/lib/validation/schemas';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Handler avec le nouveau middleware
export const POST = withValidation(
  SupportRequestSchema,
  async (request: NextRequest, data: SupportInput) => {
    try {
      const session = await auth();
      
      // Construire le formData pour la fonction de sécurité existante
      const formData: SupportFormData = {
        subject: data.subject,
        message: data.message,
        email: data.email
      };

      // SÉCURISATION MULTI-COUCHES (garder la logique existante)
      const securityResult = secureSupportContentExtended(formData, session?.user?.id);
      
      // Note : Les vérifications SQL/XSS sont déjà faites par le middleware,
      // mais on garde ce check pour la sanitisation HTML et autres validations spécifiques
      if (!securityResult.isSecure) {
        let errorMessage = 'Content validation failed. Please check your message.';
        
        if (securityResult.securityReport.sqlInjectionDetected) {
          errorMessage = 'Potential SQL injection detected. Please review your message.';
        } else if (securityResult.securityReport.tamperingDetected) {
          errorMessage = 'Invalid request format detected.';
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
        : data.subject;

      try {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: process.env.EMAIL_USER,
          subject: `Support ${authStatus}: ${secureSubject}`,
          replyTo: data.email,
          // Toujours inclure la version text pour la sécurité
          text: `
Nouveau message de support

${session?.user ? `Utilisateur ID: ${session.user.id}` : 'Utilisateur: Non authentifié'}
Email: ${data.email}
Sujet: ${data.subject}

Message:
${securityResult.textContent}

---
Niveau de sécurité: ${securityResult.securityReport.securityLevel}
          `.trim(),
          // Version HTML sécurisée (si disponible et seulement si le niveau de sécurité est 'safe')
          html: securityResult.htmlContent && securityResult.securityReport.securityLevel === 'safe' ? `
            <h2>Nouveau message de support</h2>
            ${session?.user ? `<p><strong>Utilisateur ID:</strong> ${session.user.id}</p>` : '<p><strong>Utilisateur:</strong> Non authentifié</p>'}
            <p><strong>Email:</strong> ${data.email}</p>
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
        console.log('API', 'Failed to send support email', mailError, session?.user?.id || 'anonymous', {
          context: 'Mail send error',
          securityLevel: securityResult.securityReport.securityLevel
        });
        
        return NextResponse.json(
          { error: 'Failed to send email' },
          { status: 500 }
        );
      }
    } catch (error) {
      const session = await auth();
      console.log('API', 'POST /api/support', error, session?.user?.id || 'anonymous', {
        context: 'Unexpected error in support handler'
      });
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: false, // Permettre les soumissions anonymes
    applySecurityChecks: true,
    skipRateLimit: false
  }
);
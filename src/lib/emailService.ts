import nodemailer from "nodemailer";
import { adminDb } from "./firebaseAdmin";

/**
 * Branded Corporate Email Alerting Service (Adani Port theme)
 * 🔒 Now with 100% Automatic Email Open Tracking & Pixel Injection
 */
export class EmailService {
  private static getTransporter() {
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";

    if (!smtpUser || !smtpPass) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("SMTP credentials not configured. Email alerts will be skipped.");
      }
      return null;
    }

    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // TLS
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  /**
   * Helper to wrap emails in our premium Adani Port branded wrapper and inject the tracking pixel
   */
  private static getBrandedWrapper(title: string, bodyHtml: string, emailLogId: string, origin?: string): string {
    const appOrigin = origin || process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://adani.veertrading.in");

    const trackingPixel = `<img src="${appOrigin}/api/system/track-email?id=${emailLogId}" width="1" height="1" style="display:none;" alt="" />`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f8fafc; color: #334155; margin: 0; padding: 0; }
          .wrapper { width: 100%; background-color: #f8fafc; padding: 40px 0; }
          .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background-color: #0284c7; padding: 20px; text-align: center; }
          .header h2 { color: #ffffff; margin: 0; font-size: 15px; text-transform: uppercase; letter-spacing: 1.5px; }
          .content { padding: 30px; }
          .content h3 { font-size: 13px; text-transform: uppercase; color: #0f172a; margin-top: 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
          .content p { font-size: 12px; line-height: 1.6; color: #475569; }
          .info-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 11px; }
          .info-table td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
          .info-table td.label { font-weight: bold; color: #64748b; width: 30%; }
          .info-table td.value { color: #1e293b; font-family: monospace; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
          .badge-danger { background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
          .badge-warning { background-color: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
          .badge-info { background-color: #e0f2fe; color: #075985; border: 1px solid #7dd3fc; }
          .footer { background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <h2>Adani Port Logistics</h2>
            </div>
            <div class="content">
              <h3>${title}</h3>
              ${bodyHtml}
            </div>
            <div class="footer">
              This is a secure automated system notification. Please do not reply directly to this email.
            </div>
          </div>
        </div>
        ${trackingPixel}
      </body>
      </html>
    `;
  }

  /**
   * Helper to write a tracking record to Firestore database
   */
  private static async logEmailRecord(emailLogId: string, to: string, subject: string, type: string) {
    try {
      await adminDb.collection("email_logs").doc(emailLogId).set({
        to,
        subject,
        type,
        sentAt: new Date().toISOString(),
        status: "SENT",
        opens: []
      });
    } catch (err) {
      console.error("Failed to write email tracking log to Firestore:", err);
    }
  }

  /**
   * Send a Login Notification alert for Admin/Superadmin logins
   */
  public static async sendLoginAlert(email: string, role: string, ip: string, userAgent: string, origin?: string) {
    const transporter = this.getTransporter();
    if (!transporter) return;

    const emailLogId = `mail_login_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const subject = `[Security Alert] Privileged Account Login: ${email}`;
    const title = "Security Notification: Privileged Account Login";
    const bodyHtml = `
      <p>A privileged user account has logged in to the Adani Port Logistics console. Details of the session are listed below:</p>
      <table class="info-table">
        <tr>
          <td class="label">User Email</td>
          <td class="value">${email}</td>
        </tr>
        <tr>
          <td class="label">System Role</td>
          <td class="value"><span class="badge badge-info">${role}</span></td>
        </tr>
        <tr>
          <td class="label">IP Address</td>
          <td class="value">${ip}</td>
        </tr>
        <tr>
          <td class="label">Device Agent</td>
          <td class="value">${userAgent}</td>
        </tr>
        <tr>
          <td class="label">Timestamp</td>
          <td class="value">${new Date().toUTCString()}</td>
        </tr>
      </table>
      <p>If you did not initiate this login session, please log in to the console immediately to revoke your active credentials, configure a new password, and audit log activities.</p>
    `;

    // Save tracking log to database
    await this.logEmailRecord(emailLogId, process.env.SMTP_USER || "", subject, "SECURITY_ALERT");

    try {
      await transporter.sendMail({
        from: `"Adani Port Security" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER, // Send security notifications to system administrator
        subject: subject,
        html: this.getBrandedWrapper(title, bodyHtml, emailLogId, origin),
      });
    } catch (err) {
      console.error("Failed to send login alert email:", err);
    }
  }

  /**
   * Send an alert when a yard log entry is deleted from the database
   */
  public static async sendDeletionAlert(gpNo: string, deletedBy: string, reason: string = "Manual Admin Deletion", origin?: string) {
    const transporter = this.getTransporter();
    if (!transporter) return;

    const emailLogId = `mail_delete_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const subject = `[Audit Alert] Log Entry Deleted: ${gpNo}`;
    const title = "Audit Notification: Database Entry Deleted";
    const bodyHtml = `
      <p>A gate pass movement entry has been permanently deleted from the database by an administrator. Details below:</p>
      <table class="info-table">
        <tr>
          <td class="label">Deleted GP No</td>
          <td class="value">${gpNo}</td>
        </tr>
        <tr>
          <td class="label">Authorized By</td>
          <td class="value">${deletedBy}</td>
        </tr>
        <tr>
          <td class="label">Reason Given</td>
          <td class="value">${reason}</td>
        </tr>
        <tr>
          <td class="label">Action Type</td>
          <td class="value"><span class="badge badge-danger">PERMANENT_DELETE</span></td>
        </tr>
        <tr>
          <td class="label">Timestamp</td>
          <td class="value">${new Date().toUTCString()}</td>
        </tr>
      </table>
      <p>This action has been permanently committed to the master system audit trail.</p>
    `;

    // Save tracking log to database
    await this.logEmailRecord(emailLogId, process.env.SMTP_USER || "", subject, "AUDIT_ALERT");

    try {
      await transporter.sendMail({
        from: `"Adani Port Audit" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER,
        subject: subject,
        html: this.getBrandedWrapper(title, bodyHtml, emailLogId, origin),
      });
    } catch (err) {
      console.error("Failed to send deletion alert email:", err);
    }
  }

  /**
   * Send alert for multiple failed login attempts (potential brute force)
   */
  public static async sendBruteForceAlert(ip: string, category: string, count: number, origin?: string) {
    const transporter = this.getTransporter();
    if (!transporter) return;

    const emailLogId = `mail_spam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const subject = `[Security Warning] Rate Limiter Triggered: ${ip}`;
    const title = "Security Warning: Excessive Failed Requests";
    const bodyHtml = `
      <p>Our rate limiting system has detected suspicious request spam from a single connection source. Details below:</p>
      <table class="info-table">
        <tr>
          <td class="label">Source IP</td>
          <td class="value">${ip}</td>
        </tr>
        <tr>
          <td class="label">Action Category</td>
          <td class="value"><span class="badge badge-warning">${category}</span></td>
        </tr>
        <tr>
          <td class="label">Request Load</td>
          <td class="value">${count} requests in rate-limit window</td>
        </tr>
        <tr>
          <td class="label">Timestamp</td>
          <td class="value">${new Date().toUTCString()}</td>
        </tr>
      </table>
      <p>The connection source IP has been temporarily rate limited at the server level to prevent database resource exhaustion.</p>
    `;

    // Save tracking log to database
    await this.logEmailRecord(emailLogId, process.env.SMTP_USER || "", subject, "SECURITY_WARNING");

    try {
      await transporter.sendMail({
        from: `"Adani Port Security" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER,
        subject: subject,
        html: this.getBrandedWrapper(title, bodyHtml, emailLogId, origin),
      });
    } catch (err) {
      console.error("Failed to send brute force warning email:", err);
    }
  }

  /**
   * Send a branded Password Reset email with open tracking pixel injected
   */
  public static async sendPasswordResetEmail(email: string, resetLink: string, origin?: string): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) return false;

    const emailLogId = `mail_reset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const subject = "Configure Your Login Password - Adani Port Logistics";
    
    // Core Reset Template HTML
    const appOrigin = origin || process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://adani.veertrading.in");

    const trackingPixel = `<img src="${appOrigin}/api/system/track-email?id=${emailLogId}" width="1" height="1" style="display:none;" alt="" />`;

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Configure Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f8fafc; color: #334155; margin: 0; padding: 0; }
          .wrapper { width: 100%; background-color: #f8fafc; padding: 40px 0; }
          .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background-color: #0284c7; padding: 24px; text-align: center; }
          .header h2 { color: #ffffff; margin: 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1.5px; }
          .content { padding: 32px; }
          .content p { font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
          .btn-container { text-align: center; margin: 30px 0; }
          .btn { background-color: #0284c7; color: #ffffff !important; text-decoration: none; padding: 12px 30px; font-size: 12px; font-weight: bold; text-transform: uppercase; border-radius: 6px; display: inline-block; }
          .footer { background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <h2>Adani Port Logistics</h2>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to configure or reset the password for your Adani Port Logistics account. Click the button below to update your login credentials:</p>
              <div class="btn-container">
                <a href="${resetLink}" class="btn" target="_blank">Reset Password</a>
              </div>
              <p>If you did not make this request, you can safely ignore this email. The link will remain active for 1 hour.</p>
              <p>Regards,<br>Logistics Desk Team</p>
            </div>
            <div class="footer">
              This is an automated security broadcast. Please do not reply directly to this inbox.
            </div>
          </div>
        </div>
        ${trackingPixel}
      </body>
      </html>
    `;

    // Save tracking log to database
    await this.logEmailRecord(emailLogId, email, subject, "PASSWORD_RESET");

    try {
      await transporter.sendMail({
        from: `"Adani Port Logistics" <${process.env.SMTP_USER}>`,
        to: email,
        subject: subject,
        html: htmlTemplate,
      });
      return true;
    } catch (err) {
      console.error("Failed to send password reset email:", err);
      return false;
    }
  }
}

// 🔒 Decouple RateLimiter circular dependencies via static import callback registration
import { RateLimiter } from "./rateLimiter";
RateLimiter.setLimitListener((ip, category, count, origin) => {
  EmailService.sendBruteForceAlert(ip, category, count, origin).catch(console.error);
});

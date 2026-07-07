import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { cookies } from "next/headers";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { sanitize, sanitizeForExcel } from "@/lib/sanitizer";
import { RateLimiter } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

// Timing-safe comparison to prevent side-channel timing attacks (CWE-208)
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aHash = crypto.createHash("sha256").update(a).digest();
  const bHash = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

export async function POST(request: Request) {
  try {
    // 🛡️ Apply rate limiting (2 attempts per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 2, 60000, "send-report")) {
      return NextResponse.json(
        { error: "Too many report requests. Please wait a minute." },
        { status: 429 }
      );
    }

    // 🔒 Dual authorization check: Cookie session OR Secret token (for CRON jobs)
    let isAuthorized = false;
    let executorEmail = "System Scheduler";

    // A. Check for Secret query token
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get("cron_secret");
    const systemSecret = process.env.DEVELOPER_KEY; // 🔒 HARDENED: Removed hardcoded fallback secret (CWE-798)

    if (cronSecret && systemSecret && safeCompare(cronSecret, systemSecret)) {
      isAuthorized = true;
    } else {
      // B. Fallback to cookie authentication
      const cookieStore = await cookies();
      const token = cookieStore.get("session_token")?.value;
      if (token) {
        try {
          const decoded = await adminAuth.verifyIdToken(token);
          if (decoded.role === "superadmin") {
            isAuthorized = true;
            executorEmail = decoded.email || "System Admin";
          }
        } catch (err) {
          // Token verification failed, keep unauthorized
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Access denied. Insufficient permissions." }, { status: 403 });
    }

    // 1. Retrieve all yard logs for attachment backup
    const logsSnapshot = await adminDb.collection("yard_logs").orderBy("timestamp", "desc").get();
    const dbLogs: any[] = [];
    logsSnapshot.forEach((doc: any) => {
      const data = doc.data();
      let formattedTimestamp = "";
      if (data.timestamp) {
        if (typeof data.timestamp.toDate === "function") {
          formattedTimestamp = data.timestamp.toDate().toISOString();
        } else {
          formattedTimestamp = data.timestamp;
        }
      }
      dbLogs.push({ ...data, timestamp: formattedTimestamp });
    });

    // 2. Compile metrics for last 24 hours report
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = dbLogs.filter(log => log.timestamp && new Date(log.timestamp) >= oneDayAgo);

    // Metrics calculations
    const totalLogs = dbLogs.length;
    const submittedToday = recentLogs.length;
    
    // Active vessels count today
    const uniqueVessels = new Set(recentLogs.map(log => log.vessel_name).filter(Boolean));
    const activeVesselsCount = uniqueVessels.size;
    
    // Active surveyors count today
    const uniqueSurveyors = new Set(recentLogs.map(log => log.surveyor_name || log.surveyor_email).filter(Boolean));
    const activeSurveyorsCount = uniqueSurveyors.size;

    // 3. Generate XML Backup Spreadsheet Buffer
    const excelXmlString = generateExcelXml(dbLogs);
    const excelBuffer = Buffer.from(excelXmlString, "utf-8");

    // 4. Retrieve SMTP settings from environment variables
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";

    if (!smtpUser || !smtpPass) {
      return NextResponse.json({ error: "Mail server settings not configured." }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const dateString = new Date().toISOString().split("T")[0];
    const reportHtml = getReportHtml({
      dateString,
      submittedToday,
      totalLogs,
      activeVesselsCount,
      activeSurveyorsCount,
      executorEmail,
    });

    // 5. Deliver backup & report email to SMTP administrator
    await transporter.sendMail({
      from: `"Adani Port Logistics" <${smtpUser}>`,
      to: smtpUser, // Send to developer/admin email
      subject: `Daily Logistics Report & Database Backup [${dateString}]`,
      html: reportHtml,
      attachments: [
        {
          filename: `adani_port_database_backup_${dateString}.xls`,
          content: excelBuffer,
          contentType: "application/vnd.ms-excel",
        }
      ]
    });

    // 6. Record this backup action into system audit trails
    await adminDb.collection("audit_logs").add({
      eventType: "DATABASE_BACKUP",
      email: executorEmail,
      timestamp: new Date().toISOString(),
      metadata: {
        totalRecords: totalLogs,
        recordsToday: submittedToday,
        vesselsCount: activeVesselsCount,
        backupTriggerType: cronSecret ? "CRON_JOB" : "MANUAL_CONSOLE",
      },
      ip: "LOCAL_SERVER",
      userAgent: "Server-side Action Daemon",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Daily report compiled and spreadsheet backup emailed successfully.",
      metrics: {
        totalLogs,
        submittedToday,
        activeVesselsCount,
        activeSurveyorsCount,
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Backup report dispatch failure:", error);
    return NextResponse.json({ error: "Internal server report delivery failed." }, { status: 500 });
  }
}

// Generate the XML spreadsheet code
function generateExcelXml(logs: any[]): string {
  const tableHeader = `
    <tr style="background-color: #0284c7; color: #ffffff; font-weight: bold; font-family: sans-serif; font-size: 11px;">
      <th style="padding: 6px; border: 1px solid #cbd5e1;">SR. NO.</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1;">GATE PASS NO (GP NO)</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1;">TRUCK NO</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1;">VESSEL NAME</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1;">COMMODITY</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1;">RECEIVER PARTY</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1;">YARD LOCATION</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1;">BILL OF ENTRY (BOE) NO</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1;">TIMESTAMP</th>
      <th style="padding: 6px; border: 1px solid #cbd5e1;">SURVEYOR</th>
    </tr>
  `;

  const tableRows = logs.map((log, index) => {
    // 🔒 HARDENED: Sanitize exported values against Excel formula injection and XML injection (CWE-1236, CWE-79)
    const gp = sanitizeForExcel(sanitize(log.gp_no || ""));
    const truck = sanitizeForExcel(sanitize(log.truck_no || ""));
    const vessel = sanitizeForExcel(sanitize(log.vessel_name || ""));
    const commodity = sanitizeForExcel(sanitize(log.commodity || ""));
    const receiver = sanitizeForExcel(sanitize(log.receiver_party || ""));
    const yard = sanitizeForExcel(sanitize(log.yard_location || ""));
    const boe = sanitizeForExcel(sanitize(log.boe_no || ""));
    const surveyor = sanitizeForExcel(sanitize(log.surveyor_name || ""));
    const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleString() : "";

    return `
      <tr style="font-family: sans-serif; font-size: 11px;">
        <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0; mso-number-format:'\\@'; font-weight: bold;">${gp}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0; mso-number-format:'\\@'; font-weight: bold;">${truck}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0;">${vessel}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0;">${commodity}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0;">${receiver}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0; mso-number-format:'\\@';">${yard}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0; mso-number-format:'\\@';">${boe}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0;">${dateStr}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0;">${surveyor}</td>
      </tr>
    `;
  }).join("");

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Complete Database Backup</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta charset="UTF-8">
    </head>
    <body>
      <table border="1" style="border-collapse: collapse; border: 1px solid #cbd5e1;">
        <thead>${tableHeader}</thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body>
    </html>
  `;
}

// Generate the HTML report layout
interface ReportParams {
  dateString: string;
  submittedToday: number;
  totalLogs: number;
  activeVesselsCount: number;
  activeSurveyorsCount: number;
  executorEmail: string;
}

function getReportHtml(p: ReportParams): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Logistics Daily Report</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f8fafc; color: #334155; margin: 0; padding: 0; }
        .wrapper { width: 100%; background-color: #f8fafc; padding: 40px 0; }
        .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background-color: #0284c7; padding: 24px; text-align: center; }
        .header h2 { color: #ffffff; margin: 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1.5px; }
        .content { padding: 32px; }
        .content h3 { font-size: 14px; text-transform: uppercase; color: #0f172a; margin-top: 0; border-b: 1px solid #f1f5f9; padding-bottom: 8px; }
        .metric-grid { display: table; width: 100%; margin: 20px 0; border-collapse: separate; border-spacing: 10px; }
        .metric-card { display: table-cell; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; text-align: center; width: 25%; }
        .metric-val { font-size: 20px; font-weight: bold; color: #0284c7; margin-bottom: 4px; }
        .metric-lbl { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; }
        .footer { background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <h2>Logistics Backup Report</h2>
          </div>
          <div class="content">
            <h3>Port Activity Summary: ${p.dateString}</h3>
            <p>Hello Administrator,</p>
            <p>The daily database backup daemon has successfully compiled the Logistics activity report. The complete database spreadsheet has been compiled and is attached to this email.</p>
            
            <div class="metric-grid">
              <div class="metric-card">
                <div class="metric-val">${p.submittedToday}</div>
                <div class="metric-lbl">Logs Today</div>
              </div>
              <div class="metric-card">
                <div class="metric-val">${p.totalLogs}</div>
                <div class="metric-lbl">Total Logs</div>
              </div>
              <div class="metric-card">
                <div class="metric-val">${p.activeVesselsCount}</div>
                <div class="metric-lbl">Active Vessels</div>
              </div>
              <div class="metric-card">
                <div class="metric-val">${p.activeSurveyorsCount}</div>
                <div class="metric-lbl">Active Staff</div>
              </div>
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
              Backup Job Initiator: <strong>${p.executorEmail}</strong>
            </p>
          </div>
          <div class="footer">
            This is an automated system task. Please archive the attached .xls backup file in your records database.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

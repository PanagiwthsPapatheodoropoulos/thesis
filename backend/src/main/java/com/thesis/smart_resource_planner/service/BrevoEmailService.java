package com.thesis.smart_resource_planner.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class BrevoEmailService {

    private static final String BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

    private final RestTemplate restTemplate;

    @Value("${BREVO_API_KEY:}")
    private String apiKey;

    @Value("${BREVO_SENDER_EMAIL:noreply@smartallocation.com}")
    private String senderEmail;

    @Value("${BREVO_SENDER_NAME:Smart Allocation}")
    private String senderName;

    /**
     * Sends the company join code to a specific email address (admin share feature).
     */
    public void sendCompanyJoinCode(String toEmail, String adminUsername, String companyName, String joinCode) {
        if (!StringUtils.hasText(apiKey)) {
            log.warn("Brevo API key missing; skipping join code email.");
            return;
        }

        String safeCompanyName = companyName != null ? companyName : "your company";
        String subject = "Your company join code – " + safeCompanyName;
        String htmlContent = buildJoinCodeHtml(adminUsername, safeCompanyName, joinCode);
        sendEmail(toEmail, adminUsername, subject, htmlContent);
    }

    /**
     * Sends a rich welcome email to a new administrator right after company creation.
     * The email emphasises that the join code is sensitive and must be kept safe.
     */
    public void sendCompanyWelcomeEmail(String toEmail, String adminUsername, String companyName, String joinCode) {
        if (!StringUtils.hasText(apiKey)) {
            log.warn("Brevo API key missing; skipping company welcome email.");
            return;
        }

        String safeCompanyName = companyName != null ? companyName : "your company";
        String subject = "🎉 Welcome to Smart Allocation – Your company is ready!";
        String htmlContent = buildWelcomeHtml(adminUsername, safeCompanyName, joinCode);
        sendEmail(toEmail, adminUsername, subject, htmlContent);
    }

    /**
     * Sends a confirmation email to a user after they submit a join request.
     */
    public void sendJoinRequestConfirmation(String toEmail, String username, String companyName) {
        if (!StringUtils.hasText(apiKey)) {
            log.warn("Brevo API key missing; skipping join request confirmation email.");
            return;
        }

        String safeCompanyName = companyName != null ? companyName : "the company";
        String subject = "📋 Join Request Received – " + safeCompanyName;
        String htmlContent = "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:auto;line-height:1.6\">"
                + "<div style=\"background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;border-radius:12px 12px 0 0;text-align:center\">"
                + "<h2 style=\"color:white;margin:0\">📋 Join Request Submitted</h2>"
                + "</div>"
                + "<div style=\"background:#ffffff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb\">"
                + "<p style=\"font-size:16px\">Hi <strong>" + username + "</strong>,</p>"
                + "<p>Your request to join <strong>" + safeCompanyName + "</strong> has been received.</p>"
                + "<div style=\"background:#eff6ff;border-left:4px solid #3b82f6;padding:16px;border-radius:4px;margin:20px 0\">"
                + "<p style=\"margin:0;color:#1e40af;font-weight:bold\">⏳ What's next?</p>"
                + "<p style=\"margin:8px 0 0 0;color:#1e40af;font-size:14px\">"
                + "A company administrator or manager will review your request. Once approved, you'll receive "
                + "a notification and full access to the platform.</p>"
                + "</div>"
                + "<p style=\"color:#6b7280;font-size:14px\">You can log in at any time to check your status.</p>"
                + "<p style=\"margin-top:24px\">Best regards,<br/><strong>Smart Allocation Team</strong></p>"
                + "</div></div>";

        sendEmail(toEmail, username, subject, htmlContent);
    }

    /**
     * Sends an email when an admin creates an employee profile for a user.
     */
    public void sendEmployeeApprovedEmail(String toEmail, String username, String companyName) {
        if (!StringUtils.hasText(apiKey)) {
            log.warn("Brevo API key missing; skipping employee approval email.");
            return;
        }

        String safeCompanyName = companyName != null ? companyName : "your company";
        String subject = "🎉 Welcome aboard – " + safeCompanyName;
        String htmlContent = "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:auto;line-height:1.6\">"
                + "<div style=\"background:linear-gradient(135deg,#059669,#10b981);padding:24px;border-radius:12px 12px 0 0;text-align:center\">"
                + "<h2 style=\"color:white;margin:0\">🎉 You've Been Approved!</h2>"
                + "</div>"
                + "<div style=\"background:#ffffff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb\">"
                + "<p style=\"font-size:16px\">Hi <strong>" + username + "</strong>,</p>"
                + "<p>Great news! Your request to join <strong>" + safeCompanyName + "</strong> has been approved.</p>"
                + "<p>An employee profile has been created for you. Please <strong>log out and log back in</strong> to access all features.</p>"
                + "<div style=\"background:#ecfdf5;border-left:4px solid #10b981;padding:16px;border-radius:4px;margin:20px 0\">"
                + "<p style=\"margin:0;color:#065f46;font-weight:bold\">✅ Next steps:</p>"
                + "<ol style=\"color:#065f46;font-size:14px;margin-top:8px\">"
                + "<li>Log out and log back in to refresh your session</li>"
                + "<li>Complete your employee profile</li>"
                + "<li>Explore your tasks and team assignments</li>"
                + "</ol></div>"
                + "<p style=\"margin-top:24px\">Best regards,<br/><strong>Smart Allocation Team</strong></p>"
                + "</div></div>";

        sendEmail(toEmail, username, subject, htmlContent);
    }

    /**
     * Sends an email when a user is dismissed (soft-removed) from a company.
     */
    public void sendDismissalEmail(String toEmail, String username, String companyName) {
        if (!StringUtils.hasText(apiKey)) {
            log.warn("Brevo API key missing; skipping dismissal email.");
            return;
        }

        String safeCompanyName = companyName != null ? companyName : "the company";
        String subject = "Company Access Update – " + safeCompanyName;
        String htmlContent = "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:auto;line-height:1.6\">"
                + "<div style=\"background:linear-gradient(135deg,#d97706,#f59e0b);padding:24px;border-radius:12px 12px 0 0;text-align:center\">"
                + "<h2 style=\"color:white;margin:0\">Company Access Update</h2>"
                + "</div>"
                + "<div style=\"background:#ffffff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb\">"
                + "<p style=\"font-size:16px\">Hi <strong>" + username + "</strong>,</p>"
                + "<p>Your access to <strong>" + safeCompanyName + "</strong> has been removed by an administrator.</p>"
                + "<div style=\"background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;border-radius:4px;margin:20px 0\">"
                + "<p style=\"margin:0;color:#92400e;font-weight:bold\">What does this mean?</p>"
                + "<p style=\"margin:8px 0 0 0;color:#92400e;font-size:14px\">"
                + "Your account is still active. You can join another company or create your own by logging in "
                + "and using the Company Setup page.</p>"
                + "</div>"
                + "<p style=\"color:#6b7280;font-size:14px\">If you believe this was a mistake, please contact the company administrator.</p>"
                + "<p style=\"margin-top:24px\">Best regards,<br/><strong>Smart Allocation Team</strong></p>"
                + "</div></div>";

        sendEmail(toEmail, username, subject, htmlContent);
    }

    /**
     * Sends an email when a user is blocked from a company.
     */
    public void sendBlockedEmail(String toEmail, String username, String companyName) {
        if (!StringUtils.hasText(apiKey)) {
            log.warn("Brevo API key missing; skipping blocked email.");
            return;
        }

        String safeCompanyName = companyName != null ? companyName : "the company";
        String subject = "Access Denied – " + safeCompanyName;
        String htmlContent = "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:auto;line-height:1.6\">"
                + "<div style=\"background:linear-gradient(135deg,#dc2626,#ef4444);padding:24px;border-radius:12px 12px 0 0;text-align:center\">"
                + "<h2 style=\"color:white;margin:0\">Access Denied</h2>"
                + "</div>"
                + "<div style=\"background:#ffffff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb\">"
                + "<p style=\"font-size:16px\">Hi <strong>" + username + "</strong>,</p>"
                + "<p>Your access to <strong>" + safeCompanyName + "</strong> has been permanently revoked by an administrator.</p>"
                + "<div style=\"background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:4px;margin:20px 0\">"
                + "<p style=\"margin:0;color:#991b1b;font-weight:bold\">What does this mean?</p>"
                + "<p style=\"margin:8px 0 0 0;color:#991b1b;font-size:14px\">"
                + "Your email address has been added to the company's blocklist and you will not be able to "
                + "re-join this company. Your account remains active — you can still join other companies or create your own.</p>"
                + "</div>"
                + "<p style=\"color:#6b7280;font-size:14px\">If you believe this was an error, please contact the company administrator directly.</p>"
                + "<p style=\"margin-top:24px\">Best regards,<br/><strong>Smart Allocation Team</strong></p>"
                + "</div></div>";

        sendEmail(toEmail, username, subject, htmlContent);
    }

    // ── private helpers ──────────────────────────────────────────────────────────

    private void sendEmail(String toEmail, String toName, String subject, String htmlContent) {
        Map<String, Object> payload = Map.of(
                "sender", Map.of("email", senderEmail, "name", senderName),
                "to", List.of(Map.of("email", toEmail, "name", toName != null ? toName : toEmail)),
                "subject", subject,
                "htmlContent", htmlContent);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("api-key", apiKey);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    BREVO_API_URL, HttpMethod.POST, entity, String.class);
            log.info("Brevo email sent to {} with status: {}", toEmail, response.getStatusCode());
        } catch (Exception e) {
            log.warn("Brevo email to {} failed: {}", toEmail, e.getMessage());
        }
    }

    private String buildJoinCodeHtml(String username, String companyName, String joinCode) {
        return "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:auto;line-height:1.6\">"
                + "<h2 style=\"color:#4f46e5\">Company Join Code – " + companyName + "</h2>"
                + "<p>Hi " + username + ",</p>"
                + "<p>Here is the join code for <strong>" + companyName + "</strong>. "
                + "Share it only with people you want to invite to your company.</p>"
                + "<div style=\"background:#f3f4f6;border:2px dashed #4f46e5;border-radius:8px;"
                + "padding:20px;text-align:center;margin:20px 0\">"
                + "<p style=\"font-size:28px;font-weight:bold;letter-spacing:6px;color:#4f46e5;margin:0\">"
                + joinCode + "</p>"
                + "</div>"
                + "<p style=\"color:#dc2626;font-weight:bold\">⚠️ Do not share this code with people outside your company.</p>"
                + "<p>Thanks,<br/><strong>Smart Allocation Team</strong></p>"
                + "</div>";
    }

    private String buildWelcomeHtml(String username, String companyName, String joinCode) {
        return "<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:auto;line-height:1.6\">"
                + "<div style=\"background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:30px;border-radius:12px 12px 0 0;text-align:center\">"
                + "<h1 style=\"color:white;margin:0\">🎉 Welcome to Smart Allocation!</h1>"
                + "</div>"
                + "<div style=\"background:#ffffff;padding:30px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb\">"
                + "<p style=\"font-size:16px\">Hi <strong>" + username + "</strong>,</p>"
                + "<p>Congratulations! Your company <strong>" + companyName + "</strong> has been successfully created "
                + "on the Smart Allocation platform.</p>"
                + "<p>You are now the <strong>Administrator</strong> of your organisation. "
                + "Your employees can join by using the company join code below when they register.</p>"
                + "<div style=\"background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:20px;margin:24px 0;text-align:center\">"
                + "<p style=\"margin:0 0 8px 0;color:#92400e;font-weight:bold;font-size:13px\">YOUR COMPANY JOIN CODE</p>"
                + "<p style=\"font-size:32px;font-weight:bold;letter-spacing:8px;color:#d97706;margin:0\">"
                + joinCode + "</p>"
                + "</div>"
                + "<div style=\"background:#fee2e2;border-left:4px solid #dc2626;padding:16px;border-radius:4px;margin-bottom:24px\">"
                + "<p style=\"margin:0;color:#991b1b;font-weight:bold\">🔒 Important – Keep this email safe!</p>"
                + "<p style=\"margin:8px 0 0 0;color:#b91c1c;font-size:14px\">"
                + "This join code grants access to your company workspace. "
                + "<strong>Do not share it with people outside your organisation.</strong> "
                + "You can regenerate the code at any time from Settings → Security in the platform.</p>"
                + "</div>"
                + "<h3 style=\"color:#4f46e5\">Next steps:</h3>"
                + "<ol style=\"color:#374151\">"
                + "<li>Log in to Smart Allocation and complete your company profile</li>"
                + "<li>Share the join code with your team members</li>"
                + "<li>Approve their join requests from the Employees page</li>"
                + "<li>Start creating tasks and managing workloads</li>"
                + "</ol>"
                + "<p style=\"margin-top:24px\">Best regards,<br/><strong>Smart Allocation Team</strong></p>"
                + "</div>"
                + "</div>";
    }
}


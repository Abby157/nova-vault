// Load jsPDF from CDN once, shared across any screen that needs to
// generate a PDF transaction receipt.
let jsPDFPromise = null;
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
  if (jsPDFPromise) return jsPDFPromise;
  jsPDFPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return jsPDFPromise;
}

export async function downloadReceipt(tx, uid, userEmail) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const gold = [232, 98, 26];
  const dark = [20, 20, 20];
  const muted = [120, 120, 120];

  const isReceive = tx.toUid === uid && tx.fromUid !== uid;
  const isWithdraw = tx.type === "withdrawal";
  const typeLabel = isWithdraw ? "Withdrawal" : isReceive ? "Received" : tx.type === "swap" ? "Swap" : tx.type === "buy" ? "Buy" : tx.type === "sell" ? "Sell" : "Sent";

  const formatDate = (ts) => {
    if (!ts) return new Date().toLocaleString();
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
  };

  // Header
  doc.setFillColor(...dark);
  doc.rect(0, 0, 595, 90, "F");
  doc.setTextColor(...gold);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("NOVA VAULT", 40, 45);
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text("PRIVATE BANKING · TRANSACTION RECEIPT", 40, 62);

  // Body
  let y = 130;
  doc.setTextColor(...dark);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${typeLabel} Confirmation`, 40, y);

  y += 10;
  doc.setDrawColor(...gold);
  doc.setLineWidth(1.2);
  doc.line(40, y, 555, y);

  y += 30;
  const rows = [
    ["Reference Number", tx.refNumber || tx.id || "—"],
    ["Date Submitted", formatDate(tx.createdAt)],
    ["Status", (tx.status || "completed").toUpperCase()],
    ["Amount", `$${Number(tx.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`],
    ["Account Holder", userEmail || "—"],
  ];

  if (isWithdraw) {
    rows.push(["Destination Wallet", tx.toEmail || "—"]);
    rows.push(["Method", "Crypto Withdrawal"]);
    if (tx.status === "approved") {
      rows.push(["Approved By", "NOVA Vault Compliance Team"]);
      rows.push(["Approval Date", formatDate(tx.approvedAt || tx.createdAt)]);
    } else if (tx.status === "rejected") {
      rows.push(["Rejected Date", formatDate(tx.rejectedAt || tx.createdAt)]);
    } else {
      rows.push(["Est. Completion", "1–3 business days from submission"]);
    }
  } else if (isReceive) {
    rows.push(["From", tx.fromName || tx.fromEmail || "—"]);
  } else if (tx.type === "send") {
    rows.push(["To", tx.toName || tx.toEmail || "—"]);
  } else {
    rows.push(["Description", tx.note || "—"]);
  }

  doc.setFontSize(11);
  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text(label, 40, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    const valStr = String(value);
    doc.text(valStr, 555, y, { align: "right" });
    y += 26;
  });

  // Verification stamp for approved/completed transactions
  if (tx.status === "approved" || tx.status === "completed") {
    doc.setDrawColor(...gold);
    doc.setLineWidth(2);
    doc.roundedRect(400, y - 10, 155, 50, 4, 4);
    doc.setTextColor(...gold);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("✓ VERIFIED", 477, y + 12, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("NOVA VAULT COMPLIANCE", 477, y + 24, { align: "center" });
    y += 60;
  } else {
    y += 20;
  }

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(40, y, 555, y);

  y += 30;
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.text("This is an official transaction receipt issued by NOVA Vault. Please retain for your records.", 40, y, { maxWidth: 515 });
  y += 16;
  doc.text(`Generated on ${new Date().toLocaleString()}`, 40, y);

  // Footer
  doc.setFillColor(...dark);
  doc.rect(0, 780, 595, 62, "F");
  doc.setTextColor(...gold);
  doc.setFontSize(9);
  doc.text("NOVA VAULT · PRIVATE BANKING · novavault.io", 40, 812);

  doc.save(`NOVA-Receipt-${tx.refNumber || tx.id}.pdf`);
}

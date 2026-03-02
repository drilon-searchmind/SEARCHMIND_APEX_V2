import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/**
 * Export a React-rendered report element to PDF.
 * @param {HTMLElement} element - The DOM element to capture (e.g. from PdfReportContent)
 * @param {string} filename - Output filename (without .pdf)
 */
export async function exportElementToPdf(element, filename = "report") {
  if (!element) return;
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let position = 0;
  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  let heightLeft = imgHeight - pageHeight;
  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  const safeFilename = (filename || "report").replace(/_+/g, "_").replace(/^_|_$/g, "") || "report";
  pdf.save(`${safeFilename}.pdf`);
}

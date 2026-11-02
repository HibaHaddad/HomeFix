import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { dateLabel, money } from "@/lib/client-domain";

type Receipt = {
  id: number;
  title: string;
  client: string;
  professional: string;
  address: string;
  details: string;
  createdAt: Date;
  paidAt: Date | null;
  receiptNumber: string | null;
  totalMillimes: number;
  paidMillimes: number;
  testPaid: boolean;
};

let fonts: Promise<Buffer[]> | undefined;
function loadFonts() {
  return fonts ??= Promise.all(["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"].map(name => readFile(path.join(process.cwd(), "assets", "fonts", name))));
}

export async function createReceiptPdf(receipt: Receipt) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Reçu de paiement HomeFix TN · ${receipt.id}`);
  doc.setAuthor("HomeFix TN");
  doc.setLanguage("fr-TN");
  const bytes = await loadFonts();
  const regular = await doc.embedFont(bytes[0], { subset: true });
  const bold = await doc.embedFont(bytes[1], { subset: true });
  const green = rgb(.09, .30, .24), muted = rgb(.42, .48, .44), line = rgb(.86, .90, .85);
  let page = doc.addPage([595.28, 841.89]);
  let y = 790;
  const left = 48, width = 499;
  const clean = (value: string) => value.normalize("NFC").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
  function nextPage() { page = doc.addPage([595.28, 841.89]); y = 790; }
  function room(height: number) { if (y - height < 70) nextPage(); }
  function text(value: string, size = 11, font: PDFFont = regular, color = green) {
    // Wrap on words and split long tokens: user-entered content must never
    // overlap totals or run outside the printable page.
    for (const paragraph of clean(value).split(/\r?\n/)) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) { current = candidate; continue; }
        if (current) { room(size * 1.6); page.drawText(current, { x: left, y, size, font, color }); y -= size * 1.6; current = ""; }
        for (const char of word) {
          if (font.widthOfTextAtSize(current + char, size) > width) { room(size * 1.6); page.drawText(current, { x: left, y, size, font, color }); y -= size * 1.6; current = ""; }
          current += char;
        }
      }
      room(size * 1.6);
      if (current) page.drawText(current, { x: left, y, size, font, color });
      y -= size * 1.6;
    }
  }
  text("homefix", 28, bold);
  text("TN  ·  Votre maison, simplement.", 9, regular, muted);
  y -= 25;
  text("REÇU DE PAIEMENT", 19, bold);
  text(`Émis le ${dateLabel(receipt.createdAt)}`, 10, regular, muted);
  y -= 20;
  text(receipt.title, 16, bold);
  y -= 15;
  text(`Client : ${receipt.client}`);
  if (receipt.address) text(`Adresse : ${receipt.address}`);
  text(`Professionnel : ${receipt.professional}`);
  y -= 20;
  if (receipt.details) { text(receipt.details, 11, regular, muted); y -= 20; }
  room(165);
  page.drawRectangle({ x: left, y: y - 131, width, height: 146, color: rgb(.95, .97, .93) });
  y -= 12;
  for (const [label, amount, emphasis] of [
    ["Prix final accepté", receipt.totalMillimes, false],
    [receipt.testPaid ? "Montant validé en test" : "Montant payé", receipt.paidMillimes, true],
    ["Solde à régler", receipt.totalMillimes - receipt.paidMillimes, false],
  ] as const) {
    const font = emphasis ? bold : regular, size = emphasis ? 13 : 11;
    const amountText = money(amount);
    page.drawText(label, { x: left + 18, y, size, font, color: green });
    page.drawText(amountText, { x: left + width - 18 - font.widthOfTextAtSize(amountText, size), y, size, font, color: green });
    y -= 39;
  }
  y -= 30;
  if (receipt.paidAt) text(`Réglé le ${dateLabel(receipt.paidAt)}`, 10, regular, muted);
  if (receipt.receiptNumber) text(`Référence du reçu : ${receipt.receiptNumber}`, 10, regular, muted);
  const pages = doc.getPages();
  for (const [index, p] of pages.entries()) {
    p.drawLine({ start: { x: left, y: 48 }, end: { x: left + width, y: 48 }, thickness: .7, color: line });
    p.drawText("HomeFix TN", { x: left, y: 30, font: regular, size: 9, color: muted });
    p.drawText(`${index + 1} / ${pages.length}`, { x: 515, y: 30, font: regular, size: 9, color: muted });
  }
  return doc.save();
}

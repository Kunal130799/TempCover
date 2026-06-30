import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

export const CERTIFICATES_DIR = path.join(process.cwd(), "certificates");

export interface CertificateData {
  certificateNumber: string;
  policyNumber: string;
  /** Registration mark, display form with a space e.g. "NV19 WMK" */
  registrationMark: string;
  policyholderName: string;
  make: string;
  model: string;
  colour: string;
  fuelType: string;
  /** year of manufacture, may be empty if unknown */
  year: string;
  effectiveDate: Date;
  expiryDate: Date;
  issuedDate: Date;
}

// Company details from the reference certificate. These are part of the demo
// document format — the UI carries a prominent disclaimer that this is NOT a
// real, authorised insurance product.
const COMPANY = {
  name: "TempDrive Insurance Services Ltd",
  addressLine: "120 High Holborn, London WC1V 6RD",
  webEmail: "www.tempdrive.uk · hello@tempdrive.uk",
  registration: "Co. No. 07423891 · FCA ref 412345",
};

const DRIVE_ENTITLEMENT_NOTE =
  "Provided the person driving holds a licence to drive the vehicle or has held and is not disqualified from holding or obtaining such a licence.";

const LIMITATIONS = [
  "1. Use for social, domestic and pleasure purposes by the policyholder.",
  "2. Use for commuting to and from a single permanent place of work.",
  "3. The vehicle is driven within the territorial limits of this policy (Great Britain, Northern Ireland, the Isle of Man, the Islands of Guernsey, Jersey and Alderney).",
  "4. This policy does not cover use on the Nürburgring Nordschleife, racing, competitions, speed testing, rallies, track days, 4x4 off-road events or trials, any purpose in connection with the motor trade, hiring or the carriage of passengers for hire and reward.",
].join("\n");

const CERTIFY_STATEMENT =
  "We hereby certify that the policy to which this certificate relates satisfies the requirements of the relevant law applicable in Great Britain, Northern Ireland, the Isle of Man and the Islands of Guernsey, Jersey and Alderney.";

const IMPORTANT_NOTES = [
  "This certificate gives evidence of insurance cover to comply with the law — refer to the policy wording and schedule for full details of the cover.",
  "Unless stated otherwise in paragraph 5, this policy does not cover the policyholder to drive any vehicle other than the one specified in paragraph 1. Where paragraph 5 allows driving a vehicle not belonging or hired to them, cover is limited to Third Party only.",
  "This certificate takes the place of an International Motor Insurance Card (Green Card) for any EU member country, Andorra, Croatia, Iceland, Liechtenstein, Norway, Serbia and Switzerland.",
  "Advice to third parties: nothing in this certificate affects your right as a third party to make a claim.",
];

const FOOTER_FINE_PRINT =
  "TempDrive is a trading name of TempDrive Insurance Services Ltd (registered in England and Wales, Co. No. 07423891). Registered Office: 120 High Holborn, London WC1V 6RD. Authorised and regulated by the Financial Conduct Authority — firm reference 412345. Underwritten by ERS Syndicate Management Limited, a Lloyd's syndicate.";

// Palette pulled from the reference certificate.
const NAVY = "#0b1437";
const BLUE = "#2563eb";
const INK = "#111827";
const MUTED = "#6b7280";
const RULE = "#e5e7eb";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** DD/MM/YYYY HH:MM (24h, UK style) */
export function formatDateTime(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** e.g. "22 April 2026" */
export function formatIssued(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function certificatePath(certificateNumber: string): string {
  const safe = certificateNumber.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(CERTIFICATES_DIR, `${safe}.pdf`);
}

export function certificateExists(certificateNumber: string): boolean {
  return fs.existsSync(certificatePath(certificateNumber));
}

// To guard against double-generation when the user refreshes /success, we write
// a small pointer keyed by the Stripe session id recording which certificate
// was issued. On refresh we reuse it instead of generating + emailing again.
export interface SessionPointer {
  certificateNumber: string;
  policyNumber: string;
  emailed: boolean;
}

function pointerPath(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(CERTIFICATES_DIR, `session-${safe}.json`);
}

export function readSessionPointer(sessionId: string): SessionPointer | null {
  try {
    const raw = fs.readFileSync(pointerPath(sessionId), "utf8");
    return JSON.parse(raw) as SessionPointer;
  } catch {
    return null;
  }
}

export function writeSessionPointer(
  sessionId: string,
  pointer: SessionPointer
): void {
  fs.mkdirSync(CERTIFICATES_DIR, { recursive: true });
  fs.writeFileSync(pointerPath(sessionId), JSON.stringify(pointer, null, 2));
}

const LEFT = 50;
const RIGHT = 545;
const WIDTH = RIGHT - LEFT; // 495

/**
 * Render the certificate PDF and write it to /certificates. Resolves with the
 * file path once fully flushed to disk.
 */
export function generateCertificatePdf(
  data: CertificateData
): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(CERTIFICATES_DIR, { recursive: true });

    const filePath = certificatePath(data.certificateNumber);
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = fs.createWriteStream(filePath);

    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);

    // ---- Header band ------------------------------------------------------
    const headerH = 92;
    doc.rect(0, 0, doc.page.width, headerH).fill(NAVY);

    // TD badge
    doc.roundedRect(LEFT, 26, 40, 40, 6).fill(BLUE);
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("TD", LEFT, 38, { width: 40, align: "center" });

    // Brand name + tagline
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("TempDrive", LEFT + 52, 30);
    doc
      .fillColor("#c7d2fe")
      .font("Helvetica")
      .fontSize(9.5)
      .text("Temporary motor insurance, done properly.", LEFT + 52, 58);

    // Company block (right aligned)
    const cBlockX = 320;
    const cBlockW = RIGHT - cBlockX;
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .text(COMPANY.name, cBlockX, 26, { width: cBlockW, align: "right" });
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(8);
    doc.text(COMPANY.addressLine, cBlockX, 40, {
      width: cBlockW,
      align: "right",
    });
    doc.text(COMPANY.webEmail, cBlockX, 51, { width: cBlockW, align: "right" });
    doc.text(COMPANY.registration, cBlockX, 62, {
      width: cBlockW,
      align: "right",
    });

    // Blue accent rule under header
    doc.rect(0, headerH, doc.page.width, 4).fill(BLUE);

    // ---- Title ------------------------------------------------------------
    let y = headerH + 20;
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(23)
      .text("Certificate of Motor Insurance", LEFT, y);
    y = doc.y + 3;

    const subtitleParts = [
      "Issued under the Road Traffic Act 1988",
      data.make,
      data.colour,
      data.year,
      data.fuelType,
    ].filter(Boolean);
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9.5)
      .text(subtitleParts.join("  ·  "), LEFT, y);
    y = doc.y + 10;

    // ---- Reference box (policy / cert / issued) --------------------------
    const boxPadY = 14;
    const boxH = 50;
    doc
      .roundedRect(LEFT, y, WIDTH, boxH, 6)
      .fillAndStroke("#f8fafc", RULE);

    const colW = WIDTH / 3;
    const refs: [string, string][] = [
      ["POLICY NUMBER", data.policyNumber],
      ["CERTIFICATE NUMBER", data.certificateNumber],
      ["ISSUED", formatIssued(data.issuedDate)],
    ];
    refs.forEach(([label, value], i) => {
      const x = LEFT + 16 + i * colW;
      const w = colW - 16;
      doc
        .fillColor(MUTED)
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .text(label, x, y + boxPadY - 4, { width: w });
      doc
        .fillColor(INK)
        .font("Helvetica-Bold")
        .fontSize(12.5)
        .text(value, x, y + boxPadY + 9, { width: w });
    });
    y += boxH + 12;

    // ---- Numbered field rows ---------------------------------------------
    const numX = LEFT;
    const labelX = LEFT + 22;
    const labelW = 210;
    const valX = LEFT + 250;
    const valW = RIGHT - valX;

    type Row = { n: number; label: string; value: string; extra?: string };
    const rows: Row[] = [
      { n: 1, label: "Registration Mark of Vehicle", value: data.registrationMark },
      { n: 2, label: "Name of Policy Holder", value: data.policyholderName },
      {
        n: 3,
        label:
          "Effective date of the commencement of insurance for the purposes of the relevant law",
        value: formatDateTime(data.effectiveDate),
      },
      {
        n: 4,
        label: "Date of expiry of insurance",
        value: formatDateTime(data.expiryDate),
      },
      {
        n: 5,
        label: "Persons or classes of persons entitled to drive",
        value: data.policyholderName,
        extra: DRIVE_ENTITLEMENT_NOTE,
      },
      {
        n: 6,
        label: "Limitations as to use",
        value: LIMITATIONS,
      },
    ];

    const drawRowRule = (atY: number) =>
      doc.moveTo(LEFT, atY).lineTo(RIGHT, atY).strokeColor(RULE).lineWidth(1).stroke();

    drawRowRule(y);
    rows.forEach((row) => {
      const rowTop = y + 7;

      // number
      doc
        .fillColor(BLUE)
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .text(`${row.n}.`, numX, rowTop, { width: 18, align: "left" });

      // label
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5);
      const labelH = doc.heightOfString(row.label, { width: labelW });
      doc.text(row.label, labelX, rowTop, { width: labelW });

      // value (+ optional extra paragraph)
      doc.fillColor(INK).font("Helvetica").fontSize(9.5);
      const valueH = doc.heightOfString(row.value, { width: valW });
      doc.text(row.value, valX, rowTop, { width: valW });
      let valBottom = rowTop + valueH;
      if (row.extra) {
        doc.fillColor("#374151").font("Helvetica").fontSize(9);
        const extraTop = valBottom + 6;
        const extraH = doc.heightOfString(row.extra, { width: valW });
        doc.text(row.extra, valX, extraTop, { width: valW });
        valBottom = extraTop + extraH;
      }

      const rowBottom = Math.max(rowTop + labelH, valBottom) + 8;
      y = rowBottom;
      drawRowRule(y);
    });

    // ---- Certify statement ------------------------------------------------
    y += 9;
    doc
      .fillColor("#374151")
      .font("Helvetica")
      .fontSize(9)
      .text(CERTIFY_STATEMENT, LEFT, y, { width: WIDTH });
    y = doc.y + 8;

    // ---- Signature --------------------------------------------------------
    doc
      .fillColor(INK)
      .font("Helvetica-BoldOblique")
      .fontSize(17)
      .text("Marcus Whitfield", LEFT, y);
    y = doc.y + 1;
    doc.moveTo(LEFT, y).lineTo(LEFT + 190, y).strokeColor("#9ca3af").lineWidth(1).stroke();
    y += 3;
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("Marcus Whitfield", LEFT, y);
    y = doc.y + 1;
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8.5)
      .text(
        "Chief Underwriting Officer · TempDrive Insurance Services Ltd · Authorised Insurers",
        LEFT,
        y,
        { width: WIDTH }
      );
    y = doc.y + 10;

    // ---- Important notes --------------------------------------------------
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10.5).text("Important Notes", LEFT, y);
    y = doc.y + 5;
    doc.font("Helvetica").fontSize(8).fillColor("#374151");
    IMPORTANT_NOTES.forEach((note) => {
      const bulletY = doc.y;
      doc.text("•", LEFT, bulletY, { width: 12 });
      doc.text(note, LEFT + 14, bulletY, { width: WIDTH - 14 });
      doc.moveDown(0.3);
    });

    // ---- Footer fine print ------------------------------------------------
    y = doc.y + 8;
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(RULE).lineWidth(1).stroke();
    y += 8;
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7.5)
      .text(FOOTER_FINE_PRINT, LEFT, y, { width: WIDTH });
    doc.moveDown(0.6);
    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("Customer Service: hello@tempdrive.uk", LEFT, doc.y, { width: WIDTH });

    doc.end();
  });
}

/** Generate a policy number like TD-NV19WMK-ALOPNP (6 uppercase letters). */
export function makePolicyNumber(vrmCompact: string): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += letters[Math.floor(Math.random() * letters.length)];
  }
  return `TD-${vrmCompact}-${suffix}`;
}

/** Generate a certificate number like TDV373691 (6 digits). */
export function makeCertificateNumber(): string {
  const n = 100000 + Math.floor(Math.random() * 900000);
  return `TDV${n}`;
}

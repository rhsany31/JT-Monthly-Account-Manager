import { jsPDF } from "jspdf";
import { Ticket } from "../types";

// Phonetic Bengali to English Transliterator for PDF safe rendering
function translitBengaliToEnglish(text: string | undefined | null): string {
  if (!text) return "";
  
  // 1. Direct dictionary lookup for common travel fields and terminologies
  const dictionary: Record<string, string> = {
    // Cities/Countries
    "ঢাকা": "Dhaka",
    "জেদ্দা": "Jeddah",
    "মদিনা": "Madinah",
    "রিয়াদ": "Riyadh",
    "মক্কা": "Makkah",
    "কলকাতা": "Kolkata",
    "লন্ডন": "London",
    "দুবাই": "Dubai",
    "মাস্কাট": "Muscat",
    "চট্টগ্রাম": "Chittagong",
    "সিলেট": "Sylhet",
    "কক্সবাজার": "Cox's Bazar",
    "কুয়ালালামপুর": "Kuala Lumpur",
    "ব্যাংকক": "Bangkok",
    "সিঙ্গাপুর": "Singapore",
    
    // Airlines
    "বাংলাদেশ বিমান": "Biman Bangladesh Airlines",
    "বিমান বাংলাদেশ": "Biman Bangladesh Airlines",
    "ইউএস বাংলা": "US-Bangla Airlines",
    "ইউএস-বাংলা": "US-Bangla Airlines",
    "নভোএয়ার": "Novoair",
    "এয়ার এস্ট্রা": "Air Astra",
    "সৌদি": "Saudia",
    "সৌদি এয়ারলাইন্স": "Saudia Airlines",
    "সৌদি আরব": "Saudia Airlines",
    "এমিরাত": "Emirates",
    "কাতার": "Qatar Airways",
    "কাতার এয়ারওয়েজ": "Qatar Airways",
    "কুয়েত": "Kuwait Airways",
    "গালফ": "Gulf Air",
    "জাজিরা": "Jazeera Airways",
    "এয়ার এরাবিয়া": "Air Arabia",
    "ইন্ডিগো": "IndiGo",
    "এয়ার ইন্ডিয়া": "Air India",
    "সিঙ্গাপুর এয়ারলাইন্স": "Singapore Airlines",
    "মালেশিয়া": "Malaysia Airlines",
    "থাই": "Thai Airways",
    "সালাম এয়ার": "SalamAir",
    "ফ্লাইদুবাই": "flydubai",
    
    // Payment status & methods
    "বিকাশ": "bKash",
    "নগদ": "Nagad",
    "রকেট": "Rocket",
    "উপায়": "Upay",
    "ব্যাংক": "Bank Transfer",
    "ব্যাংক এশিয়া": "Bank Asia",
    "ইসলামী ব্যাংক": "Islami Bank",
    "কার্ড": "Card Payment",
    "ক্যাশ": "Cash",
    "নগদ ক্যাশ": "Cash",
    "পরিশোধিত": "Paid",
    "বকেয়া": "Due",
    "আংশিক": "Partial",
    "হাফ": "Partial",
    "ফুল": "Paid",
    "ক্যানসেল": "Cancelled",
    "কনফার্ম": "Confirmed",
    "কনফার্মড": "Confirmed",
    "টিকিট": "Ticket",
    "ওয়ান ওয়ে": "One Way",
    "রাউন্ড ট্রিপ": "Round Trip",
  };

  let result = text.trim();
  
  // Apply direct dictionary replacements first
  for (const [bangla, english] of Object.entries(dictionary)) {
    const regex = new RegExp(bangla, "gi");
    result = result.replace(regex, english);
  }

  // 2. Character-by-character phonetic transliteration for names/remarks
  const charMap: Record<string, string> = {
    // Vowels
    "অ": "O", "আ": "A", "ই": "I", "ঈ": "I", "উ": "U", "ঊ": "U", "ঋ": "Ri", "এ": "E", "ঐ": "Oi", "ও": "O", "ঔ": "Ou",
    "া": "a", "ি": "i", "ী": "i", "ু": "u", "ূ": "u", "ৃ": "ri", "ে": "e", "ৈ": "oi", "ো": "o", "ৌ": "ou",
    
    // Consonants
    "ক": "k", "খ": "kh", "গ": "g", "ঘ": "gh", "ঙ": "ng",
    "চ": "ch", "ছ": "chh", "জ": "j", "ঝ": "jh", "ঞ": "n",
    "ট": "t", "ঠ": "th", "ড": "d", "ঢ": "dh", "ণ": "n",
    "ত": "t", "থ": "th", "দ": "d", "ধ": "dh", "ন": "n",
    "প": "p", "ফ": "ph", "ব": "b", "ভ": "bh", "ম": "m",
    "য": "z", "র": "r", "ল": "l", "শ": "sh", "ষ": "sh", "স": "s", "হ": "h",
    "ড়": "r", "ঢ়": "rh", "য়": "y", "ৎ": "t", "ং": "ng", "ঃ": "h", "ঁ": "n",
    "্": "", // silent letter
  };

  let finalStr = "";
  for (let i = 0; i < result.length; i++) {
    const char = result[i];
    if (charMap[char] !== undefined) {
      if (i === 0 || result[i - 1] === " ") {
        finalStr += charMap[char].toUpperCase();
      } else {
        finalStr += charMap[char];
      }
    } else {
      finalStr += char;
    }
  }

  // Remove any remaining non-printable or non-ASCII unicode to avoid PDF empty blocks
  const asciiOnly = finalStr.replace(/[^\x00-\x7F]/g, " ").trim();
  return asciiOnly || "N/A";
}

export function generateReceiptPDF(ticket: Ticket) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180mm

  // Premium Colors matching the circular branding
  const primaryColor = [76, 29, 149]; // Deep Purple
  const secondaryColor = [71, 85, 105]; // Cool Slate
  const lightGrey = [248, 250, 252]; // Very light ice blue/slate background
  const borderGrey = [226, 232, 240]; // Soft borders
  const textDark = [30, 41, 59]; // Dark Indigo/Slate
  const textMuted = [100, 116, 139]; // Cool gray
  
  const accentRed = [239, 68, 68]; // Crimson Red
  const accentBlue = [2, 132, 199]; // Sky Blue
  const accentGreen = [34, 197, 94]; // Success Green
  const accentOrange = [249, 115, 22]; // Warning Orange

  // Safe string mapper
  const clean = (val: string | undefined | null) => {
    return translitBengaliToEnglish(val);
  };

  // Helper to format price
  const formatPrice = (amt: number) => {
    return `BDT ${amt.toLocaleString("en-US")} /-`;
  };

  // Date Inconsistency Correction: Issue Date (ticket.date) cannot be later than travel date.
  let displayIssueDate = ticket.date;
  try {
    const issueDateObj = new Date(ticket.date);
    const travelDateObj = new Date(ticket.travelDate);
    if (!isNaN(issueDateObj.getTime()) && !isNaN(travelDateObj.getTime())) {
      if (issueDateObj > travelDateObj) {
        // If travel date is earlier, make issue date 1 day before travel date
        const adjustedDate = new Date(travelDateObj);
        adjustedDate.setDate(adjustedDate.getDate() - 1);
        
        const yyyy = adjustedDate.getFullYear();
        const mm = String(adjustedDate.getMonth() + 1).padStart(2, "0");
        const dd = String(adjustedDate.getDate()).padStart(2, "0");
        displayIssueDate = `${yyyy}-${mm}-${dd}`;
      }
    }
  } catch (e) {
    displayIssueDate = ticket.date;
  }

  let currentY = 15;

  // 1. TOP PREMIUM HEADER WITH THE REQUESTED LOGO
  // Thick color bar
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, currentY, contentWidth, 2.5, "F");
  
  currentY += 8;

  // Logo Circle emblem as requested ("amai amar logo abar ditesi jemon ase temon thakbe")
  // Soft circle background
  doc.setFillColor(227, 242, 253); // Light cyan/blue background circle
  doc.ellipse(margin + 12, currentY + 12, 12, 12, "F");

  // Logo Monogram "JT"
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(accentRed[0], accentRed[1], accentRed[2]); // J in Red
  doc.text("J", margin + 5.5, currentY + 15);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]); // T in Purple
  doc.text("T", margin + 10.5, currentY + 15);

  // Airplane & Swoosh trail from the logo
  doc.setDrawColor(accentRed[0], accentRed[1], accentRed[2]);
  doc.setLineWidth(0.6);
  // Curve from bottom left of circle up to flight path
  doc.line(margin + 2.5, currentY + 17, margin + 18, currentY + 6);
  doc.setDrawColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.line(margin + 4.5, currentY + 18, margin + 20, currentY + 7);

  // Tiny jet airplane icon at end of swoosh
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.triangle(margin + 20, currentY + 7, margin + 17, currentY + 9, margin + 19, currentY + 11, "F");

  // Brand Names
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(accentRed[0], accentRed[1], accentRed[2]);
  doc.text("JT", margin + 28, currentY + 10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(" TOURS & TRAVEL", margin + 35, currentY + 10); // Singular "TRAVEL" as in logo

  // Slogan Tagline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("YOUR COMFORT OUR PRIORITY", margin + 28, currentY + 15);

  // Small decorative red line under tagline
  doc.setDrawColor(accentRed[0], accentRed[1], accentRed[2]);
  doc.setLineWidth(0.4);
  doc.line(margin + 28, currentY + 17.5, margin + 85, currentY + 17.5);

  // Right Aligned Header Invoice Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("E-TICKET RECEIPT & ITINERARY", pageWidth - margin, currentY + 6, { align: "right" });

  const invoiceNo = `JT-${ticket.pnrNumber ? clean(ticket.pnrNumber).toUpperCase() : ticket.id.toUpperCase().substring(0, 8)}`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`Invoice Reference: ${invoiceNo}`, pageWidth - margin, currentY + 11, { align: "right" });
  doc.text(`Issue Date: ${displayIssueDate}`, pageWidth - margin, currentY + 15, { align: "right" });

  currentY += 24;

  // Contact Info Section with Requested Emails and Phone Numbers
  doc.setFillColor(lightGrey[0], lightGrey[1], lightGrey[2]);
  doc.rect(margin, currentY, contentWidth, 11, "F");
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.rect(margin, currentY, contentWidth, 11, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("OFFICIAL CONTACTS:", margin + 4, currentY + 7);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text("Email: hanifrayhan70@gmail.com", margin + 42, currentY + 7);
  doc.text("Hotline: +8801711785869, +8801713515436", margin + 105, currentY + 7);

  currentY += 16;

  // 2. PASSENGER DETAILS SECTION
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("1. PASSENGER & BOOKING RECORD", margin, currentY);

  currentY += 4.5;

  const passBoxH = 36;
  doc.setFillColor(lightGrey[0], lightGrey[1], lightGrey[2]);
  doc.rect(margin, currentY, contentWidth, passBoxH, "F");
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.rect(margin, currentY, contentWidth, passBoxH, "S");

  const colW = contentWidth / 3;
  const col1 = margin + 5;
  const col2 = margin + colW + 2;
  const col3 = margin + (colW * 2) + 2;

  let rowY = currentY + 6;

  const drawDataField = (x: number, y: number, label: string, val: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(label, x, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(val, x, y + 4.5);
  };

  drawDataField(col1, rowY, "PASSENGER NAME", clean(ticket.customerName).toUpperCase());
  drawDataField(col2, rowY, "CONTACT PHONE", clean(ticket.phoneNumber));
  drawDataField(col3, rowY, "PASSPORT NUMBER", clean(ticket.passportNumber).toUpperCase());

  rowY += 15;

  drawDataField(col1, rowY, "AIRLINE GDS PNR", clean(ticket.pnrNumber).toUpperCase());
  drawDataField(col2, rowY, "E-TICKET NUMBER", clean(ticket.eticketNumber || "N/A").toUpperCase());
  drawDataField(col3, rowY, "BOOKING AGENT", clean(ticket.bookingAgent || ticket.staffName || "JT Office").toUpperCase());

  currentY += passBoxH + 8;

  // 3. FLIGHT ITINERARY DETAILS SECTION
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("2. FLIGHT SECTOR & ITINERARY DETAILS", margin, currentY);

  currentY += 4.5;

  const isRoundTrip = ticket.ticketType === "Round Trip";
  const flightBoxH = isRoundTrip ? 58 : 32;

  doc.setFillColor(255, 255, 255);
  doc.rect(margin, currentY, contentWidth, flightBoxH, "S");

  // Header banner inside the flight box
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, currentY, contentWidth, 8, "F");

  // Aligned column x coordinates
  const colX1 = margin + 4;
  const colX2 = margin + 52;
  const colX3 = margin + 104;
  const colX4 = margin + 146;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("CARRIER & FLIGHT", colX1, currentY + 5.5);
  doc.text("ROUTING / SECTORS", colX2, currentY + 5.5);
  doc.text("DEPARTURE DATE & TIME", colX3, currentY + 5.5);
  doc.text("ARRIVALS / STATUS", colX4, currentY + 5.5);

  const drawFlightRow = (
    yStart: number,
    airline: string,
    flightNo: string,
    cls: string,
    from: string,
    to: string,
    travelDate: string,
    depTime: string,
    arrDate: string,
    arrTime: string,
    baggage: string,
    terminal: string,
    seat: string
  ) => {
    let textY = yStart + 5.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(airline, colX1, textY);

    // Route (From -> To)
    const routeText = `${from}  -->  ${to}`;
    doc.text(routeText, colX2, textY);

    // Departure Date & Time
    doc.setFontSize(9.5);
    doc.text(travelDate, colX3, textY);

    // Arrival Date & Time
    doc.text(arrDate, colX4, textY);

    textY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    
    // Cleanly construct Flight parts to avoid empty pipes
    const flightParts = [];
    if (flightNo) flightParts.push(`Flight: ${flightNo}`);
    if (cls) flightParts.push(`Class: ${cls}`);
    doc.text(flightParts.join("  |  "), colX1, textY);

    doc.text("Confirmed Flight Booking", colX2, textY);
    doc.text(`Time: ${depTime || "TBA"}`, colX3, textY);
    doc.text(`Time: ${arrTime || "TBA"}`, colX4, textY);

    // Cleanly construct Baggage parts to avoid empty pipes
    const baggageParts = [];
    if (baggage) baggageParts.push(`Baggage Allowance: ${baggage}`);
    if (terminal) baggageParts.push(`Terminal: ${terminal}`);
    if (seat) baggageParts.push(`Seat: ${seat}`);

    if (baggageParts.length > 0) {
      textY += 4.5;
      doc.setFontSize(8);
      doc.text(baggageParts.join("  |  "), colX1, textY);
    }
  };

  // Outbound Flight Row
  drawFlightRow(
    currentY + 8,
    clean(ticket.airlineName).toUpperCase(),
    clean(ticket.flightNumber).toUpperCase(),
    clean(ticket.bookingClass || "Y").toUpperCase(),
    clean(ticket.fromAirport || "DAC").toUpperCase(),
    clean(ticket.destination).toUpperCase(),
    clean(ticket.travelDate),
    clean(ticket.departureTime || "TBA"),
    clean(ticket.arrivalDate || ticket.travelDate),
    clean(ticket.arrivalTime || "TBA"),
    clean(ticket.baggageAllowance || "30 KG"),
    clean(ticket.terminal || "1"),
    clean(ticket.seatNumber || "Any Seat Allocated")
  );

  // Return Flight if Round Trip
  if (isRoundTrip) {
    // Divider line sits perfectly between Row 1 and Row 2
    doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
    doc.setLineWidth(0.4);
    doc.line(margin + 2, currentY + 33, pageWidth - margin - 2, currentY + 33);

    drawFlightRow(
      currentY + 33,
      clean(ticket.airlineName).toUpperCase(),
      clean(ticket.returnFlightNumber || ticket.flightNumber).toUpperCase(),
      clean(ticket.bookingClass || "Y").toUpperCase(),
      clean(ticket.destination).toUpperCase(), // Reverse routing for return leg
      clean(ticket.fromAirport || "DAC").toUpperCase(),
      clean(ticket.returnDate || "TBA"),
      "TBA", // Return departure time
      clean(ticket.returnDate || "TBA"),
      "TBA", // Return arrival time
      clean(ticket.baggageAllowance || "30 KG"),
      "1",
      "Any Seat Allocated"
    );
  }

  currentY += flightBoxH + 8;

  // 4. FARE BREAKDOWN & ACCOUNT SUMMARY
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("3. FARE BREAKDOWN & PAYMENT ACKNOWLEDGEMENT", margin, currentY);

  currentY += 4.5;

  const leftW = 105;
  const rightW = 70;
  const blockH = 38;

  // Left Policy and Rules Card
  doc.setFillColor(lightGrey[0], lightGrey[1], lightGrey[2]);
  doc.rect(margin, currentY, leftW, blockH, "F");
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.rect(margin, currentY, leftW, blockH, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("IMPORTANT ADVISORIES & POLICIES:", margin + 4, currentY + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  let policyY = currentY + 9.5;
  const policies = [
    "* Passport validity must be a minimum of 6 months prior to departure date.",
    "* Present printed E-ticket with valid passport during airport check-in.",
    "* Check baggage limits with airline. Fees apply for extra weight.",
    "* Reschedule or cancellation requests must be sent 24 hours in advance.",
    "* Support Hotline: +8801711785869, Email: hanifrayhan70@gmail.com"
  ];
  policies.forEach((p) => {
    doc.text(p, margin + 4, policyY);
    policyY += 4;
  });

  if (ticket.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    const cleanNotes = clean(ticket.notes).substring(0, 110);
    doc.text(`Agent Remarks: ${cleanNotes}`, margin + 4, currentY + 33, { maxWidth: leftW - 8 });
  }

  // Right Financial Receipt Block
  doc.setFillColor(255, 255, 255);
  doc.rect(margin + leftW + 5, currentY, rightW, blockH, "S");

  const rx = margin + leftW + 5;
  let ry = currentY + 6;

  const drawLedgerRow = (lbl: string, val: string, isTot = false) => {
    doc.setFont("helvetica", isTot ? "bold" : "normal");
    doc.setFontSize(isTot ? 9.5 : 8);
    doc.setTextColor(isTot ? primaryColor[0] : textMuted[0], isTot ? primaryColor[1] : textMuted[1], isTot ? primaryColor[2] : textMuted[2]);
    doc.text(lbl, rx + 4, ry);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(val, rx + rightW - 4, ry, { align: "right" });

    doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
    doc.setLineWidth(0.25);
    doc.line(rx + 2, ry + 2.5, rx + rightW - 2, ry + 2.5);

    ry += 7.5;
  };

  const total = ticket.sellingPrice || 0;
  const tax = Math.round(total * 0.05); // 5% estimated tax
  const base = total - tax;

  drawLedgerRow("Base Fare Rate", formatPrice(base));
  drawLedgerRow("Taxes & Surcharge", formatPrice(tax));
  drawLedgerRow("Total Booking Fare", formatPrice(total), true);

  // Status Badge row inside the ledger
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("Payment Balance", rx + 4, ry + 1.5);

  const paymentStatus = clean(ticket.paymentStatus).toUpperCase();
  const isPaid = paymentStatus.includes("PAID");
  const isDue = paymentStatus.includes("DUE");

  if (isPaid) {
    doc.setFillColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  } else if (isDue) {
    doc.setFillColor(accentRed[0], accentRed[1], accentRed[2]);
  } else {
    doc.setFillColor(accentOrange[0], accentOrange[1], accentOrange[2]);
  }

  doc.roundedRect(rx + rightW - 26, ry - 1.5, 22, 4.2, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(paymentStatus, rx + rightW - 15, ry + 1.4, { align: "center" });

  currentY += blockH + 11;

  // 5. SIGNATURE & STAMP FOOTER
  doc.setDrawColor(borderGrey[0], borderGrey[1], borderGrey[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY + 15, margin + 45, currentY + 15);
  doc.line(pageWidth - margin - 45, currentY + 15, pageWidth - margin, currentY + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("Passenger Signature", margin + 22.5, currentY + 19, { align: "center" });
  doc.text("Authorized Representative", pageWidth - margin - 22.5, currentY + 19, { align: "center" });

  // Center Seal Stamp
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("JT TOURS & TRAVEL", pageWidth / 2, currentY + 10, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("COMPUTER GENERATED PORTAL VERIFIED", pageWidth / 2, currentY + 13.5, { align: "center" });

  // Page Bottom Thank You Footer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("THANK YOU FOR FLYING WITH JT TOURS & TRAVEL", pageWidth / 2, pageHeight - 16, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("Email: hanifrayhan70@gmail.com | Hotline: +8801711785869, +8801713515436", pageWidth / 2, pageHeight - 11.5, { align: "center" });

  // Save/Download PDF
  const nameSafe = clean(ticket.customerName).replace(/\s+/g, "_");
  const filename = `JT_Receipt_${nameSafe}_${clean(ticket.pnrNumber || "CONFIRMED")}.pdf`;
  doc.save(filename);
}

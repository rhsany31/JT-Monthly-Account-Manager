import { Ticket } from "../types";

/**
 * Searches Google Drive for a spreadsheet named "JT Tours & Travels - Ticket Tracker Ledger"
 * Returns spreadsheet ID if exists, otherwise returns null.
 */
async function findSpreadsheet(accessToken: string): Promise<string | null> {
  const query = encodeURIComponent("name = 'JT Tours & Travels - Ticket Tracker Ledger' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;
  
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Drive search failed: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error) {
    console.error("Error finding spreadsheet:", error);
    return null;
  }
}

/**
 * Creates a new Google Sheet named "JT Tours & Travels - Ticket Tracker Ledger"
 * and initializes it with headers.
 */
async function createSpreadsheet(accessToken: string): Promise<string> {
  const url = "https://sheets.googleapis.com/v4/spreadsheets";
  const body = {
    properties: {
      title: "JT Tours & Travels - Ticket Tracker Ledger",
    },
    sheets: [
      {
        properties: {
          title: "Tickets",
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Spreadsheet creation failed: ${res.statusText}`);
    }
    const data = await res.json();
    const spreadsheetId = data.spreadsheetId;

    // Write headers immediately
    await writeHeaders(accessToken, spreadsheetId);
    return spreadsheetId;
  } catch (error) {
    console.error("Error creating spreadsheet:", error);
    throw error;
  }
}

/**
 * Writes the header row into the spreadsheet
 */
async function writeHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
  const range = "Tickets!A1";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  
  const headers = [
    [
      "টিকিট আইডি (Ticket ID)",
      "বুকিং তারিখ (Booking Date)",
      "যাত্রীর নাম (Passenger Name)",
      "ফোন নম্বর (Phone Number)",
      "পাসপোর্ট নম্বর (Passport Number)",
      "পিএনআর নম্বর (PNR)",
      "ই-টিকিট নম্বর (E-Ticket)",
      "এয়ারলাইন (Airline)",
      "ফ্লাইট নম্বর (Flight No)",
      "ক্লাস (Class)",
      "টিকিট স্ট্যাটাস (Status)",
      "কোথা থেকে (From)",
      "গন্তব্য (Destination)",
      "ভ্রমণের তারিখ (Travel Date)",
      "প্রস্থানের সময় (Departure Time)",
      "পৌঁছানোর তারিখ (Arrival Date)",
      "পৌঁছানোর সময় (Arrival Time)",
      "ফেরার তারিখ (Return Date)",
      "ফেরার ফ্লাইট (Return Flight)",
      "টার্মিনাল (Terminal)",
      "ব্যাগেজ (Baggage)",
      "আসন নম্বর (Seat)",
      "ক্রয় মূল্য (Purchase Cost)",
      "বিক্রয় মূল্য (Selling Price)",
      "লাভ (Profit)",
      "পেমেন্ট স্ট্যাটাস (Payment Status)",
      "পেমেন্ট মাধ্যম (Payment Method)",
      "ইস্যুকারী স্টাফ (Staff Name)",
      "মন্তব্য (Notes)",
      "সর্বশেষ আপডেট (Last Updated)"
    ]
  ];

  await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: headers }),
  });
}

/**
 * Syncs the entire local list of tickets to the Google Sheet.
 * This clears old values and writes a fresh copy to guarantee consistency.
 */
export async function syncTicketsToGoogleSheet(
  accessToken: string,
  tickets: Ticket[],
  onStatusUpdate?: (status: string) => void
): Promise<string> {
  try {
    onStatusUpdate?.("গুগল ড্রাইভ স্ক্যান করা হচ্ছে...");
    let spreadsheetId = await findSpreadsheet(accessToken);
    
    if (!spreadsheetId) {
      onStatusUpdate?.("নতুন গুগল এক্সেল শীট তৈরি করা হচ্ছে...");
      spreadsheetId = await createSpreadsheet(accessToken);
    }

    onStatusUpdate?.("শীটের পুরাতন তথ্য পরিষ্কার করা হচ্ছে...");
    // Clear rows below headers (A2:AD1000)
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Tickets!A2:AD1000:clear`;
    await fetch(clearUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (tickets.length === 0) {
      onStatusUpdate?.("তথ্য খালি; গুগল শীট আপডেট সম্পন্ন হয়েছে।");
      return spreadsheetId;
    }

    onStatusUpdate?.(`${tickets.length}টি টিকিটের তথ্য সেভ করা হচ্ছে...`);
    const rows = tickets.map((t) => [
      t.id || "",
      t.date || "",
      t.customerName || "",
      t.phoneNumber || "",
      t.passportNumber || "",
      t.pnrNumber || "",
      t.eticketNumber || "",
      t.airlineName || "",
      t.flightNumber || "",
      t.bookingClass || "",
      t.ticketStatus || "",
      t.fromAirport || "",
      t.destination || "",
      t.travelDate || "",
      t.departureTime || "",
      t.arrivalDate || "",
      t.arrivalTime || "",
      t.returnDate || "",
      t.returnFlightNumber || "",
      t.terminal || "",
      t.baggageAllowance || "",
      t.seatNumber || "",
      t.purchaseCost || 0,
      t.sellingPrice || 0,
      t.profit || 0,
      t.paymentStatus || "",
      t.paymentMethod || "",
      t.staffName || "",
      t.notes || "",
      new Date().toLocaleString("bn-BD")
    ]);

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Tickets!A2?valueInputOption=USER_ENTERED`;
    const response = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rows }),
    });

    if (!response.ok) {
      throw new Error(`Failed to write values: ${response.statusText}`);
    }

    onStatusUpdate?.("গুগল এক্সেল শীটে সকল টিকিট সফলভাবে সেভ হয়েছে! 🎉");
    return spreadsheetId;
  } catch (error: any) {
    console.error("Sheets sync failed:", error);
    onStatusUpdate?.(`ভুল হয়েছে: ${error.message || error}`);
    throw error;
  }
}

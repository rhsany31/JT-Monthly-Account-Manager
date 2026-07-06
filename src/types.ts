export interface Ticket {
  id: string;
  date: string; // Record date
  customerName: string;
  phoneNumber: string;
  passportNumber?: string;
  pnrNumber: string;
  airlineName: string;
  destination: string;
  flightNumber: string;
  travelDate: string;
  returnDate?: string;
  ticketType: "One Way" | "Round Trip";
  purchaseCost: number;
  sellingPrice: number;
  profit: number; // Automatically calculated: sellingPrice - purchaseCost
  paymentStatus: "Paid" | "Partial" | "Due";
  paymentMethod: "Cash" | "Bank" | "bKash" | "Nagad" | "Card";
  staffName: string;
  notes?: string;

  // Additional PDF/Image extraction fields
  eticketNumber?: string;
  bookingClass?: string;
  ticketStatus?: string;
  fromAirport?: string;
  toAirport?: string;
  departureTime?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  returnFlightNumber?: string;
  terminal?: string;
  baggageAllowance?: string;
  seatNumber?: string;
  bookingAgent?: string;
  
  // Quality/Confidence fields
  lowConfidenceFields?: string[];
}

export interface StatsSummary {
  totalTickets: number;
  totalPurchaseCost: number;
  totalSales: number;
  totalProfit: number;
  totalDue: number;
}

import React, { useState, useEffect, useMemo } from "react";
import { 
  Plane, 
  Calendar, 
  DollarSign, 
  PlusCircle, 
  Trash2, 
  Edit2,
  Download, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownRight, 
  ArrowLeft,
  Wallet, 
  Search, 
  Key, 
  Loader2, 
  Info,
  CheckCircle,
  Check,
  TrendingUp,
  X,
  FileText,
  User,
  Phone,
  Hash,
  AlertTriangle,
  Globe,
  Filter,
  Eye,
  Briefcase,
  Layers,
  ChevronRight,
  RefreshCw,
  Plus,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Ticket } from "./types";
import { MobilePaymentHelper } from "./components/MobilePaymentHelper";
import { generateReceiptPDF } from "./utils/receiptGenerator";
import { Logo } from "./components/Logo";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";
import { syncTicketsToGoogleSheet } from "./lib/sheetsService";

// Initialize Firebase Auth for Google Sheets Sync
const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/spreadsheets");
googleProvider.addScope("https://www.googleapis.com/auth/drive.file");

// Seed data with real realistic tickets
const INITIAL_TICKETS: Ticket[] = [];

export default function App() {
  // Persistence using localstorage
  const [tickets, setTickets] = useState<Ticket[]>(() => {
    const saved = localStorage.getItem("jt_tickets");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Filter out initial demo tickets so they are removed
        return parsed.filter((t: Ticket) => t.id !== "t-1" && t.id !== "t-2" && t.id !== "t-3" && t.id !== "t-4" && t.id !== "t-5");
      } catch (e) {
        console.error("Failed to parse saved tickets:", e);
      }
    }
    return INITIAL_TICKETS;
  });

  // Keep state for editing and detailed view modals
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Form Fields State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    customerName: "",
    phoneNumber: "",
    passportNumber: "",
    pnrNumber: "",
    airlineName: "কাতার এয়ারওয়েজ",
    destination: "",
    flightNumber: "",
    travelDate: "",
    returnDate: "",
    ticketType: "One Way" as "One Way" | "Round Trip",
    purchaseCost: "",
    sellingPrice: "",
    paymentStatus: "Paid" as "Paid" | "Partial" | "Due",
    paymentMethod: "Cash" as "Cash" | "Bank" | "bKash" | "Nagad" | "Card",
    staffName: "Robiul Hasan Sany",
    notes: "",
    // Extra field for partial payment tracking
    amountPaid: "",
    
    // Additional PDF/Image extraction fields
    eticketNumber: "",
    bookingClass: "",
    ticketStatus: "",
    fromAirport: "",
    toAirport: "",
    departureTime: "",
    arrivalDate: "",
    arrivalTime: "",
    returnFlightNumber: "",
    terminal: "",
    baggageAllowance: "",
    seatNumber: "",
    bookingAgent: "",
    lowConfidenceFields: [] as string[]
  });

  // Live validation warnings status
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Period / Date Filters
  const [reportPeriod, setReportPeriod] = useState<"all" | "today" | "week" | "month" | "year">("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("2026");

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");

  // View mode: dashboard (form & stats) or ledger (table on new page)
  const [viewMode, setViewMode] = useState<"dashboard" | "ledger">("dashboard");

  // Confirmation states
  const [ticketToConfirmSave, setTicketToConfirmSave] = useState<Ticket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<{ id: string; customerName: string } | null>(null);

  // Gemini state variables
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("gemini_key") || "");
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number; base64: string; type: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Google Sheets Sync States
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [sheetsSyncStatus, setSheetsSyncStatus] = useState<string>("");
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [sheetId, setSheetId] = useState<string>(() => localStorage.getItem("google_sheet_id") || "");
  const [showAuthHelp, setShowAuthHelp] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  // Toast notifier helper
  const triggerToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Listen for Google Auth changes
  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        setGoogleUser(null);
        setGoogleAccessToken(null);
        setSheetsSyncStatus("");
      } else {
        setGoogleUser(user);
      }
    });
  }, []);

  // Google Sheets manual / automatic trigger sync function
  const triggerSheetsSync = async (token: string, currentTickets: Ticket[]) => {
    if (!token) return;
    setIsSyncingSheets(true);
    try {
      const id = await syncTicketsToGoogleSheet(token, currentTickets, (msg) => {
        setSheetsSyncStatus(msg);
      });
      setSheetId(id);
      localStorage.setItem("google_sheet_id", id);
    } catch (err: any) {
      console.error("Sheets sync failed:", err);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  // Google Sign In handler
  const handleGoogleSignIn = async () => {
    try {
      setSheetsSyncStatus("গুগল সাইন-ইন করা হচ্ছে...");
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        setGoogleUser(result.user);
        setSheetsSyncStatus("গুগল সাইন-ইন সফল হয়েছে!");
        triggerToast("গুগল অ্যাকাউন্ট সফলভাবে সংযুক্ত হয়েছে! 🎉", "success");
        // Sync tickets immediately after successful login
        await triggerSheetsSync(credential.accessToken, tickets);
      } else {
        throw new Error("গুগল ক্রেডেনশিয়াল থেকে অ্যাক্সেস টোকেন পাওয়া যায়নি।");
      }
    } catch (err: any) {
      console.error("Google Auth error:", err);
      if (err?.code === "auth/popup-closed-by-user" || err?.message?.includes("popup-closed-by-user")) {
        setSheetsSyncStatus("");
        triggerToast("সাইন-ইন উইন্ডোটি বন্ধ করা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।", "info");
      } else if (err?.code === "auth/user-cancelled" || err?.message?.includes("user-cancelled") || err?.code === "auth/popup-blocked") {
        setSheetsSyncStatus("");
        triggerToast("গুগল শীটস ব্যবহারের অনুমতি বাতিল করা হয়েছে। ডাটা সেভ করার জন্য দয়া করে সাইন-ইন করে প্রয়োজনীয় অনুমতি দিন।", "info");
      } else {
        setSheetsSyncStatus(`কানেক্ট ব্যর্থ: ${err.message || err}`);
        triggerToast("গুগল অ্যাকাউন্টের সাথে সংযোগ ব্যর্থ হয়েছে। সমাধান গাইডটি নিচে দেখুন।", "error");
        setShowAuthHelp(true);
      }
    }
  };

  // Google Sign Out handler
  const handleGoogleSignOut = async () => {
    try {
      await firebaseAuth.signOut();
      setGoogleUser(null);
      setGoogleAccessToken(null);
      setSheetsSyncStatus("");
      triggerToast("গুগল অ্যাকাউন্ট সাইন-আউট করা হয়েছে।", "info");
    } catch (err: any) {
      console.error("Sign out error:", err);
    }
  };

  // Auto save to LocalStorage and Auto-Sync to Google Sheets
  useEffect(() => {
    localStorage.setItem("jt_tickets", JSON.stringify(tickets));
    
    if (googleAccessToken) {
      // Debounce sync slightly to avoid rapid multiple writes
      const timeoutId = setTimeout(() => {
        triggerSheetsSync(googleAccessToken, tickets);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [tickets, googleAccessToken]);

  // Form validation handler (checks required fields on input change)
  useEffect(() => {
    const warnings: string[] = [];
    if (!formData.customerName.trim()) warnings.push("কাস্টমারের নাম (Customer Name) প্রয়োজন");
    if (!formData.pnrNumber.trim()) warnings.push("PNR নম্বর (PNR Number) প্রয়োজন");
    if (!formData.travelDate) warnings.push("ভ্রমণের তারিখ (Travel Date) প্রয়োজন");
    if (!formData.purchaseCost || parseFloat(formData.purchaseCost) <= 0) warnings.push("ক্রয় মূল্য (Purchase Cost) প্রয়োজন");
    if (!formData.sellingPrice || parseFloat(formData.sellingPrice) <= 0) warnings.push("বিক্রয় মূল্য (Selling Price) প্রয়োজন");
    
    // Warn if purchase cost is greater than selling price (selling at loss)
    if (formData.purchaseCost && formData.sellingPrice) {
      if (parseFloat(formData.purchaseCost) > parseFloat(formData.sellingPrice)) {
        warnings.push("সতর্কতা: বিক্রয় মূল্যের চেয়ে ক্রয় মূল্য বেশি! লোকসান হচ্ছে।");
      }
    }
    setValidationWarnings(warnings);
  }, [formData.customerName, formData.pnrNumber, formData.travelDate, formData.purchaseCost, formData.sellingPrice]);

  // Create ticket action
  const handleSaveTicket = (e: React.FormEvent) => {
    e.preventDefault();

    // Strict validation
    if (!formData.customerName.trim() || !formData.pnrNumber.trim() || !formData.travelDate || !formData.purchaseCost || !formData.sellingPrice) {
      triggerToast("দয়া করে সকল লাল চিহ্নিত বাধ্যতামূলক ফিল্ড পূরণ করুন!", "error");
      return;
    }

    const buyCost = parseFloat(formData.purchaseCost) || 0;
    const sellPrice = parseFloat(formData.sellingPrice) || 0;
    const calcProfit = sellPrice - buyCost;

    const newTicket: Ticket = {
      id: "t-" + Date.now(),
      date: formData.date || new Date().toISOString().split("T")[0],
      customerName: formData.customerName.trim(),
      phoneNumber: formData.phoneNumber.trim() || "N/A",
      passportNumber: formData.passportNumber.trim() || undefined,
      pnrNumber: formData.pnrNumber.trim().toUpperCase(),
      airlineName: formData.airlineName,
      destination: formData.destination.trim() || "Unspecified",
      flightNumber: formData.flightNumber.trim().toUpperCase() || "N/A",
      travelDate: formData.travelDate,
      returnDate: formData.ticketType === "Round Trip" ? (formData.returnDate || undefined) : undefined,
      ticketType: formData.ticketType,
      purchaseCost: buyCost,
      sellingPrice: sellPrice,
      profit: calcProfit,
      paymentStatus: formData.paymentStatus,
      paymentMethod: formData.paymentMethod,
      staffName: formData.staffName,
      notes: formData.notes.trim() ? formData.notes.trim() : undefined,
      
      // Extra PDF/Image fields
      eticketNumber: formData.eticketNumber.trim() || undefined,
      bookingClass: formData.bookingClass.trim() || undefined,
      ticketStatus: formData.ticketStatus.trim() || undefined,
      fromAirport: formData.fromAirport.trim() || undefined,
      toAirport: formData.toAirport.trim() || undefined,
      departureTime: formData.departureTime.trim() || undefined,
      arrivalDate: formData.arrivalDate.trim() || undefined,
      arrivalTime: formData.arrivalTime.trim() || undefined,
      returnFlightNumber: formData.returnFlightNumber.trim() || undefined,
      terminal: formData.terminal.trim() || undefined,
      baggageAllowance: formData.baggageAllowance.trim() || undefined,
      seatNumber: formData.seatNumber.trim() || undefined,
      bookingAgent: formData.bookingAgent.trim() || undefined,
      lowConfidenceFields: formData.lowConfidenceFields && formData.lowConfidenceFields.length > 0 ? formData.lowConfidenceFields : undefined
    };

    // Require user confirmation before saving
    setTicketToConfirmSave(newTicket);
  };

  // Confirm save ticket action
  const handleConfirmSaveTicket = () => {
    if (!ticketToConfirmSave) return;
    setTickets(prev => [ticketToConfirmSave, ...prev]);
    
    // Clear form except date and staff
    setFormData(prev => ({
      ...prev,
      customerName: "",
      phoneNumber: "",
      passportNumber: "",
      pnrNumber: "",
      destination: "",
      flightNumber: "",
      travelDate: "",
      returnDate: "",
      ticketType: "One Way",
      purchaseCost: "",
      sellingPrice: "",
      paymentStatus: "Paid",
      paymentMethod: "Cash",
      notes: "",
      amountPaid: "",
      eticketNumber: "",
      bookingClass: "",
      ticketStatus: "",
      fromAirport: "",
      toAirport: "",
      departureTime: "",
      arrivalDate: "",
      arrivalTime: "",
      returnFlightNumber: "",
      terminal: "",
      baggageAllowance: "",
      seatNumber: "",
      bookingAgent: "",
      lowConfidenceFields: []
    }));

    setTicketToConfirmSave(null);
    triggerToast("নতুন টিকিট বুকিং সফলভাবে সংরক্ষণ করা হয়েছে!", "success");
  };

  // Edit ticket initial state loader
  const handleStartEdit = (ticket: Ticket) => {
    setEditingTicket(ticket);
  };

  // Submit edited ticket
  const handleUpdateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;

    if (!editingTicket.customerName.trim() || !editingTicket.pnrNumber.trim() || !editingTicket.travelDate || !editingTicket.purchaseCost || !editingTicket.sellingPrice) {
      triggerToast("সবগুলো প্রয়োজনীয় ক্ষেত্র পূরণ করুন!", "error");
      return;
    }

    const updatedList = tickets.map(t => {
      if (t.id === editingTicket.id) {
        const profit = editingTicket.sellingPrice - editingTicket.purchaseCost;
        return {
          ...editingTicket,
          pnrNumber: editingTicket.pnrNumber.toUpperCase(),
          profit
        };
      }
      return t;
    });

    setTickets(updatedList);
    setEditingTicket(null);
    triggerToast("টিকিট তথ্য সফলভাবে আপডেট করা হয়েছে!", "success");
  };

  // Delete ticket action
  const handleDeleteTicket = (id: string, customerName: string) => {
    setTicketToDelete({ id, customerName });
  };

  // Confirm delete ticket action
  const handleConfirmDeleteTicket = () => {
    if (!ticketToDelete) return;
    setTickets(prev => prev.filter(t => t.id !== ticketToDelete.id));
    setTicketToDelete(null);
    triggerToast("টিকিট এন্ট্রি মুছে ফেলা হয়েছে", "info");
  };



  // Handle Airline Ticket File PDF or Image Multimodal parse
  const handleFileParse = async () => {
    if (!selectedFile) {
      triggerToast("দয়া করে প্রথমে একটি টিকিট পিডিএফ বা ইমেজ ফাইল আপলোড করুন!", "error");
      return;
    }

    setIsFileLoading(true);
    try {
      const response = await fetch("/api/gemini/parse-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: selectedFile.base64,
          mimeType: selectedFile.type,
          fileName: selectedFile.name,
          apiKey: apiKey.trim() || undefined
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "AI service failed to process the document");
      }

      const info = result.data;
      if (info) {
        setFormData(prev => ({
          ...prev,
          customerName: info.customerName || "",
          phoneNumber: info.phoneNumber || "",
          passportNumber: info.passportNumber || "",
          pnrNumber: info.pnrNumber || "",
          eticketNumber: info.eticketNumber || "",
          airlineName: info.airlineName || "কাতার এয়ারওয়েজ",
          destination: info.toAirport || info.destination || "",
          flightNumber: info.flightNumber || "",
          travelDate: info.travelDate || "",
          returnDate: info.returnDate || "",
          ticketType: info.ticketType === "Round Trip" || info.returnDate ? "Round Trip" : "One Way",
          purchaseCost: info.purchaseCost ? String(info.purchaseCost) : "",
          sellingPrice: info.sellingPrice ? String(info.sellingPrice) : "",
          paymentStatus: info.paymentStatus || "Paid",
          paymentMethod: info.paymentMethod || "Cash",
          notes: info.notes || "",
          fromAirport: info.fromAirport || "",
          toAirport: info.toAirport || "",
          departureTime: info.departureTime || "",
          arrivalDate: info.arrivalDate || "",
          arrivalTime: info.arrivalTime || "",
          returnFlightNumber: info.returnFlightNumber || "",
          terminal: info.terminal || "",
          baggageAllowance: info.baggageAllowance || "",
          seatNumber: info.seatNumber || "",
          bookingAgent: info.bookingAgent || "",
          lowConfidenceFields: info.lowConfidenceFields || []
        }));

        const extractedCount = Object.keys(info).filter(k => info[k] && k !== "lowConfidenceFields").length;
        const lowConfCount = info.lowConfidenceFields?.length || 0;

        if (result.simulated) {
          if (result.simulatedError) {
            triggerToast(`🤖 Gemini ব্যস্ত থাকায় অফলাইন পার্সার দিয়ে ${selectedFile.name} রিড করা হয়েছে!`, "info");
          } else {
            triggerToast(`🤖 সিমুলেশন মোড: ${selectedFile.name} থেকে ডাটা সফলভাবে ফর্মে ইনপুট করা হয়েছে!`, "info");
          }
        } else {
          triggerToast(`🎉 Gemini AI সফলভাবে ${selectedFile.name} বিশ্লেষণ করে ${extractedCount} টি তথ্য ফর্মে পূরণ করেছে!`, "success");
        }

        if (lowConfCount > 0) {
          triggerToast(`⚠️ ${lowConfCount}টি তথ্যে সন্দেহ রয়েছে। হলুদ ব্যাকগ্রাউন্ডের ক্ষেত্রগুলো যাচাই করে নিন!`, "info");
        }
      }
    } catch (err: any) {
      console.error(err);
      triggerToast(`ফাইল স্ক্যান ব্যর্থ হয়েছে: ${err.message || "সার্ভার এরর"}`, "error");
    } finally {
      setIsFileLoading(false);
    }
  };

  // Handle manual file selection via input click
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      triggerToast("ফাইলের সাইজ অনেক বড়! সর্বোচ্চ ২০ মেগাবাইট ফাইল আপলোড করুন।", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        size: file.size,
        base64: reader.result as string,
        type: file.type || "application/pdf"
      });
      triggerToast(`ফাইল '${file.name}' সফলভাবে লোড হয়েছে। স্ক্যান করতে 'বিশ্লেষণ করুন' বাটনে ক্লিক করুন!`, "info");
    };
    reader.onerror = () => {
      triggerToast("ফাইল পড়তে সমস্যা হয়েছে!", "error");
    };
    reader.readAsDataURL(file);
  };

  // Handle file drag and drop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      triggerToast("ফাইলের সাইজ অনেক বড়! সর্বোচ্চ ২০ মেগাবাইট ফাইল আপলোড করুন।", "error");
      return;
    }

    if (!file.type.includes("pdf") && !file.type.includes("image")) {
      triggerToast("শুধুমাত্র পিডিএফ (PDF) অথবা ইমেজ ফাইল (.png, .jpg) আপলোড করা যাবে!", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        size: file.size,
        base64: reader.result as string,
        type: file.type || "application/pdf"
      });
      triggerToast(`ফাইল '${file.name}' ড্রপ করা হয়েছে। স্ক্যান করতে 'বিশ্লেষণ করুন' বাটনে ক্লিক করুন!`, "info");
    };
    reader.onerror = () => {
      triggerToast("ফাইল পড়তে সমস্যা হয়েছে!", "error");
    };
    reader.readAsDataURL(file);
  };

  // CSV Report Exporter
  const handleExportCSV = () => {
    if (processedTickets.length === 0) {
      triggerToast("কোনো টিকিট রেকর্ড খুঁজে পাওয়া যায়নি", "info");
      return;
    }

    let csv = "\ufeff"; // BOM for Excel Bengali fonts
    csv += "তারিখ (Date),কাস্টমার নাম (Customer Name),মোবাইল (Phone),পাসপোর্ট (Passport),PNR,এয়ারলাইন্স (Airline),গন্তব্য (Destination),ফ্লাইট নং (Flight No),ভ্রমণের তারিখ (Travel Date),টিকিট টাইপ (Type),ক্রয় মূল্য (Purchase BDT),বিক্রয় মূল্য (Sales BDT),লাভ (Profit BDT),পেমেন্ট স্ট্যাটাস (Status),পেমেন্ট পদ্ধতি (Method),স্টাফ (Staff),নোট (Notes)\n";

    processedTickets.forEach(t => {
      const cleanNotes = t.notes ? t.notes.replace(/,/g, " ") : "";
      const cleanName = t.customerName.replace(/,/g, " ");
      const cleanDest = t.destination.replace(/,/g, " ");
      csv += `${t.date},${cleanName},${t.phoneNumber},${t.passportNumber || "N/A"},${t.pnrNumber},${t.airlineName},${cleanDest},${t.flightNumber},${t.travelDate},${t.ticketType},${t.purchaseCost},${t.sellingPrice},${t.profit},${t.paymentStatus},${t.paymentMethod},${t.staffName},${cleanNotes}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `JT_Tours_Tickets_Report_${reportPeriod}_${filterMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast("রিপোর্টটি এক্সেল/সিএসভি আকারে ডাউনলোড করা হয়েছে!");
  };

  // Filter & Search Logics
  const processedTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // 1. Search Query Matcher
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query ? true : (
        ticket.pnrNumber.toLowerCase().includes(query) ||
        ticket.customerName.toLowerCase().includes(query) ||
        (ticket.passportNumber && ticket.passportNumber.toLowerCase().includes(query)) ||
        ticket.phoneNumber.includes(query) ||
        ticket.destination.toLowerCase().includes(query) ||
        ticket.date.includes(query) ||
        ticket.airlineName.toLowerCase().includes(query)
      );

      // 2. Period Filter Matcher
      let matchesPeriod = true;
      const tDateObj = new Date(ticket.date);
      const todayStr = new Date().toISOString().split("T")[0];
      
      if (reportPeriod === "today") {
        matchesPeriod = ticket.date === todayStr;
      } else if (reportPeriod === "week") {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        matchesPeriod = tDateObj >= lastWeek;
      } else if (reportPeriod === "month") {
        if (filterMonth !== "all") {
          const tMonth = String(tDateObj.getMonth() + 1).padStart(2, "0");
          matchesPeriod = tMonth === filterMonth;
        }
      } else if (reportPeriod === "year") {
        const tYear = String(tDateObj.getFullYear());
        matchesPeriod = tYear === filterYear;
      }

      // Year consistency for monthly and regular filters
      if (reportPeriod !== "year" && filterYear !== "all") {
        const tYear = String(tDateObj.getFullYear());
        if (tYear !== filterYear) matchesPeriod = false;
      }

      return matchesSearch && matchesPeriod;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [tickets, searchQuery, reportPeriod, filterMonth, filterYear]);

  // Aggregated Statistics Calculator
  const stats = useMemo(() => {
    let totalTickets = processedTickets.length;
    let totalPurchaseCost = 0;
    let totalSales = 0;
    let totalProfit = 0;
    let totalDue = 0;

    processedTickets.forEach(t => {
      totalPurchaseCost += t.purchaseCost;
      totalSales += t.sellingPrice;
      totalProfit += t.profit;
      
      // Calculate due
      if (t.paymentStatus === "Due") {
        totalDue += t.sellingPrice;
      } else if (t.paymentStatus === "Partial") {
        // Assume partial has 50% paid if amountPaid is not present, otherwise calculate sellingPrice - paid
        totalDue += Math.round(t.sellingPrice * 0.45); // Standardized fallback for partials
      }
    });

    return {
      totalTickets,
      totalPurchaseCost,
      totalSales,
      totalProfit,
      totalDue
    };
  }, [processedTickets]);

  // Helper to highlight fields extracted by AI with low confidence
  const getFieldConfidenceClass = (fieldName: string) => {
    if (formData.lowConfidenceFields?.includes(fieldName)) {
      return "ring-2 ring-amber-500/50 border-amber-500/50 bg-amber-500/10 placeholder:text-amber-400/40 text-amber-200";
    }
    return "bg-white/5 border-white/10 text-slate-100 focus:ring-blue-500/30 focus:border-blue-500/50";
  };

  const renderConfidenceBadge = (fieldName: string) => {
    if (formData.lowConfidenceFields?.includes(fieldName)) {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded-md ml-1 font-extrabold animate-pulse">
          ⚠️ নিশ্চিত করুন
        </span>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 relative overflow-x-hidden font-sans pb-16 selection:bg-indigo-500/40 selection:text-indigo-200">
      
      {/* Dynamic Glowing Mesh Elements for Frosted Glass Backdrop */}
      <div className="absolute top-[-5%] left-[-10%] w-[55%] h-[40%] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute top-[35%] right-[-10%] w-[45%] h-[50%] bg-indigo-500/8 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] bg-pink-500/5 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Elegant Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 right-8 z-50 flex items-center gap-3.5 bg-slate-900/95 backdrop-blur-2xl border border-white/10 px-6 py-4 rounded-2xl shadow-2xl max-w-md"
          >
            <div className={`w-3 h-3 rounded-full shrink-0 ${
              toast.type === "success" ? "bg-emerald-500 animate-pulse" :
              toast.type === "error" ? "bg-rose-500 animate-pulse" : "bg-blue-500 animate-pulse"
            }`} />
            <p className="text-sm font-semibold text-slate-200 leading-snug">{toast.message}</p>
            <button 
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-200 ml-4 transition-colors"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Application Main Navigation Header */}
      <header className="sticky top-0 z-30 bg-[#070b13]/60 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="p-1.5 bg-white rounded-2xl border border-white/10 shadow-2xl shadow-blue-500/5 transform hover:scale-102 transition-all">
              <Logo size="sm" showTagline={false} className="h-10 w-auto" />
            </div>
            <div className="text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 uppercase font-extrabold tracking-wider animate-pulse">
                  ONLINE PORTAL
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 uppercase font-bold tracking-wider">
                  TICKET ENGINE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium flex items-center justify-center sm:justify-start gap-1.5 mt-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                টিকিট হিসাব-নিকাশ, PNR লেজার ও রিপোর্ট জেনারেটর
              </p>
            </div>
          </div>

          {/* Key Secrets Configuration */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Google Sheets Integration Widget */}
            {!googleAccessToken ? (
              <div className="flex items-center gap-2">
                {isInIframe ? (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-md shadow-amber-500/10 hover:shadow-amber-500/20"
                    title="আইফ্রেম ব্লকিং এড়াতে নতুন ট্যাবে ওপেন করে কানেক্ট করুন"
                  >
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block", width: "100%", height: "100%" }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                    </div>
                    <span className="font-extrabold text-[11px]">নতুন ট্যাবে ওপেন করে কানেক্ট করুন (Open in New Tab)</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                  </a>
                ) : (
                  <button
                    onClick={handleGoogleSignIn}
                    className="bg-white hover:bg-slate-100 text-slate-900 text-xs font-extrabold px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-md shadow-black/20"
                    title="গুগল এক্সেল শিটে সকল ডাটা সেভ করতে কানেক্ট করুন"
                  >
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block", width: "100%", height: "100%" }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                    </div>
                    <span className="font-extrabold text-[11px] text-slate-900">গুগল এক্সেল কানেক্ট (Google Sheets)</span>
                  </button>
                )}
                <button
                  onClick={() => setShowAuthHelp(!showAuthHelp)}
                  className={`p-2 py-2.5 px-3 rounded-xl border transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                    showAuthHelp 
                      ? "bg-rose-500/15 border-rose-500/35 text-rose-300 hover:bg-rose-500/25" 
                      : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white"
                  }`}
                  title="লগইন সমস্যা সমাধান নির্দেশিকা"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">হেল্প</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-3 py-1.5 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  {googleUser?.photoURL ? (
                    <img src={googleUser.photoURL} alt={googleUser.displayName || "Google"} referrerPolicy="no-referrer" className="w-5.5 h-5.5 rounded-full border border-emerald-500/30" />
                  ) : (
                    <div className="w-5.5 h-5.5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[9px] font-extrabold shrink-0">
                      {googleUser?.displayName?.charAt(0) || "G"}
                    </div>
                  )}
                  <div className="text-left hidden sm:block">
                    <p className="text-[9px] text-slate-400 font-medium">কানেক্টেড</p>
                    <p className="text-[10px] font-bold text-emerald-300 line-clamp-1 max-w-[80px]">{googleUser?.displayName || "User"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 border-l border-white/10 pl-2">
                  {sheetId ? (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[9px] px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      title="গুগল এক্সেল শীট ফাইলটি নতুন ট্যাবে ওপেন করুন"
                    >
                      <FileText className="w-3 h-3" />
                      <span>এক্সেল শীট ↗</span>
                    </a>
                  ) : (
                    <button
                      onClick={() => triggerSheetsSync(googleAccessToken || "", tickets)}
                      disabled={isSyncingSheets}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isSyncingSheets ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      <span>তৈরি করুন</span>
                    </button>
                  )}
                  
                  <button
                    onClick={handleGoogleSignOut}
                    className="text-slate-400 hover:text-slate-200 text-[9px] hover:underline cursor-pointer"
                    title="গুগল অ্যাকাউন্ট সাইন-আউট করুন"
                  >
                    আউট
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white/5 border border-white/15 rounded-2xl px-4 py-2 flex items-center gap-2.5 max-w-xs backdrop-blur-md">
              <Key className="w-4 h-4 text-slate-400" />
              <input
                type="password"
                placeholder="Gemini API Key (ঐচ্ছিক)"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  localStorage.setItem("gemini_key", e.target.value);
                }}
                className="bg-transparent border-none text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none w-32 focus:w-48 transition-all"
                title="If left blank, server-side environment key or simulation mode will be used."
              />
              {apiKey && (
                <button 
                  onClick={() => {
                    setApiKey("");
                    localStorage.removeItem("gemini_key");
                  }}
                  className="text-slate-400 hover:text-slate-200 text-[10px] uppercase font-extrabold"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="text-right hidden lg:block border-l border-white/10 pl-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold">Active Connection</p>
              <p className="text-xs font-bold text-slate-300">Local Ledger Engine</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* Google Sheets Access Blocked Troubleshooting Guide */}
        <AnimatePresence>
          {showAuthHelp && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-slate-900/90 border border-amber-500/20 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-100 font-sans tracking-tight">
                      গুগল এক্সেল কানেকশন সমস্যা সমাধান গাইড (Google Sheets Connection Solution)
                    </h3>
                    <p className="text-xs text-amber-300 font-medium mt-0.5">
                      "Access blocked" বা "verification process" এর কারণে লগইন না হলে নিচের ধাপগুলো অনুসরণ করুন
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAuthHelp(false)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-6 text-xs text-slate-300 space-y-4 max-w-4xl border-t border-white/5 pt-5">
                {isInIframe && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-rose-300 space-y-2">
                    <p className="font-extrabold text-[13px] text-rose-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      আইফ্রেম (Iframe) সতর্কবার্তা:
                    </p>
                    <p className="leading-relaxed text-[11px] text-slate-300">
                      আপনি বর্তমানে গুগল এআই স্টুডিওর প্রিভিউ আইফ্রেমের (Iframe) মধ্যে অ্যাপটি দেখছেন। এই অবস্থায় গুগল সিকিউরিটি পলিসির কারণে লগইন পপআপ কাজ করবে না এবং <strong className="text-rose-400">"popup-closed-by-user"</strong> মেসেজ দেখাতে পারে। 
                    </p>
                    <p className="leading-relaxed text-[11px] text-slate-300">
                      <strong>সমাধান:</strong> অনুগ্রহ করে নিচের বাটনটিতে ক্লিক করে অ্যাপটি সম্পূর্ণ আলাদা নতুন একটি ব্রাউজার ট্যাবে (New Tab) ওপেন করুন এবং সেখানে 'গুগল এক্সেল কানেক্ট' বাটনে ক্লিক করে লগইন করুন।
                    </p>
                    <div className="pt-1">
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-rose-500/10 active:scale-95 cursor-pointer"
                      >
                        অ্যাপটি নতুন ট্যাবে ওপেন করুন <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                <p className="leading-relaxed text-[11px] text-slate-400">
                  গুগল সিকিউরিটি পলিসির কারণে, আমাদের এই নতুন অ্যাপটি প্রথম অবস্থায় গুগল ভেরিফিকেশন করার অনুমতি পায় না। গুগল শীট ও ড্রাইভের সংবেদনশীল (sensitive) এক্সেস নেওয়ার জন্য আপনার গুগল অ্যাকাউন্টটিকে এই গুগল প্রজেক্টের <strong>টেস্ট ব্যবহারকারী (Test User)</strong> হিসেবে যোগ করতে হবে। এটি সম্পূর্ণ নিরাপদ এবং মাত্র ১ মিনিট সময় লাগবে।
                </p>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3.5">
                  <p className="font-extrabold text-white text-[13px] border-b border-white/5 pb-2">সহজ সমাধান ধাপসমূহ:</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3 text-slate-300">
                      <div className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center font-bold text-[10px] text-amber-400">১</span>
                        <div>
                          <p className="font-bold text-slate-200">গুগল ক্লাউড কনসোলে প্রবেশ করুন</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            নতুন ট্যাবে <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline font-extrabold">console.cloud.google.com ↗</a> সাইটটি ওপেন করুন এবং আপনার গুগল অ্যাকাউন্ট দিয়ে লগইন করুন।
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center font-bold text-[10px] text-amber-400">২</span>
                        <div>
                          <p className="font-bold text-slate-200">প্রজেক্ট সিলেক্ট করুন</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            পৃষ্ঠার একেবারে উপরে বাম পাশে লোগোর পাশে থাকা ড্রপডাউন থেকে <strong>gen-lang-client-0992591740</strong> নামক প্রজেক্টটি নির্বাচন করুন।
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center font-bold text-[10px] text-amber-400">৩</span>
                        <div>
                          <p className="font-bold text-slate-200">OAuth consent screen-এ যান</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            বাম পাশের প্রধান মেনু (৩টি দাগ) থেকে <strong>APIs & Services (এপিআই এবং পরিষেবা)</strong> &gt; <strong>OAuth consent screen (ওঅথ সম্মতি স্ক্রীন)</strong> অপশনে ক্লিক করুন।
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 text-slate-300">
                      <div className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center font-bold text-[10px] text-amber-400">৪</span>
                        <div>
                          <p className="font-bold text-slate-200">আপনার ইমেইল টেস্ট ইউজার হিসেবে যুক্ত করুন</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            পৃষ্ঠাটিতে নিচের দিকে স্ক্রোল করে <strong>Test users (টেস্ট ব্যবহারকারী)</strong> সেকশনে যান। সেখানে <strong>+ ADD USERS (+ ব্যবহারকারী যোগ করুন)</strong> বাটনে ক্লিক করে আপনার ইমেইল (<strong>hanifrayhan70@gmail.com</strong>) লিখে সেভ করুন।
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center font-bold text-[10px] text-emerald-400">৫</span>
                        <div>
                          <p className="font-bold text-slate-200">এখন আবার গুগল এক্সেল কানেক্ট করুন</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            ইমেইল যুক্ত করার পর এই অ্যাপের উপরে থাকা <strong>'গুগল এক্সেল কানেক্ট'</strong> বাটনে আবার ক্লিক করুন। এবার আপনাকে লগইন করার অনুমতি দেওয়া হবে।
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center font-bold text-[10px] text-emerald-400">৬</span>
                        <div>
                          <p className="font-bold text-slate-200">নিরাপত্তা সতর্কবার্তা বাইপাস করুন</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            লগইন করার সময় যদি "This app is not verified" দেখায়, তবে চিন্তার কিছু নেই। নিচে ছোট করে লেখা <strong>Advanced (উন্নত)</strong> অপশনে ক্লিক করে <strong>Go to gen-lang-client-0992591740.firebaseapp.com (unsafe)</strong> লিংকে ক্লিক করে এক্সেস দিন।
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3.5">
                  <p className="text-[11px] text-amber-300/90 leading-relaxed font-medium">
                    💡 আপনি যদি আপনার গুগল ড্রাইভ এবং শিট কানেক্ট না করতে পারেন, তবুও টিকিট বুকিং, হিসাব-নিকাশ, লাভ নির্ণয়, রশিদ তৈরি এবং সকল প্রফেশনাল কাজ এই ব্রাউজারে সম্পূর্ণ স্বাভাবিকভাবে করতে পারবেন। এটি ব্রাউজারের লোকাল স্টোরেজে সম্পূর্ণ সুরক্ষিত থাকবে!
                  </p>
                  <button
                    onClick={() => setShowAuthHelp(false)}
                    className="bg-slate-850 hover:bg-slate-800 text-slate-200 border border-white/10 text-[10px] font-extrabold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer transition-colors"
                  >
                    ধন্যবাদ, বুঝতে পেরেছি
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Statistics Block with Glassmorphism */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Total Tickets Sold Card */}
          <div 
            onClick={() => {
              setViewMode("ledger");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="bg-gradient-to-br from-blue-500/10 via-white/5 to-white/5 backdrop-blur-xl border border-blue-500/20 p-5 rounded-2xl relative overflow-hidden group hover:border-blue-500/40 hover:bg-white/10 transition-all duration-300 cursor-pointer active:scale-[0.98]"
            title="টিকিট ট্র্যাকিং লেজারে যান"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/20 rounded-bl-full blur-xl group-hover:bg-blue-500/30 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">মোট টিকিট বিক্রি (Sold)</span>
              <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 animate-pulse">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-blue-400 tracking-tight">
              {stats.totalTickets.toLocaleString("bn-BD")} <span className="text-xs font-semibold text-slate-400">টি</span>
            </h2>
            <p className="text-[10px] text-blue-300 font-medium mt-1">ক্লিক করুন লেজার দেখতে ↗</p>
          </div>

          {/* Total Purchases Cost */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
            <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-bl-full blur-xl group-hover:bg-orange-500/15 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">মোট ক্রয় মূল্য (Purchase)</span>
              <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-orange-400 tracking-tight">
              {stats.totalPurchaseCost.toLocaleString("bn-BD")} <span className="text-xs font-semibold text-slate-400">৳</span>
            </h2>
            <p className="text-[10px] text-slate-500 mt-1">এয়ারলাইন্স পেমেন্ট বা খরচ</p>
          </div>

          {/* Total Sales (Selling Price Sum) */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
            <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 rounded-bl-full blur-xl group-hover:bg-indigo-500/15 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">মোট বিক্রয় মূল্য (Sales)</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-indigo-400 tracking-tight">
              {stats.totalSales.toLocaleString("bn-BD")} <span className="text-xs font-semibold text-slate-400">৳</span>
            </h2>
            <p className="text-[10px] text-slate-500 mt-1">কাস্টমার ইনভয়েস মূল্য</p>
          </div>

          {/* Total Profit Earned (Selling - Purchase) */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full blur-xl group-hover:bg-emerald-500/15 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">সর্বমোট লাভ (Profit)</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-emerald-400 tracking-tight">
              {stats.totalProfit.toLocaleString("bn-BD")} <span className="text-xs font-semibold text-slate-400">৳</span>
            </h2>
            <p className="text-[10px] text-slate-500 mt-1">নিট কমিশন বা লাভ</p>
          </div>

          {/* Total Outstanding Dues */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/10 rounded-bl-full blur-xl group-hover:bg-rose-500/15 transition-all"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">মোট বকেয়া (Due Amount)</span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-rose-400 tracking-tight">
              {stats.totalDue.toLocaleString("bn-BD")} <span className="text-xs font-semibold text-slate-400">৳</span>
            </h2>
            <p className="text-[10px] text-slate-500 mt-1">মার্কেট বা কাস্টমার বকেয়া</p>
          </div>

        </div>

        {/* Gemini AI Ticket File PDF/Image Scanner container - Compact design */}
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-pink-500/5 border border-indigo-500/20 rounded-2xl p-4 relative overflow-hidden shadow-lg">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 relative z-10">
            {/* Left side - Title and info */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-indigo-200 tracking-tight flex items-center gap-1.5">
                  📄 টিকিট পিডিএফ ও ইমেজ স্ক্যানার
                  <span className="bg-indigo-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">AI</span>
                </h3>
                <p className="text-[11px] text-slate-400 leading-snug max-w-lg">
                  এয়ারলাইন্সের আসল টিকিট PDF ফাইল অথবা ছবি আপলোড করুন; Gemini AI সব তথ্য এক ক্লিকে বুকিং ফর্মে বসিয়ে দেবে!
                </p>
              </div>
            </div>

            {/* Right side - Drag area & Upload button */}
            <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById("ticket-file-input")?.click()}
                className={`border-2 border-dashed rounded-xl px-4 py-2 text-center cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 min-w-[200px] h-11 relative overflow-hidden group ${
                  isDragOver 
                    ? "border-indigo-400 bg-indigo-500/15" 
                    : selectedFile 
                      ? "border-indigo-500/40 bg-slate-950/40 hover:border-indigo-500/60" 
                      : "border-white/10 bg-slate-950/20 hover:border-white/20"
                }`}
              >
                <input
                  type="file"
                  id="ticket-file-input"
                  className="hidden"
                  accept="application/pdf, image/*"
                  onChange={handleFileChange}
                />
                
                {selectedFile ? (
                  <div className="flex items-center gap-2 text-left">
                    <FileText className="w-4 h-4 text-indigo-300 shrink-0 animate-bounce" />
                    <div className="max-w-[130px]">
                      <p className="text-[10px] font-extrabold text-slate-200 line-clamp-1">{selectedFile.name}</p>
                      <p className="text-[9px] text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="text-[9px] font-extrabold text-rose-300 hover:text-rose-200 ml-1 underline"
                    >
                      বাতিল
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 justify-center">
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 group-hover:translate-y-0.5 transition-all" />
                    <span className="text-[11px] font-bold text-slate-300">টিকিট ফাইল সিলেক্ট করুন</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleFileParse}
                disabled={isFileLoading || !selectedFile}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs px-5 h-11 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                {isFileLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>বিশ্লেষণ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>স্ক্যান করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* View Selection Tabs */}
        <div className="flex border-b border-white/10 pb-0 gap-6 relative z-10">
          <button
            onClick={() => setViewMode("dashboard")}
            className={`pb-3 text-xs sm:text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 ${
              viewMode === "dashboard" 
                ? "border-blue-500 text-blue-400" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>✍️ টিকিট বুকিং এন্ট্রি (Booking Entry)</span>
          </button>
          <button
            onClick={() => setViewMode("ledger")}
            className={`pb-3 text-xs sm:text-sm font-extrabold transition-all border-b-2 flex items-center gap-2 relative ${
              viewMode === "ledger" 
                ? "border-blue-500 text-blue-400" 
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>📋 টিকিট ট্র্যাকিং লেজার (Ticket Ledger)</span>
            {tickets.length > 0 && (
              <span className="bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                {tickets.length}
              </span>
            )}
          </button>
        </div>

        {/* Google Sheets Sync status notifier bar */}
        {googleAccessToken && sheetsSyncStatus && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-xl p-3.5 flex items-center justify-between gap-4 z-10 relative animate-fade-in shadow-md">
            <div className="flex items-center gap-2">
              {isSyncingSheets ? (
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{sheetsSyncStatus}</span>
            </div>
            {sheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-200 underline flex items-center gap-1 shrink-0 font-extrabold text-[11px]"
              >
                গুগল এক্সেল শীট সরাসরি দেখুন ↗
              </a>
            )}
          </div>
        )}

        {/* Workspace Conditional Layout */}
        {viewMode === "dashboard" ? (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 rounded-3xl relative">
              
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                  <h3 className="font-extrabold text-base text-slate-100 tracking-tight">📝 টিকিট বুকিং এন্ট্রি করুন</h3>
                </div>
                {validationWarnings.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse font-semibold">
                    <AlertTriangle className="w-3 h-3" />
                    <span>অসম্পূর্ণ ফর্ম</span>
                  </div>
                )}
              </div>

              {/* Validation Warning Notice Panel */}
              {validationWarnings.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-2xl mb-4 text-[11px] text-amber-300/90 space-y-1">
                  <p className="font-bold flex items-center gap-1 text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>বাধ্যতামূলক ক্ষেত্রসমূহ বাকি আছে:</span>
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {validationWarnings.slice(0, 3).map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                    {validationWarnings.length > 3 && <li>ও আরও {validationWarnings.length - 3} টি বিষয়</li>}
                  </ul>
                </div>
              )}

              <form onSubmit={handleSaveTicket} className="space-y-5">
                
                {/* SECTION 1: CUSTOMER INFORMATION */}
                <div className="space-y-3.5 border-b border-white/5 pb-4">
                  <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    <span>👤 কাস্টমার তথ্য</span>
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>কাস্টমার নাম <span className="text-rose-500">*</span></span>
                        {renderConfidenceBadge("customerName")}
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={formData.customerName}
                          onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                          placeholder="উদা: আব্দুল করিম"
                          required
                          className={`w-full rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 ${getFieldConfidenceClass("customerName")}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>মোবাইল নম্বর</span>
                        {renderConfidenceBadge("phoneNumber")}
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                          placeholder="উদা: 01712345678"
                          className={`w-full rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 ${getFieldConfidenceClass("phoneNumber")}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>পাসপোর্ট নম্বর</span>
                        {renderConfidenceBadge("passportNumber")}
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={formData.passportNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, passportNumber: e.target.value }))}
                          placeholder="উদা: EG0481239"
                          className={`w-full rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 font-mono uppercase ${getFieldConfidenceClass("passportNumber")}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>টিকিট স্ট্যাটাস</span>
                        {renderConfidenceBadge("ticketStatus")}
                      </label>
                      <select
                        value={formData.ticketStatus}
                        onChange={(e) => setFormData(prev => ({ ...prev, ticketStatus: e.target.value }))}
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all ${getFieldConfidenceClass("ticketStatus")}`}
                      >
                        <option value="Confirmed">Confirmed (নিশ্চিতকৃত)</option>
                        <option value="Pending">Pending (অপেক্ষমান)</option>
                        <option value="Cancelled">Cancelled (বাতিলকৃত)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: FLIGHT & BOOKING INFORMATION */}
                <div className="space-y-3.5 border-b border-white/5 pb-4">
                  <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <Plane className="w-3.5 h-3.5" />
                    <span>✈️ বুকিং ও এয়ারলাইন্স</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>PNR নম্বর <span className="text-rose-500">*</span></span>
                        {renderConfidenceBadge("pnrNumber")}
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={formData.pnrNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, pnrNumber: e.target.value }))}
                          placeholder="উদা: K9R2PX"
                          required
                          className={`w-full rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 font-mono uppercase ${getFieldConfidenceClass("pnrNumber")}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>ই-টিকিট নম্বর</span>
                        {renderConfidenceBadge("eticketNumber")}
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={formData.eticketNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, eticketNumber: e.target.value }))}
                          placeholder="উদা: 147-1234567890"
                          className={`w-full rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 font-mono uppercase ${getFieldConfidenceClass("eticketNumber")}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>এয়ারলাইন্স</span>
                        {renderConfidenceBadge("airlineName")}
                      </label>
                      <select
                        value={formData.airlineName}
                        onChange={(e) => setFormData(prev => ({ ...prev, airlineName: e.target.value }))}
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all ${getFieldConfidenceClass("airlineName")}`}
                      >
                        <option value="কাতার এয়ারওয়েজ">কাতার এয়ারওয়েজ</option>
                        <option value="সাউদিয়া এয়ারলাইন্স">সাউদিয়া এয়ারলাইন্স</option>
                        <option value="বাংলাদেশ বিমান">বাংলাদেশ বিমান</option>
                        <option value="এমিরেটস এয়ারলাইন্স">এমিরেটস এয়ারলাইন্স</option>
                        <option value="ইউএস-বাংলা">ইউএস-বাংলা</option>
                        <option value="এয়ার এরাবিয়া">এয়ার এরাবিয়া</option>
                        <option value="কুেইত এয়ারওয়েজ">কুয়েত এয়ারওয়েজ</option>
                        <option value="অন্যান্য এয়ারলাইন্স">অন্যান্য এয়ারলাইন্স</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>ফ্লাইট নম্বর</span>
                        {renderConfidenceBadge("flightNumber")}
                      </label>
                      <input
                        type="text"
                        value={formData.flightNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, flightNumber: e.target.value }))}
                        placeholder="উদা: QR-639"
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 font-mono uppercase ${getFieldConfidenceClass("flightNumber")}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>বুকিং ক্লাস (Cabin Class)</span>
                        {renderConfidenceBadge("bookingClass")}
                      </label>
                      <input
                        type="text"
                        value={formData.bookingClass}
                        onChange={(e) => setFormData(prev => ({ ...prev, bookingClass: e.target.value }))}
                        placeholder="উদা: Economy (Y) / Business"
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 font-mono uppercase ${getFieldConfidenceClass("bookingClass")}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">টিকিটের ধরন</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, ticketType: "One Way" }))}
                          className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                            formData.ticketType === "One Way"
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                              : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                          }`}
                        >
                          One Way
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, ticketType: "Round Trip" }))}
                          className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                            formData.ticketType === "Round Trip"
                              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                              : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                          }`}
                        >
                          Round Trip
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: TRAVEL DETAILED */}
                <div className="space-y-3.5 border-b border-white/5 pb-4">
                  <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" />
                    <span>🗺️ ভ্রমণ বিবরণী</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>কোথা থেকে (From Airport)</span>
                        {renderConfidenceBadge("fromAirport")}
                      </label>
                      <input
                        type="text"
                        value={formData.fromAirport}
                        onChange={(e) => setFormData(prev => ({ ...prev, fromAirport: e.target.value }))}
                        placeholder="উদা: Dhaka (DAC)"
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 font-sans uppercase ${getFieldConfidenceClass("fromAirport")}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>কোথায় (To Airport / Destination)</span>
                        {renderConfidenceBadge("destination")}
                      </label>
                      <input
                        type="text"
                        value={formData.destination}
                        onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
                        placeholder="উদা: Jeddah (JED)"
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 font-sans uppercase ${getFieldConfidenceClass("destination")}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>রওয়ানার তারিখ <span className="text-rose-500">*</span></span>
                        {renderConfidenceBadge("travelDate")}
                      </label>
                      <input
                        type="date"
                        value={formData.travelDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, travelDate: e.target.value }))}
                        required
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all ${getFieldConfidenceClass("travelDate")}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>রওয়ানার সময় (Departure Time)</span>
                        {renderConfidenceBadge("departureTime")}
                      </label>
                      <input
                        type="text"
                        value={formData.departureTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, departureTime: e.target.value }))}
                        placeholder="উদা: 04:30 AM / 16:15"
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 ${getFieldConfidenceClass("departureTime")}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>পৌঁছানোর তারিখ</span>
                        {renderConfidenceBadge("arrivalDate")}
                      </label>
                      <input
                        type="date"
                        value={formData.arrivalDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, arrivalDate: e.target.value }))}
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all ${getFieldConfidenceClass("arrivalDate")}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>পৌঁছানোর সময় (Arrival Time)</span>
                        {renderConfidenceBadge("arrivalTime")}
                      </label>
                      <input
                        type="text"
                        value={formData.arrivalTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, arrivalTime: e.target.value }))}
                        placeholder="উদা: 08:45 PM"
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 ${getFieldConfidenceClass("arrivalTime")}`}
                      />
                    </div>
                  </div>

                  {formData.ticketType === "Round Trip" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                          <span>ফেরতের তারিখ</span>
                          {renderConfidenceBadge("returnDate")}
                        </label>
                        <input
                          type="date"
                          value={formData.returnDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, returnDate: e.target.value }))}
                          className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all ${getFieldConfidenceClass("returnDate")}`}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                          <span>রিটার্ন ফ্লাইট নম্বর</span>
                          {renderConfidenceBadge("returnFlightNumber")}
                        </label>
                        <input
                          type="text"
                          value={formData.returnFlightNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, returnFlightNumber: e.target.value }))}
                          placeholder="উদা: QR-638"
                          className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 font-mono uppercase ${getFieldConfidenceClass("returnFlightNumber")}`}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>টার্মিনাল (Terminal)</span>
                        {renderConfidenceBadge("terminal")}
                      </label>
                      <input
                        type="text"
                        value={formData.terminal}
                        onChange={(e) => setFormData(prev => ({ ...prev, terminal: e.target.value }))}
                        placeholder="উদা: T3 / T1"
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 ${getFieldConfidenceClass("terminal")}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>লাগেজ সীমা (Baggage)</span>
                        {renderConfidenceBadge("baggageAllowance")}
                      </label>
                      <input
                        type="text"
                        value={formData.baggageAllowance}
                        onChange={(e) => setFormData(prev => ({ ...prev, baggageAllowance: e.target.value }))}
                        placeholder="উদা: 30 KG / 2PC"
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 ${getFieldConfidenceClass("baggageAllowance")}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>সীট নম্বর (Seat No.)</span>
                        {renderConfidenceBadge("seatNumber")}
                      </label>
                      <input
                        type="text"
                        value={formData.seatNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, seatNumber: e.target.value }))}
                        placeholder="উদা: 24A / 12D"
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 font-mono uppercase ${getFieldConfidenceClass("seatNumber")}`}
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 4: FINANCIALS & PAYMENT */}
                <div className="space-y-3.5">
                  <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>💰 আর্থিক ও হিসাব</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>ক্রয় মূল্য (BDT) <span className="text-rose-500">*</span></span>
                        {renderConfidenceBadge("purchaseCost")}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-slate-400 text-sm font-bold">৳</span>
                        <input
                          type="number"
                          value={formData.purchaseCost}
                          onChange={(e) => setFormData(prev => ({ ...prev, purchaseCost: e.target.value }))}
                          placeholder="0"
                          required
                          className={`w-full rounded-xl pl-8 pr-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 ${getFieldConfidenceClass("purchaseCost")}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>বিক্রয় মূল্য (BDT) <span className="text-rose-500">*</span></span>
                        {renderConfidenceBadge("sellingPrice")}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-slate-400 text-sm font-bold">৳</span>
                        <input
                          type="number"
                          value={formData.sellingPrice}
                          onChange={(e) => setFormData(prev => ({ ...prev, sellingPrice: e.target.value }))}
                          placeholder="0"
                          required
                          className={`w-full rounded-xl pl-8 pr-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 ${getFieldConfidenceClass("sellingPrice")}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Real-time calculated profit indicator */}
                  {formData.purchaseCost && formData.sellingPrice && (
                    <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400">লাভের পরিমাণ (Estimated Profit):</span>
                      <span className={`text-sm font-extrabold ${
                        parseFloat(formData.sellingPrice) - parseFloat(formData.purchaseCost) >= 0 
                          ? "text-emerald-400" 
                          : "text-rose-400"
                      }`}>
                        {(parseFloat(formData.sellingPrice) - parseFloat(formData.purchaseCost)).toLocaleString("bn-BD")} BDT ৳
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">পেমেন্ট স্ট্যাটাস</label>
                      <select
                        value={formData.paymentStatus}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentStatus: e.target.value as "Paid" | "Partial" | "Due" }))}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                      >
                        <option value="Paid">Paid (সম্পূর্ণ পরিশোধিত)</option>
                        <option value="Partial">Partial (আংশিক পরিশোধিত)</option>
                        <option value="Due">Due (বকেয়া)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">পেমেন্ট মাধ্যম</label>
                      <select
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value as "Cash" | "Bank" | "bKash" | "Nagad" | "Card" }))}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                      >
                        <option value="Cash">Cash (নগদ ক্যাশ)</option>
                        <option value="Bank">Bank (ব্যাংক ট্রান্সফার)</option>
                        <option value="bKash">bKash (বিকাশ)</option>
                        <option value="Nagad">Nagad (নগদ)</option>
                        <option value="Card">Card (ক্রেডিট/ডেবিট কার্ড)</option>
                      </select>
                    </div>
                  </div>

                  <MobilePaymentHelper
                    paymentMethod={formData.paymentMethod}
                    amount={formData.sellingPrice || ""}
                    reference={formData.pnrNumber || formData.customerName || ""}
                    onApplyVerification={(details) => {
                      setFormData(prev => ({
                        ...prev,
                        paymentStatus: details.paymentStatus,
                        amountPaid: details.amountPaid || prev.amountPaid,
                        notes: prev.notes ? `${prev.notes}\n${details.notesAddition}` : details.notesAddition
                      }));
                      triggerToast("পেমেন্ট তথ্য ভেরিফাই করে সফলভাবে ফর্মে ইনপুট করা হয়েছে! 🎉", "success");
                    }}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider flex items-center justify-between">
                        <span>দায়িত্বপ্রাপ্ত স্টাফ / বুকিং এজেন্ট</span>
                        {renderConfidenceBadge("staffName")}
                      </label>
                      <input
                        type="text"
                        value={formData.staffName}
                        onChange={(e) => setFormData(prev => ({ ...prev, staffName: e.target.value }))}
                        placeholder="স্টাফের নাম লিখুন"
                        className={`w-full rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 transition-all placeholder:text-slate-600 ${getFieldConfidenceClass("staffName")}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">রেকর্ড বা এন্ট্রি ডেট</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">অতিরিক্ত নোট বা মন্তব্য</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="পেমেন্ট হিস্ট্রি, কাস্টমার ডিমান্ড বা অন্যান্য মন্তব্য..."
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold py-3.5 rounded-2xl transition-all shadow-xl shadow-blue-500/10 flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>টিকিট ডাটাবেজে সেভ করুন</span>
                </button>

              </form>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col space-y-6">
            
            {/* Direct Back Button to Dashboard */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setViewMode("dashboard");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="group flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl border border-white/15 transition-all shadow-lg shadow-black/20"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span>◀ বুকিং ড্যাশবোর্ডে ফিরে যান (Back to Dashboard)</span>
              </button>
              
              <div className="text-xs text-slate-400">
                হোম / <span className="text-blue-400 font-bold">টিকিট লেজার</span>
              </div>
            </div>

            {/* Detailed Tickets Table Ledger & Controls (Full Width) */}
            <div id="ticket-ledger" className="flex flex-col space-y-6 scroll-mt-6 w-full">
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl flex-1 flex flex-col overflow-hidden">
              
              {/* Header section with Report downloads */}
              <div className="p-6 border-b border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-100 tracking-tight flex items-center gap-2">
                      <span className="text-blue-400">📋</span> টিকিট ট্র্যাকিং লেজার ({processedTickets.length})
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">ফিল্টারকৃত বা সার্চ করা টিকিট ডাটার রিয়েল-টাইম তালিকা</p>
                  </div>

                  <button
                    onClick={handleExportCSV}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-xs font-bold px-4 py-2.5 rounded-xl border border-emerald-500/20 transition-all flex items-center gap-2 self-start sm:self-auto"
                  >
                    <Download className="w-4 h-4" />
                    <span>Excel / CSV রিপোর্ট</span>
                  </button>
                </div>

                {/* Periodic filter bar */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/40 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => { setReportPeriod("all"); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportPeriod === "all" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    সব রেকর্ড
                  </button>
                  <button
                    onClick={() => { setReportPeriod("today"); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportPeriod === "today" ? "bg-white/10 text-white animate-pulse" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    আজকের (Daily)
                  </button>
                  <button
                    onClick={() => { setReportPeriod("week"); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportPeriod === "week" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    ৭ দিন (Weekly)
                  </button>
                  <button
                    onClick={() => { setReportPeriod("month"); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportPeriod === "month" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    মাসিক (Monthly)
                  </button>
                  <button
                    onClick={() => { setReportPeriod("year"); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportPeriod === "year" ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    বাৎসরিক (Yearly)
                  </button>
                </div>

                {/* Sub-selectors (Search bar + Month/Year selectors) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="PNR, নাম, মোবাইল, গন্তব্য..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950/30 border border-white/10 rounded-xl pl-9.5 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/40 font-medium"
                    />
                  </div>

                  {/* Month Filter selector - only relevant if reportPeriod is set to 'month' or general */}
                  <div>
                    <select
                      value={filterMonth}
                      onChange={(e) => {
                        setFilterMonth(e.target.value);
                        setReportPeriod("month"); // auto switch to month period
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="all">সব মাস (All Months)</option>
                      <option value="01">জানুয়ারি (January)</option>
                      <option value="02">ফেব্রুয়ারি (February)</option>
                      <option value="03">মার্চ (March)</option>
                      <option value="04">এপ্রিল (April)</option>
                      <option value="05">মে (May)</option>
                      <option value="06">জুন (June)</option>
                      <option value="07">জুলাই (July)</option>
                      <option value="08">আগস্ট (August)</option>
                      <option value="09">সেপ্টেম্বর (September)</option>
                      <option value="10">অক্টোবর (October)</option>
                      <option value="11">নভেম্বর (November)</option>
                      <option value="12">ডিসেম্বর (December)</option>
                    </select>
                  </div>

                  {/* Year selector */}
                  <div>
                    <select
                      value={filterYear}
                      onChange={(e) => {
                        setFilterYear(e.target.value);
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                    >
                      <option value="all">সব বছর (All Years)</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>
                </div>

              </div>

              {/* Responsive ledger table */}
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] uppercase text-slate-400 tracking-wider">
                      <th className="p-4 font-bold">তারিখ / PNR</th>
                      <th className="p-4 font-bold">কাস্টমার ও এয়ারলাইন্স</th>
                      <th className="p-4 font-bold">গন্তব্য ও ফ্লাইট</th>
                      <th className="p-4 font-bold text-right">লাভ / মূল্য (৳)</th>
                      <th className="p-4 font-bold text-center">স্ট্যাটাস / পদ্ধতি</th>
                      <th className="p-4 font-bold text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-white/5">
                    {processedTickets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-500">
                          <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="font-bold text-sm text-slate-400 mb-1">কোনো টিকিট রেকর্ড খুঁজে পাওয়া যায়নি।</p>
                          <p className="text-xs text-slate-500">অনুগ্রহ করে সার্চ বা পিরিয়ড ফিল্টার পরিবর্তন করুন, অথবা বাম পাশের ফর্মে নতুন টিকিট বুকিং এন্ট্রি করুন।</p>
                        </td>
                      </tr>
                    ) : (
                      processedTickets.map((t) => {
                        const isLossOrZero = t.profit <= 0;
                        return (
                          <motion.tr 
                            key={t.id} 
                            className={`group cursor-pointer border-b border-white/5 last:border-0 transition-colors ${
                              isLossOrZero ? "bg-rose-950/20 hover:bg-rose-950/30 border-l-[3px] border-l-rose-500/80" : ""
                            }`}
                            whileHover={{ 
                              scale: 1.002, 
                              backgroundColor: isLossOrZero ? "rgba(244, 63, 94, 0.1)" : "rgba(255, 255, 255, 0.04)",
                              boxShadow: isLossOrZero ? "0 4px 20px -2px rgba(244, 63, 94, 0.15)" : "0 4px 20px -2px rgba(99, 102, 241, 0.08)"
                            }}
                            whileTap={{ scale: 0.995 }}
                            transition={{ type: "spring", stiffness: 400, damping: 28 }}
                            onClick={() => setSelectedTicket(t)}
                          >
                            {/* Date and PNR */}
                            <td className="p-4 whitespace-nowrap">
                              <p className="font-mono text-slate-400">{t.date}</p>
                              <span className="inline-block mt-1 font-mono text-xs font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                                {t.pnrNumber}
                              </span>
                            </td>

                            {/* Customer and Airline */}
                            <td className="p-4 max-w-[180px] truncate">
                              <p className="font-extrabold text-slate-200">{t.customerName}</p>
                              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                {t.airlineName}
                              </p>
                            </td>

                            {/* Destination and flight */}
                            <td className="p-4 whitespace-nowrap">
                              <p className="font-semibold text-slate-300">{t.destination}</p>
                              <p className="text-[10px] font-mono text-slate-500 mt-1">{t.flightNumber} • {t.ticketType}</p>
                            </td>

                            {/* Cost, sales, and profit */}
                            <td className="p-4 text-right whitespace-nowrap">
                              <p className="text-slate-400 font-medium font-mono text-[11px]">বিক্রয়: {t.sellingPrice.toLocaleString()} ৳</p>
                              <p className={`font-extrabold font-mono mt-0.5 text-xs ${
                                t.profit < 0 ? "text-rose-400 animate-pulse" : t.profit === 0 ? "text-amber-400" : "text-emerald-400"
                              }`}>
                                {t.profit < 0 
                                  ? `লোকসান: ${t.profit.toLocaleString()} ৳` 
                                  : t.profit === 0 
                                  ? `লাভহীন: ০ ৳` 
                                  : `লাভ: +${t.profit.toLocaleString()} ৳`}
                              </p>
                            </td>

                          {/* Badges for status/method */}
                          <td className="p-4 text-center whitespace-nowrap">
                            <div>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                                t.paymentStatus === "Paid" 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                  : t.paymentStatus === "Partial"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              }`}>
                                {t.paymentStatus === "Paid" ? "Paid" : t.paymentStatus === "Partial" ? "Partial" : "Due"}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-medium block mt-1 font-mono">
                              via {t.paymentMethod}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedTicket(t)}
                                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all"
                                title="সম্পূর্ণ তথ্য দেখুন"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleStartEdit(t)}
                                className="text-slate-400 hover:text-blue-400 p-1.5 rounded-lg hover:bg-blue-500/10 transition-all"
                                title="এডিট করুন"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTicket(t.id, t.customerName)}
                                className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-all opacity-40 group-hover:opacity-100"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table ledger footer stat lines */}
              <div className="p-4.5 bg-slate-950/30 border-t border-white/5 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>ফিল্টারকৃত রেকর্ড সংখ্যা: <strong className="text-slate-200">{processedTickets.length} টি</strong></span>
                </div>
                <div className="flex gap-4 font-mono">
                  <span>মোট ক্রয়: <strong className="text-orange-400">{stats.totalPurchaseCost.toLocaleString()} ৳</strong></span>
                  <span>মোট বিক্রয়: <strong className="text-indigo-400">{stats.totalSales.toLocaleString()} ৳</strong></span>
                  <span>লাভ: <strong className="text-emerald-400">+{stats.totalProfit.toLocaleString()} ৳</strong></span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      </main>

      {/* DETAILED TICKET MODAL VIEW */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="absolute inset-0 bg-[#070b13]/80 backdrop-blur-md"
            />
            
            {/* Card Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-white/15 p-6 rounded-3xl shadow-2xl z-10 overflow-hidden"
            >
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-2xl">
                    <Plane className="w-5 h-5 transform -rotate-45" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">টিকিটের সম্পূর্ণ ফাইল বিবরণী</h3>
                    <p className="text-[10px] text-slate-400 font-mono">ID: {selectedTicket.id} • বুকিং এন্ট্রি ডেট: {selectedTicket.date}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTicket(null)}
                  className="p-1.5 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Data Grid Body */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-xs max-h-[60vh] overflow-y-auto pr-2">
                
                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">কাস্টমারের নাম</span>
                  <p className="text-sm font-bold text-slate-100">{selectedTicket.customerName}</p>
                </div>

                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">মোবাইল নম্বর</span>
                  <p className="text-sm font-semibold text-slate-200 font-mono">{selectedTicket.phoneNumber || "N/A"}</p>
                </div>

                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">PNR নম্বর</span>
                  <p className="text-sm font-black text-blue-400 font-mono uppercase">{selectedTicket.pnrNumber}</p>
                </div>

                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">ই-টিকিট নম্বর</span>
                  <p className="text-sm font-semibold text-slate-200 font-mono uppercase">{selectedTicket.eticketNumber || "N/A"}</p>
                </div>

                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">পাসপোর্ট নম্বর</span>
                  <p className="text-sm font-semibold text-slate-200 font-mono uppercase">{selectedTicket.passportNumber || "N/A"}</p>
                </div>

                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">টিকিট স্ট্যাটাস</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                    selectedTicket.ticketStatus === "Confirmed" 
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                      : selectedTicket.ticketStatus === "Cancelled"
                        ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  }`}>
                    {selectedTicket.ticketStatus || "Confirmed"}
                  </span>
                </div>

                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">এয়ারলাইন্স & বুকিং ক্লাস</span>
                  <p className="text-sm font-bold text-slate-200">{selectedTicket.airlineName} {selectedTicket.bookingClass ? `(${selectedTicket.bookingClass})` : ""}</p>
                </div>

                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">ফ্লাইট ও টিকিট ধরণ</span>
                  <p className="text-sm font-bold text-slate-200 font-mono">{selectedTicket.flightNumber || "N/A"} ({selectedTicket.ticketType})</p>
                </div>

                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">কোথা থেকে (From Airport)</span>
                  <p className="text-sm font-bold text-slate-200">{selectedTicket.fromAirport || "DAC"}</p>
                </div>

                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">গন্তব্য (To Airport)</span>
                  <p className="text-sm font-bold text-slate-200">{selectedTicket.destination}</p>
                </div>

                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">রওয়ানার তারিখ ও সময়</span>
                  <p className="text-sm font-bold text-slate-200 font-mono">{selectedTicket.travelDate} {selectedTicket.departureTime ? `at ${selectedTicket.departureTime}` : ""}</p>
                </div>

                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">পৌঁছানোর তারিখ ও সময়</span>
                  <p className="text-sm font-bold text-slate-200 font-mono">
                    {selectedTicket.arrivalDate || selectedTicket.travelDate} {selectedTicket.arrivalTime ? `at ${selectedTicket.arrivalTime}` : ""}
                  </p>
                </div>

                {selectedTicket.ticketType === "Round Trip" && (
                  <>
                    <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">ফেরতের তারিখ</span>
                      <p className="text-sm font-bold text-slate-200 font-mono">{selectedTicket.returnDate || "N/A"}</p>
                    </div>

                    <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">রিটার্ন ফ্লাইট নম্বর</span>
                      <p className="text-sm font-bold text-slate-200 font-mono">{selectedTicket.returnFlightNumber || "N/A"}</p>
                    </div>
                  </>
                )}

                <div className="col-span-1 sm:col-span-2 grid grid-cols-3 gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block font-bold">টার্মিনাল</span>
                    <p className="text-xs font-bold text-slate-200 mt-0.5">{selectedTicket.terminal || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block font-bold">লাগেজ সীমা</span>
                    <p className="text-xs font-bold text-slate-200 mt-0.5">{selectedTicket.baggageAllowance || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block font-bold">সীট নম্বর</span>
                    <p className="text-xs font-bold text-slate-200 mt-0.5">{selectedTicket.seatNumber || "N/A"}</p>
                  </div>
                </div>

                {/* Costs breakdown container with high-contrast slate highlights */}
                <div className="col-span-1 sm:col-span-2 grid grid-cols-3 gap-3 bg-slate-950/40 p-3.5 rounded-2xl border border-white/5 mt-2">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">ক্রয় মূল্য</span>
                    <p className="text-sm font-bold text-orange-400 font-mono mt-0.5">{selectedTicket.purchaseCost.toLocaleString("bn-BD")} ৳</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">বিক্রয় মূল্য</span>
                    <p className="text-sm font-bold text-indigo-400 font-mono mt-0.5">{selectedTicket.sellingPrice.toLocaleString("bn-BD")} ৳</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">নিট লাভ</span>
                    <p className="text-sm font-black text-emerald-400 font-mono mt-0.5">+{selectedTicket.profit.toLocaleString("bn-BD")} ৳</p>
                  </div>
                </div>

                {/* Additional tracking info */}
                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">পেমেন্ট স্ট্যাটাস ও মাধ্যম</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold ${
                      selectedTicket.paymentStatus === "Paid" 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : selectedTicket.paymentStatus === "Partial"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-rose-500/20 text-rose-400"
                    }`}>
                      {selectedTicket.paymentStatus}
                    </span>
                    <span className="text-slate-300 text-xs font-semibold">({selectedTicket.paymentMethod})</span>
                  </div>
                </div>

                <div className="space-y-1.5 p-2 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">দায়িত্বপ্রাপ্ত স্টাফ</span>
                  <p className="text-sm font-bold text-slate-200 mt-0.5">{selectedTicket.staffName}</p>
                </div>

                {selectedTicket.notes && (
                  <div className="col-span-1 sm:col-span-2 space-y-1.5 p-3.5 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 text-slate-300">
                    <span className="text-[9px] text-indigo-300 uppercase tracking-widest font-extrabold block">অতিরিক্ত নোট / মন্তব্য:</span>
                    <p className="italic leading-relaxed">{selectedTicket.notes}</p>
                  </div>
                )}

              </div>

              {/* Close controls */}
              <div className="mt-6 pt-4 border-t border-white/5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    generateReceiptPDF(selectedTicket);
                    triggerToast("রিসিটটি সফলভাবে PDF আকারে ডাউনলোড করা হয়েছে! 📄", "success");
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md hover:shadow-indigo-500/20"
                >
                  <FileText className="w-4 h-4" />
                  <span>রিসিট ডাউনলোড (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="bg-white/5 hover:bg-white/10 text-slate-200 font-bold px-5 py-2.5 rounded-xl text-xs transition-all"
                >
                  বন্ধ করুন
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* USER CONFIRMATION MODAL FOR SAVING TICKET */}
      <AnimatePresence>
        {ticketToConfirmSave && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTicketToConfirmSave(null)}
              className="absolute inset-0 bg-[#070b13]/85 backdrop-blur-md"
            />
            
            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-slate-900 border border-indigo-500/30 p-6 rounded-3xl shadow-2xl z-10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              
              {/* Icon & Title */}
              <div className="flex items-center gap-3 mb-5 border-b border-white/10 pb-4">
                <div className="p-2 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">বুকিং রেকর্ড সংরক্ষণ নিশ্চিতকরণ</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">অনুগ্রহ করে তথ্যগুলো একবার শেষবারের মতো যাচাই করে নিন।</p>
                </div>
              </div>

              {/* Fact Sheet Grid */}
              <div className="space-y-3.5 text-xs text-slate-300">
                <div className="grid grid-cols-2 gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">যাত্রীর নাম (Passenger)</span>
                    <span className="text-sm font-bold text-slate-100 block mt-0.5">{ticketToConfirmSave.customerName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">PNR নম্বর (PNR Number)</span>
                    <span className="text-sm font-black text-blue-400 font-mono block mt-0.5 uppercase">{ticketToConfirmSave.pnrNumber}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">গন্তব্য ও এয়ারলাইন</span>
                    <span className="text-slate-200 font-semibold block mt-0.5">{ticketToConfirmSave.airlineName} ➔ {ticketToConfirmSave.destination}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">যাত্রার তারিখ (Travel Date)</span>
                    <span className="text-slate-200 font-mono font-bold block mt-0.5">{ticketToConfirmSave.travelDate}</span>
                  </div>
                </div>

                {/* Financial Overview Card */}
                <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-2xl">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[9px] text-slate-400 block">ক্রয়মূল্য</span>
                      <span className="text-xs font-bold text-orange-400 font-mono">{ticketToConfirmSave.purchaseCost.toLocaleString("bn-BD")} ৳</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block">বিক্রয়মূল্য</span>
                      <span className="text-xs font-bold text-indigo-400 font-mono">{ticketToConfirmSave.sellingPrice.toLocaleString("bn-BD")} ৳</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-emerald-400 block font-bold">মোট লাভ</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">+{ticketToConfirmSave.profit.toLocaleString("bn-BD")} ৳</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center gap-3 justify-end mt-6 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setTicketToConfirmSave(null)}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 font-bold px-5 py-2.5 rounded-xl text-xs transition-all"
                >
                  ফিরে যান
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveTicket}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-600/15 flex items-center gap-1.5 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>তথ্যটি নিশ্চিত ও সংরক্ষণ করুন</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM DELETE CONFIRMATION DIALOG */}
      <AnimatePresence>
        {ticketToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTicketToDelete(null)}
              className="absolute inset-0 bg-[#070b13]/85 backdrop-blur-md"
            />
            
            {/* Card Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-slate-900 border border-rose-500/20 p-6 rounded-3xl shadow-2xl z-10"
            >
              {/* Header */}
              <div className="flex items-center gap-3.5 mb-4 border-b border-white/10 pb-4">
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/20 text-rose-400 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-rose-400 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">আপনি কি নিশ্চিতভাবে মুছতে চান?</h3>
                  <p className="text-[10px] text-rose-400 mt-0.5">এই অ্যাকশনটি বিপরীতমুখী নয় এবং তথ্যটি স্থায়ীভাবে মুছে যাবে!</p>
                </div>
              </div>

              {/* Ticket Details summary */}
              <div className="bg-rose-500/5 border border-rose-500/10 p-3.5 rounded-2xl mb-5 text-xs text-slate-300">
                <p className="mb-1 text-slate-400 font-medium">মুছে ফেলার লক্ষ্য রেকর্ড:</p>
                <div className="space-y-1 mt-1.5 font-mono text-[11px]">
                  <p>যাত্রীর নাম: <strong className="text-slate-100 font-sans">{ticketToDelete.customerName}</strong></p>
                  <p>রেকর্ড ID: <strong className="text-slate-400">{ticketToDelete.id}</strong></p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3.5">
                <button
                  type="button"
                  onClick={() => setTicketToDelete(null)}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 font-semibold px-4.5 py-2.5 rounded-xl text-xs transition-all"
                >
                  বাতিল করুন
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteTicket}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-rose-600/15 transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>স্থায়ীভাবে মুছে ফেলুন</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDITING DIALOG MODAL PANEL */}
      <AnimatePresence>
        {editingTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTicket(null)}
              className="absolute inset-0 bg-[#070b13]/85 backdrop-blur-md"
            />
            
            {/* Edit Container Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-white/15 p-6 rounded-3xl shadow-2xl z-10 overflow-y-auto max-h-[90vh]"
            >
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/15 border border-blue-500/20 text-blue-400 rounded-2xl">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">টিকিট তথ্য সংশোধন বা এডিট করুন</h3>
                    <p className="text-[10px] text-slate-400 font-mono">ID: {editingTicket.id} • সংশোধন মোড</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingTicket(null)}
                  className="p-1.5 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Data Input Fields Form */}
              <form onSubmit={handleUpdateTicket} className="space-y-4 text-xs">
                
                {/* Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">কাস্টমার নাম *</label>
                    <input
                      type="text"
                      value={editingTicket.customerName}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, customerName: e.target.value } : null)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">মোবাইল নম্বর</label>
                    <input
                      type="text"
                      value={editingTicket.phoneNumber}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, phoneNumber: e.target.value } : null)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                {/* PNR & Passport */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">PNR নম্বর *</label>
                    <input
                      type="text"
                      value={editingTicket.pnrNumber}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, pnrNumber: e.target.value } : null)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 font-mono uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">পাসপোর্ট নম্বর</label>
                    <input
                      type="text"
                      value={editingTicket.passportNumber || ""}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, passportNumber: e.target.value } : null)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 font-mono uppercase"
                    />
                  </div>
                </div>

                {/* Airline & Destination */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">এয়ারলাইন্স</label>
                    <select
                      value={editingTicket.airlineName}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, airlineName: e.target.value } : null)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 focus:outline-none"
                    >
                      <option value="কাতার এয়ারওয়েজ">কাতার এয়ারওয়েজ</option>
                      <option value="সাউদিয়া এয়ারলাইন্স">সাউদিয়া এয়ারলাইন্স</option>
                      <option value="বাংলাদেশ বিমান">বাংলাদেশ বিমান</option>
                      <option value="এমিরেটস এয়ারলাইন্স">এমিরেটস এয়ারলাইন্স</option>
                      <option value="ইউএস-বাংলা">ইউএস-বাংলা</option>
                      <option value="এয়ার এরাবিয়া">এয়ার এরাবিয়া</option>
                      <option value="কুয়েত এয়ারওয়েজ">কুয়েত এয়ারওয়েজ</option>
                      <option value="অন্যান্য এয়ারলাইন্স">অন্যান্য এয়ারলাইন্স</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">গন্তব্য (Destination)</label>
                    <input
                      type="text"
                      value={editingTicket.destination}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, destination: e.target.value } : null)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                {/* Flight Number & Ticket Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">ফ্লাইট নম্বর</label>
                    <input
                      type="text"
                      value={editingTicket.flightNumber}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, flightNumber: e.target.value } : null)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-blue-500/50 font-mono uppercase"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">টিকিট টাইপ</label>
                    <select
                      value={editingTicket.ticketType}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, ticketType: e.target.value as "One Way" | "Round Trip" } : null)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 focus:outline-none"
                    >
                      <option value="One Way">One Way</option>
                      <option value="Round Trip">Round Trip</option>
                    </select>
                  </div>
                </div>

                {/* Travel & Return Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">ভ্রমণের তারিখ *</label>
                    <input
                      type="date"
                      value={editingTicket.travelDate}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, travelDate: e.target.value } : null)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">ফেরত আসার তারিখ</label>
                    <input
                      type="date"
                      value={editingTicket.returnDate || ""}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, returnDate: e.target.value } : null)}
                      disabled={editingTicket.ticketType === "One Way"}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Buy & Sell Cost */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">ক্রয় মূল্য (BDT) *</label>
                    <input
                      type="number"
                      value={editingTicket.purchaseCost}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, purchaseCost: parseFloat(e.target.value) || 0 } : null)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">বিক্রয় মূল্য (BDT) *</label>
                    <input
                      type="number"
                      value={editingTicket.sellingPrice}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, sellingPrice: parseFloat(e.target.value) || 0 } : null)}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 font-mono"
                    />
                  </div>
                </div>

                {/* Status & Method */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">পেমেন্ট স্ট্যাটাস</label>
                    <select
                      value={editingTicket.paymentStatus}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, paymentStatus: e.target.value as "Paid" | "Partial" | "Due" } : null)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 focus:outline-none font-medium"
                    >
                      <option value="Paid">Paid</option>
                      <option value="Partial">Partial</option>
                      <option value="Due">Due</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">পেমেন্ট মাধ্যম</label>
                    <select
                      value={editingTicket.paymentMethod}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, paymentMethod: e.target.value as "Cash" | "Bank" | "bKash" | "Nagad" | "Card" } : null)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 focus:outline-none font-medium"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank</option>
                      <option value="bKash">bKash</option>
                      <option value="Nagad">Nagad</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                </div>

                <MobilePaymentHelper
                  paymentMethod={editingTicket.paymentMethod}
                  amount={editingTicket.sellingPrice ? String(editingTicket.sellingPrice) : ""}
                  reference={editingTicket.pnrNumber || editingTicket.customerName || ""}
                  onApplyVerification={(details) => {
                    setEditingTicket(prev => prev ? {
                      ...prev,
                      paymentStatus: details.paymentStatus,
                      amountPaid: details.amountPaid ? Number(details.amountPaid) : (prev.amountPaid || 0),
                      notes: prev.notes ? `${prev.notes}\n${details.notesAddition}` : details.notesAddition
                    } : null);
                    triggerToast("পেমেন্ট তথ্য ভেরিফাই করে সফলভাবে এডিটর ফর্মে ইনপুট করা হয়েছে! 🎉", "success");
                  }}
                />

                {/* Staff Name & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">দায়িত্বপ্রাপ্ত স্টাফ</label>
                    <input
                      type="text"
                      value={editingTicket.staffName}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, staffName: e.target.value } : null)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 uppercase font-extrabold block">রেকর্ড ডেট</label>
                    <input
                      type="date"
                      value={editingTicket.date}
                      onChange={(e) => setEditingTicket(prev => prev ? { ...prev, date: e.target.value } : null)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 uppercase font-extrabold block">অতিরিক্ত নোট</label>
                  <textarea
                    value={editingTicket.notes || ""}
                    onChange={(e) => setEditingTicket(prev => prev ? { ...prev, notes: e.target.value } : null)}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3.5 pt-4 border-t border-white/10 mt-6">
                  <button
                    type="button"
                    onClick={() => setEditingTicket(null)}
                    className="bg-white/5 hover:bg-white/10 text-slate-200 font-bold px-5 py-2.5 rounded-xl transition-all"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold px-6 py-2.5 rounded-xl shadow-lg transition-all"
                  >
                    সংশোধন সংরক্ষণ করুন
                  </button>
                </div>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer bar */}
      <footer className="mt-16 border-t border-white/10 pt-6 text-center max-w-7xl mx-auto px-4 text-xs text-slate-500 space-y-2">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
            <span className="text-indigo-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              Status: Connected
            </span>
            <span>Local Storage Active</span>
            <span>Export Capability: Active</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500/85">
            © JT Tours & Travels 2026 • Premium Accounting Engine • Built with Precision
          </div>
        </div>
      </footer>

    </div>
  );
}

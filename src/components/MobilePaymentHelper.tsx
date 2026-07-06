import React, { useState, useEffect, useRef } from "react";
import { QrCode, Scan, Upload, Camera, Check, Download, RefreshCw, AlertCircle, X, CheckCircle } from "lucide-react";

interface MobilePaymentHelperProps {
  paymentMethod: "bKash" | "Nagad" | "Cash" | "Bank" | "Card";
  amount: string;
  reference: string;
  onApplyVerification: (details: {
    paymentStatus: "Paid" | "Partial";
    notesAddition: string;
    amountPaid?: string;
  }) => void;
}

export function MobilePaymentHelper({
  paymentMethod,
  amount,
  reference,
  onApplyVerification,
}: MobilePaymentHelperProps) {
  // Guard clause for mobile payments only
  if (paymentMethod !== "bKash" && paymentMethod !== "Nagad") {
    return null;
  }

  const isBkash = paymentMethod === "bKash";
  const brandColor = isBkash ? "from-pink-600 to-pink-700" : "from-orange-500 to-orange-600";
  const bgBadge = isBkash ? "bg-pink-500/10 text-pink-400 border-pink-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20";
  const focusRing = isBkash ? "focus:ring-pink-500/30 focus:border-pink-500/50" : "focus:ring-orange-500/30 focus:border-orange-500/50";
  const brandText = isBkash ? "বিকাশ (bKash)" : "নগদ (Nagad)";

  // Local Storage default numbers
  const [receiverNumber, setReceiverNumber] = useState("");
  const [accountType, setAccountType] = useState<"Personal" | "Merchant">("Personal");
  const [qrAmount, setQrAmount] = useState(amount || "");
  const [qrRef, setQrRef] = useState(reference || "");
  const [activeTab, setActiveTab] = useState<"generate" | "scan">("generate");

  // QR card generation state
  const [isGenerated, setIsGenerated] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");

  // Scanner States
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any | null>(null);

  // Camera States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync amount & ref when they change in the parent
  useEffect(() => {
    if (amount) setQrAmount(amount);
  }, [amount]);

  useEffect(() => {
    if (reference) setQrRef(reference);
  }, [reference]);

  // Load default numbers from Local Storage
  useEffect(() => {
    const savedBkash = localStorage.getItem("jt_tours_bkash_number") || "01788223344";
    const savedNagad = localStorage.getItem("jt_tours_nagad_number") || "01977112233";
    setReceiverNumber(isBkash ? savedBkash : savedNagad);
    setIsGenerated(false); // Reset generated card on payment method switch
  }, [paymentMethod, isBkash]);

  const saveNumber = (num: string) => {
    setReceiverNumber(num);
    localStorage.setItem(isBkash ? "jt_tours_bkash_number" : "jt_tours_nagad_number", num);
  };

  const handleGenerateQR = () => {
    if (!receiverNumber) {
      alert("অনুগ্রহ করে সচল মোবাইল নম্বর দিন");
      return;
    }
    // Deep link string or standardized transaction format for mobile banking apps
    // For bKash/Nagad scan-to-pay, standard QR string matches custom structures.
    // We generate a beautiful QR holding details
    const qrPayload = `${isBkash ? "bkash" : "nagad"}://payment?number=${receiverNumber}&amount=${qrAmount}&ref=${qrRef}&type=${accountType}`;
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=10&data=${encodeURIComponent(qrPayload)}`;
    setGeneratedUrl(url);
    setIsGenerated(true);
  };

  // Process Receipt Multimodal Extraction
  const processReceiptImage = async (base64Data: string, mimeType: string, fileName: string) => {
    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const response = await fetch("/api/gemini/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType,
          fileName,
        }),
      });

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        setScanResult(resJson.data);
      } else {
        throw new Error(resJson.error || "রিসিট স্ক্যান করতে ব্যর্থ হয়েছে।");
      }
    } catch (err: any) {
      console.error(err);
      setScanError(err.message || "সার্ভার এর সাথে সংযোগ বিচ্ছিন্ন হয়েছে। অনুগ্রহ করে ম্যানুয়ালি তথ্য ইনপুট করুন।");
    } finally {
      setIsScanning(false);
    }
  };

  // File Upload Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setScanPreview(result);
      processReceiptImage(result, file.type, file.name);
    };
    reader.readAsDataURL(file);
  };

  // Start Camera Stream
  const startCamera = async () => {
    setScanError(null);
    setScanResult(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setScanError("ক্যামেরা চালু করতে ব্যর্থ হয়েছে। অনুগ্রহ করে ব্রাউজার ক্যামেরা পারমিশন চেক করুন।");
      setIsCameraActive(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Capture Photo from Camera & Send to Gemini
  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setScanPreview(dataUrl);
      stopCamera();
      processReceiptImage(dataUrl, "image/jpeg", "camera-capture.jpg");
    }
  };

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Apply parsed results to Form State
  const handleApplyResult = () => {
    if (!scanResult) return;

    const txn = scanResult.transactionId || "";
    const amt = scanResult.amount || qrAmount || "0";
    const sender = scanResult.senderNumber ? ` Sender: ${scanResult.senderNumber}` : "";
    const method = scanResult.paymentMethod || paymentMethod;

    const notesAddition = `[Verified ${method} Paid] TxnID: ${txn}, Amount: ৳${amt}${sender}`;

    onApplyVerification({
      paymentStatus: "Paid",
      notesAddition,
      amountPaid: String(amt),
    });

    // Reset scanner
    setScanFile(null);
    setScanPreview(null);
    setScanResult(null);
  };

  return (
    <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 mt-3 space-y-4">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${brandColor} animate-pulse`} />
          <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5">
            {brandText} এসিস্ট্যান্ট ও কিউআর গেটওয়ে
          </h3>
        </div>
        <div className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-full border ${bgBadge}`}>
          Active Gateway
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 bg-slate-950/50 p-1 rounded-xl border border-white/5">
        <button
          type="button"
          onClick={() => {
            setActiveTab("generate");
            stopCamera();
          }}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === "generate"
              ? `bg-gradient-to-r ${brandColor} text-white shadow-lg`
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>কিউআর তৈরি (Generate)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("scan")}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === "scan"
              ? `bg-gradient-to-r ${brandColor} text-white shadow-lg`
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Scan className="w-3.5 h-3.5" />
          <span>রিসিট স্ক্যান ও যাচাই</span>
        </button>
      </div>

      {/* Tab CONTENT: Generate QR */}
      {activeTab === "generate" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">গ্রাহক নম্বর (Receiver Number)</label>
              <input
                type="text"
                value={receiverNumber}
                onChange={(e) => saveNumber(e.target.value)}
                placeholder="নম্বরটি টাইপ করুন"
                className={`w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 ${focusRing} transition-all`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">অ্যাকাউন্ট টাইপ</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAccountType("Personal")}
                  className={`py-2 text-[10px] sm:text-xs font-extrabold rounded-lg transition-all border ${
                    accountType === "Personal"
                      ? `bg-white/10 text-white border-white/20`
                      : "bg-slate-950 border-white/5 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Personal (ব্যক্তিগত)
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType("Merchant")}
                  className={`py-2 text-[10px] sm:text-xs font-extrabold rounded-lg transition-all border ${
                    accountType === "Merchant"
                      ? `bg-white/10 text-white border-white/20`
                      : "bg-slate-950 border-white/5 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Merchant (মার্চেন্ট)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">পেমেন্ট টাকার পরিমাণ (৳)</label>
              <input
                type="number"
                value={qrAmount}
                onChange={(e) => setQrAmount(e.target.value)}
                placeholder="৳ পরিমাণ"
                className={`w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 ${focusRing} transition-all`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider block">রেফারেন্স আইডি (Ref)</label>
              <input
                type="text"
                value={qrRef}
                onChange={(e) => setQrRef(e.target.value)}
                placeholder="রেফারেন্স বা পিএনআর"
                className={`w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 ${focusRing} transition-all`}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateQR}
            className={`w-full bg-gradient-to-r ${brandColor} hover:brightness-110 text-white font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md`}
          >
            <QrCode className="w-4 h-4" />
            <span>কিউআর কোড তৈরি করুন</span>
          </button>

          {/* Generated QR Slip Design */}
          {isGenerated && generatedUrl && (
            <div className="bg-slate-950 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
              <div className={`w-full max-w-[280px] bg-white text-slate-900 rounded-3xl overflow-hidden shadow-2xl border-4 ${isBkash ? "border-pink-600" : "border-orange-500"}`}>
                {/* Brand Header */}
                <div className={`p-4 text-white font-black text-base uppercase tracking-widest flex items-center justify-center gap-2 bg-gradient-to-r ${brandColor}`}>
                  <span>{isBkash ? "bKash" : "Nagad"} Pay</span>
                </div>

                {/* QR Section */}
                <div className="p-5 flex flex-col items-center justify-center bg-white">
                  <div className="relative p-1 bg-white border-2 border-dashed border-slate-300 rounded-xl mb-3">
                    <img
                      src={generatedUrl}
                      alt={`${paymentMethod} QR code`}
                      referrerPolicy="no-referrer"
                      className="w-44 h-44 object-contain rounded-lg"
                    />
                  </div>
                  <div className="text-[11px] font-black text-slate-500 uppercase tracking-wide">
                    {accountType} Pay • ৳{parseFloat(qrAmount || "0").toLocaleString("bn-BD")} BDT
                  </div>
                </div>

                {/* Info block */}
                <div className="bg-slate-50 border-t border-slate-100 p-4 text-left space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-500">গ্রাহক নম্বর:</span>
                    <span className="text-slate-900 font-extrabold">{receiverNumber}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-500">টাকার পরিমাণ:</span>
                    <span className="text-slate-900 font-extrabold">৳{qrAmount || "0"} BDT</span>
                  </div>
                  {qrRef && (
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-500">রেফারেন্স:</span>
                      <span className="text-slate-900 font-extrabold">{qrRef}</span>
                    </div>
                  )}
                </div>

                {/* Instruction Footer */}
                <div className={`py-2 text-[10px] text-center font-extrabold text-white bg-gradient-to-r ${brandColor}`}>
                  {isBkash ? "বিকাশ অ্যাপ দিয়ে কিউআর স্ক্যান করুন" : "নগদ অ্যাপ দিয়ে কিউআর স্ক্যান করুন"}
                </div>
              </div>

              {/* Download / Print Actions */}
              <div className="flex gap-2 w-full max-w-[280px]">
                <a
                  href={generatedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ওপেন কিউআর</span>
                </a>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={`flex-1 bg-gradient-to-r ${brandColor} text-white font-extrabold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 hover:brightness-110 transition-all`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>প্রিন্ট করুন</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab CONTENT: Scan Receipt */}
      {activeTab === "scan" && (
        <div className="space-y-4">
          <p className="text-[10px] text-slate-400">
            গ্রাহকের পাঠানো bKash বা Nagad পেমেন্ট কনফার্মেশন স্ক্রিনশট বা রিসিট আপলোড করুন। এআই স্বয়ংক্রিয়ভাবে ট্রানজেকশন আইডি এবং টাকা ভেরিফাই করে নিবে।
          </p>

          <div className="w-full">
            {/* File Upload Selector */}
            <label className="flex flex-col items-center justify-center bg-slate-950 hover:bg-slate-950/80 border border-dashed border-white/10 hover:border-white/20 rounded-xl p-5 cursor-pointer transition-all text-center group w-full">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="w-5 h-5 text-slate-400 group-hover:text-slate-200 mb-1" />
              <span className="text-[10px] font-extrabold text-slate-300">ফাইল আপলোড করুন</span>
              <span className="text-[8px] text-slate-500">Image (PNG/JPG)</span>
            </label>
          </div>

          {/* Preview / Progress / Error / Result section */}
          {scanPreview && (
            <div className="bg-slate-950 border border-white/5 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400">আপলোডকৃত রিসিট ইমেজ:</span>
                <button
                  type="button"
                  onClick={() => {
                    setScanPreview(null);
                    setScanFile(null);
                    setScanResult(null);
                    setScanError(null);
                  }}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex gap-3">
                <img
                  src={scanPreview}
                  alt="Receipt Preview"
                  className="w-14 h-14 object-cover rounded-lg border border-white/10"
                />
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <p className="text-[10px] text-slate-300 font-bold truncate">
                    {scanFile ? scanFile.name : "ক্যামেরা থেকে সংগৃহীত"}
                  </p>
                  <p className="text-[9px] text-slate-500">
                    {scanFile ? `${(scanFile.size / 1024).toFixed(1)} KB` : "Image Stream"}
                  </p>
                </div>
              </div>

              {/* Scanning Loader Progress Bar */}
              {isScanning && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-blue-400 font-extrabold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Gemini Multimodal AI যাচাই করছে...
                    </span>
                    <span className="text-slate-500">মডেল রেসপন্স</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-[shimmer_1.5s_infinite] w-[80%]" />
                  </div>
                </div>
              )}

              {/* Scan Error Alert */}
              {scanError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg p-2.5 text-[10px] flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">ভুল সনাক্তকরণ:</span> {scanError}
                  </div>
                </div>
              )}

              {/* Scan Success Results Section */}
              {scanResult && (
                <div className="bg-slate-900 border border-white/10 rounded-xl p-3 space-y-2.5 text-xs">
                  <div className="flex items-center gap-1 text-emerald-400 font-extrabold text-[11px]">
                    <CheckCircle className="w-4 h-4" />
                    <span>এআই ভেরিফিকেশন সফল! (AI Statement Checked)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-white/5 pt-2">
                    <div>
                      <span className="text-slate-500 block">পেমেন্ট মেথড:</span>
                      <span className="text-slate-200 font-bold">{scanResult.paymentMethod}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ট্রানজেকশন আইডি:</span>
                      <span className="text-slate-200 font-bold font-mono text-[11px] select-all">
                        {scanResult.transactionId || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">পরিমাণ (Amount):</span>
                      <span className="text-emerald-400 font-extrabold">
                        ৳{parseFloat(scanResult.amount || "0").toLocaleString("bn-BD")} BDT
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">প্রেরক (Sender):</span>
                      <span className="text-slate-200 font-bold">{scanResult.senderNumber || "N/A"}</span>
                    </div>
                  </div>

                  {scanResult.notes && (
                    <div className="bg-slate-950 p-2 rounded-lg text-[9px] text-slate-400 leading-relaxed">
                      <span className="text-slate-500 font-bold block mb-0.5">এআই রিমার্কস:</span>
                      {scanResult.notes}
                    </div>
                  )}

                  {/* Apply Action Button */}
                  <button
                    type="button"
                    onClick={handleApplyResult}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md mt-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>পেমেন্ট তথ্য ফর্ম-এ যুক্ত করুন (Apply to Form)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

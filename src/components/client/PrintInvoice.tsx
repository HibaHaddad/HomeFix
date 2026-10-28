"use client";
import { Printer } from "lucide-react";
export default function PrintInvoice() { return <button className="cx-btn cx-no-print" onClick={() => window.print()}><Printer size={16}/> Imprimer / PDF</button>; }

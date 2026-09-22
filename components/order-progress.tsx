"use client";

import React from "react";
import { ArrowRight, Check, CheckCircle2, ClipboardCheck, PackageCheck, Send, Truck, XCircle } from "lucide-react";

export type FulfillmentStage = "draft" | "submitted" | "received" | "approved" | "rejected" | "separating" | "shipped" | "delivered" | "cancelled";

export const FULFILLMENT_STAGES = [
  { key:"submitted", label:"Enviado ao CD", labelEn:"Solicitado", icon:Send, badgeBg:"bg-amber-50", badgeText:"text-amber-700", badgeBorder:"border-amber-200", description:"A filial enviou a solicitação ao Centro de Distribuição." },
  { key:"received", label:"Recebido no CD", labelEn:"Em análise", icon:ClipboardCheck, badgeBg:"bg-sky-50", badgeText:"text-sky-700", badgeBorder:"border-sky-200", description:"O Centro de Distribuição recebeu o pedido." },
  { key:"approved", label:"Aprovado", labelEn:"Aceito", icon:CheckCircle2, badgeBg:"bg-emerald-50", badgeText:"text-emerald-700", badgeBorder:"border-emerald-200", description:"O Centro de Distribuição aprovou o atendimento." },
  { key:"separating", label:"Em separação", labelEn:"Preparando", icon:PackageCheck, badgeBg:"bg-blue-50", badgeText:"text-blue-700", badgeBorder:"border-blue-200", description:"Os itens estão sendo separados no CD." },
  { key:"shipped", label:"Despachado", labelEn:"Em trânsito", icon:Truck, badgeBg:"bg-purple-50", badgeText:"text-purple-700", badgeBorder:"border-purple-200", description:"O Centro de Distribuição enviou a carga para a filial." },
  { key:"delivered", label:"Recebido pela filial", labelEn:"Concluído", icon:CheckCircle2, badgeBg:"bg-emerald-50", badgeText:"text-emerald-700", badgeBorder:"border-emerald-200", description:"A filial confirmou o recebimento." },
] as const;

export function normalizeFulfillmentStage(stage?: string | null, status?: string): FulfillmentStage {
  const value = String(stage || "").toLowerCase().trim();
  if (["draft","submitted","received","approved","rejected","separating","shipped","delivered","cancelled"].includes(value)) return value as FulfillmentStage;
  if (value === "pending" || value === "pendente") return "submitted";
  if (value === "processing" || value === "em separação") return "separating";
  if (value === "enviado") return "shipped";
  if (value === "entregue") return "delivered";
  return status === "Finalizado" ? "submitted" : "draft";
}

const special = {
  draft: { label:"Rascunho", icon:ClipboardCheck, classes:"bg-slate-50 text-slate-700 border-slate-200" },
  rejected: { label:"Rejeitado", icon:XCircle, classes:"bg-red-50 text-red-700 border-red-200" },
  cancelled: { label:"Cancelado", icon:XCircle, classes:"bg-slate-50 text-slate-600 border-slate-200" },
};

export function getStageIndex(stage: FulfillmentStage) { return FULFILLMENT_STAGES.findIndex((item) => item.key === stage); }

export function OrderProgressStepper({ stage, onSelectStage, interactive = true }: { stage: FulfillmentStage; onSelectStage?: (stage: FulfillmentStage) => void; interactive?: boolean }) {
  const currentIndex = getStageIndex(stage);
  if (currentIndex < 0) {
    const config = special[stage as keyof typeof special] || special.draft;
    const Icon = config.icon;
    return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${config.classes}`}><Icon size={13}/>{config.label}</span>;
  }
  const current = FULFILLMENT_STAGES[currentIndex];
  return <div className="flex min-w-[250px] max-w-[380px] flex-col gap-2 py-1">
    <div className="flex items-center justify-between gap-2"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${current.badgeBg} ${current.badgeText} ${current.badgeBorder}`}><current.icon size={12}/>{current.label}</span><span className="text-[11px] text-[#7a6c6e]">Etapa {currentIndex + 1} de {FULFILLMENT_STAGES.length}</span></div>
    <div className="flex items-center gap-1">{FULFILLMENT_STAGES.map((item,index)=><React.Fragment key={item.key}><button type="button" disabled={!interactive} title={item.description} onClick={()=>interactive && onSelectStage?.(item.key)} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${index < currentIndex ? "bg-emerald-600 text-white" : index === currentIndex ? "bg-[#790a0e] text-white ring-4 ring-[#790a0e]/15" : "bg-[#f2ecec] text-[#9c8e90]"}`}>{index < currentIndex ? <Check size={13}/> : <item.icon size={13}/>}</button>{index < FULFILLMENT_STAGES.length-1 && <div className={`h-1 flex-1 rounded ${index < currentIndex ? "bg-emerald-500" : "bg-[#ede5e6]"}`}/>}</React.Fragment>)}</div>
  </div>;
}

export function OrderDetailProgress({ stage, onSelectStage, reviewMessage }: { stage: FulfillmentStage; onSelectStage: (stage: FulfillmentStage) => void; reviewMessage?: string }) {
  const currentIndex = getStageIndex(stage);
  const next = currentIndex >= 0 ? FULFILLMENT_STAGES[currentIndex + 1] : null;
  return <div className="flex flex-col gap-4 rounded-xl border border-[#ede5e6] bg-[#faf6f6] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7a6c6e]">Fluxo filial → Centro de Distribuição</span><h3 className="text-sm font-bold">Atendimento do pedido</h3></div>{next && <button type="button" onClick={()=>onSelectStage(next.key)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#790a0e] px-3 py-1.5 text-xs font-semibold text-white">Avançar para {next.label}<ArrowRight size={13}/></button>}</div>
    {(stage === "rejected" || stage === "cancelled") && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>{stage === "rejected" ? "Pedido rejeitado" : "Pedido cancelado"}</strong>{reviewMessage && <p className="mt-1">Motivo: {reviewMessage}</p>}</div>}
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{FULFILLMENT_STAGES.map((item,index)=><button key={item.key} type="button" onClick={()=>onSelectStage(item.key)} className={`rounded-lg border p-3 text-left ${index === currentIndex ? "border-[#790a0e] bg-white" : "border-[#e8dfe0]"}`}><item.icon size={16}/><strong className="mt-2 block text-xs">{item.label}</strong><span className="text-[10px] text-[#7a6c6e]">{item.description}</span></button>)}</div>
  </div>;
}

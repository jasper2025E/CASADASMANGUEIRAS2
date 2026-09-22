"use client";

import React from "react";
import {
  Clock,
  PackageCheck,
  Truck,
  CheckCircle2,
  Check,
  ArrowRight,
} from "lucide-react";

export type FulfillmentStage = "pending" | "processing" | "shipped" | "delivered";

export interface StageConfig {
  key: FulfillmentStage;
  label: string;
  labelEn: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
}

export const FULFILLMENT_STAGES: StageConfig[] = [
  {
    key: "pending",
    label: "Pendente",
    labelEn: "Pending",
    icon: Clock,
    color: "#ea580c",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    badgeBorder: "border-amber-200",
    description: "Pedido registrado, aguardando confirmação do fornecedor.",
  },
  {
    key: "processing",
    label: "Em separação",
    labelEn: "Processing",
    icon: PackageCheck,
    color: "#2563eb",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-200",
    description: "Itens sendo separados e preparados para faturamento.",
  },
  {
    key: "shipped",
    label: "Enviado",
    labelEn: "Shipped",
    icon: Truck,
    color: "#7c3aed",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    badgeBorder: "border-purple-200",
    description: "Carga despachada em transporte para a empresa.",
  },
  {
    key: "delivered",
    label: "Entregue",
    labelEn: "Delivered",
    icon: CheckCircle2,
    color: "#16a34a",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-200",
    description: "Mercadoria recebida, conferida e integrada ao estoque.",
  },
];

export function normalizeFulfillmentStage(stage?: string | null, status?: string): FulfillmentStage {
  if (stage) {
    const s = stage.toLowerCase().trim();
    if (s === "pending" || s === "pendente") return "pending";
    if (s === "processing" || s === "em separação" || s === "em processamento") return "processing";
    if (s === "shipped" || s === "enviado") return "shipped";
    if (s === "delivered" || s === "entregue") return "delivered";
  }
  return status === "Finalizado" ? "processing" : "pending";
}

export function getStageIndex(stage: FulfillmentStage): number {
  return FULFILLMENT_STAGES.findIndex((s) => s.key === stage);
}

interface OrderProgressStepperProps {
  stage: FulfillmentStage;
  onSelectStage?: (newStage: FulfillmentStage) => void;
  interactive?: boolean;
}

/**
 * Compact progress stepper shown inside the History view rows
 */
export function OrderProgressStepper({
  stage,
  onSelectStage,
  interactive = true,
}: OrderProgressStepperProps) {
  const currentIndex = getStageIndex(stage);
  const currentConfig = FULFILLMENT_STAGES[currentIndex] || FULFILLMENT_STAGES[0];

  return (
    <div className="flex flex-col gap-1.5 min-w-[220px] max-w-[340px] py-1">
      {/* Stage Badge & Label */}
      <div className="flex items-center justify-between gap-1.5">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${currentConfig.badgeBg} ${currentConfig.badgeText} ${currentConfig.badgeBorder}`}
        >
          <currentConfig.icon size={12} className="shrink-0" />
          <span>{currentConfig.label}</span>
          <span className="opacity-60 text-[10px]">({currentConfig.labelEn})</span>
        </span>
        <span className="text-[11px] text-[#7a6c6e] font-medium">
          Etapa {currentIndex + 1} de 4
        </span>
      </div>

      {/* Connected 4-Step Progress Bar */}
      <div className="flex items-center gap-1 w-full pt-1">
        {FULFILLMENT_STAGES.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const Icon = step.icon;

          return (
            <React.Fragment key={step.key}>
              {/* Step indicator button / node */}
              <button
                type="button"
                disabled={!interactive}
                onClick={() => interactive && onSelectStage?.(step.key)}
                title={`${step.label} (${step.labelEn}): ${step.description}${interactive ? " - Clique para alterar para esta etapa" : ""}`}
                className={`relative flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all shrink-0 ${
                  isCompleted
                    ? "bg-emerald-600 text-white shadow-sm hover:scale-110"
                    : isCurrent
                    ? "bg-[#790a0e] text-white ring-4 ring-[#790a0e]/15 shadow-sm scale-105"
                    : "bg-[#f2ecec] text-[#9c8e90] hover:bg-[#e8dfdf] hover:text-[#554648]"
                } ${interactive ? "cursor-pointer" : "cursor-default"}`}
              >
                {isCompleted ? (
                  <Check size={13} strokeWidth={3} />
                ) : (
                  <Icon size={13} />
                )}
              </button>

              {/* Progress track connecting line between steps */}
              {idx < FULFILLMENT_STAGES.length - 1 && (
                <div
                  className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                    idx < currentIndex ? "bg-emerald-500" : "bg-[#ede5e6]"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

interface OrderDetailProgressProps {
  stage: FulfillmentStage;
  onSelectStage: (newStage: FulfillmentStage) => void;
}

/**
 * Expanded fulfillment stage timeline displayed in the Order Detail modal
 */
export function OrderDetailProgress({
  stage,
  onSelectStage,
}: OrderDetailProgressProps) {
  const currentIndex = getStageIndex(stage);
  const nextStage =
    currentIndex < FULFILLMENT_STAGES.length - 1
      ? FULFILLMENT_STAGES[currentIndex + 1]
      : null;

  return (
    <div className="bg-[#faf6f6] border border-[#ede5e6] rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-[10px] font-extrabold tracking-wider uppercase text-[#7a6c6e]">
            Acompanhamento de Atendimento
          </span>
          <h3 className="text-sm font-bold text-[#211718]">
            Etapas do Atendimento do Pedido
          </h3>
        </div>

        {nextStage && (
          <button
            type="button"
            onClick={() => onSelectStage(nextStage.key)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#790a0e] hover:bg-[#60070a] text-white text-xs font-semibold shadow-sm transition"
          >
            <span>Avançar para: {nextStage.label} ({nextStage.labelEn})</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      {/* 4 Cards Grid representing stages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
        {FULFILLMENT_STAGES.map((s, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const Icon = s.icon;

          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelectStage(s.key)}
              className={`text-left p-3 rounded-lg border transition-all flex flex-col gap-2 relative ${
                isCurrent
                  ? "bg-white border-[#790a0e] ring-2 ring-[#790a0e]/15 shadow-sm"
                  : isCompleted
                  ? "bg-white/80 border-emerald-200 hover:border-emerald-300"
                  : "bg-white/40 border-[#ede5e6] opacity-75 hover:opacity-100 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCompleted
                      ? "bg-emerald-100 text-emerald-700"
                      : isCurrent
                      ? "bg-[#790a0e] text-white"
                      : "bg-[#f2ecec] text-[#7a6c6e]"
                  }`}
                >
                  {isCompleted ? <Check size={14} strokeWidth={2.5} /> : <Icon size={14} />}
                </div>

                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    isCurrent
                      ? "bg-[#f6e8ea] text-[#790a0e]"
                      : isCompleted
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isCurrent ? "Atual" : isCompleted ? "Concluído" : `Etapa ${idx + 1}`}
                </span>
              </div>

              <div>
                <strong className="block text-xs font-bold text-[#211718]">
                  {s.label}{" "}
                  <span className="text-[10px] font-normal text-[#7a6c6e]">
                    ({s.labelEn})
                  </span>
                </strong>
                <p className="text-[11px] text-[#7a6c6e] mt-0.5 leading-snug">
                  {s.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

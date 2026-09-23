"use client";

import React from "react";
import { Order, FulfillmentStage, FULFILLMENT_STAGES, normalizeFulfillmentStage } from "@/components/order-progress";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, PackageCheck, Truck, CheckCircle2, XCircle } from "lucide-react";

interface KanbanBoardProps {
  orders: Order[];
  onUpdateStage: (orderId: string, stage: FulfillmentStage, message?: string) => void;
}

const COLUMNS = [
  { key: "submitted", label: "Novos Pedidos", icon: ClipboardCheck },
  { key: "received", label: "Recebidos (CD)", icon: ClipboardCheck },
  { key: "approved", label: "Aprovados", icon: CheckCircle2 },
  { key: "separating", label: "Em Separação", icon: PackageCheck },
  { key: "shipped", label: "Em Trânsito", icon: Truck },
];

export function KanbanBoard({ orders, onUpdateStage }: KanbanBoardProps) {
  return (
    <div className="grid grid-cols-5 gap-3 p-4 bg-slate-50 min-h-[600px] rounded-lg">
      {COLUMNS.map((col) => (
        <div key={col.key} className="flex flex-col gap-3">
          <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2"><col.icon size={16}/>{col.label}</h3>
          {orders
            .filter((o) => normalizeFulfillmentStage(o.fulfillmentStage, o.status) === col.key)
            .map((order) => (
              <div key={order.id} className="p-3 bg-white rounded shadow-sm border border-slate-200">
                <strong className="text-sm block">{order.id}</strong>
                <span className="text-xs text-slate-500">{order.originOrganizationName}</span>
                <div className="mt-3 flex gap-1">
                  {col.key === "submitted" && <Button size="sm" onClick={() => onUpdateStage(order.id, "received")}>Receber</Button>}
                  {col.key === "received" && <><Button size="sm" onClick={() => onUpdateStage(order.id, "approved")}>Aprovar</Button><Button size="sm" variant="destructive" onClick={() => onUpdateStage(order.id, "rejected", "Motivo...")}>Rejeitar</Button></>}
                  {col.key === "approved" && <Button size="sm" onClick={() => onUpdateStage(order.id, "separating")}>Separar</Button>}
                  {col.key === "separating" && <Button size="sm" onClick={() => onUpdateStage(order.id, "shipped")}>Despachar</Button>}
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

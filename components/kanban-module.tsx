"use client";

import React from "react";
import { type Order, type FulfillmentStage } from "@/app/page";
import { normalizeFulfillmentStage } from "@/components/order-progress";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, PackageCheck, Truck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface KanbanModuleProps {
  orders: Order[];
  onRefresh: () => void;
}

const COLUMNS = [
  { key: "submitted", label: "Pendentes", icon: ClipboardCheck },
  { key: "received", label: "Recebidos (CD)", icon: ClipboardCheck },
  { key: "separating", label: "Em Separação", icon: PackageCheck },
  { key: "shipped", label: "Em Trânsito", icon: Truck },
  { key: "delivered", label: "Finalizado", icon: CheckCircle2 },
];

export function KanbanModule({ orders, onRefresh }: KanbanModuleProps) {

  const transitionOrder = async (orderId: string, status: FulfillmentStage, message?: string) => {
    // A automação de estoque ocorre via trigger no banco após a chamada desta RPC
    const { error } = await supabase.rpc("transition_distribution_order", {
      p_order_id: orderId,
      p_status: status,
      p_message: message || ""
    });

    if (error) {
      toast.error(`Erro ao atualizar pedido: ${error.message}`);
    } else {
      toast.success("Pedido atualizado com sucesso!");
      onRefresh();
    }
  };

  return (
    <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
      {COLUMNS.map((col) => (
        <div key={col.key} className="flex flex-col gap-3">
          <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2 mb-2">
            <col.icon size={18} />
            {col.label}
          </h3>
          {orders
            .filter((o) => normalizeFulfillmentStage(o.fulfillmentStage, o.status) === col.key)
            .map((order) => (
              <div key={order.dbId || order.id} className="p-4 bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <strong className="text-sm">{order.id}</strong>
                  <span className="text-[10px] text-slate-400 uppercase">{order.originOrganizationName}</span>
                </div>
                <div className="text-xs text-slate-600 mb-4">
                  {order.items.length} itens · {order.supplier}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {col.key === "submitted" && (
                    <Button size="sm" onClick={() => transitionOrder(order.dbId!, "received")}>Receber</Button>
                  )}
                  {col.key === "received" && (
                    <div className="flex flex-col gap-1">
                      <Button size="sm" onClick={() => transitionOrder(order.dbId!, "approved")}>Aprovar</Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        const reason = prompt("Informe o motivo da divergência:");
                        if (reason) transitionOrder(order.dbId!, "rejected", `Divergência: ${reason}`);
                      }}>Divergência</Button>
                    </div>
                  )}
                  {col.key === "separating" && <Button size="sm" onClick={() => transitionOrder(order.dbId!, "shipped")}>Despachar</Button>}
                  {col.key === "shipped" && <Button size="sm" variant="outline" onClick={() => transitionOrder(order.dbId!, "delivered")}>Finalizar</Button>}
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

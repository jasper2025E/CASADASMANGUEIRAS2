"use client";

import { useState } from "react";
import { type Order } from "@/app/page";
import { normalizeFulfillmentStage } from "@/components/order-progress";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, PackageCheck, Truck, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { UserAccess } from "@/lib/access";
import { toast } from "sonner";

interface KanbanModuleProps { orders:Order[]; access:UserAccess|null; onRefresh:()=>void }
const COLUMNS=[
  {key:"submitted",label:"Pendentes",icon:ClipboardCheck},
  {key:"separating",label:"Em separação",icon:PackageCheck},
  {key:"shipped",label:"Em trânsito",icon:Truck},
  {key:"delivered",label:"Finalizados",icon:CheckCircle2},
  {key:"rejected",label:"Negados",icon:XCircle},
] as const;

export function KanbanModule({orders,access,onRefresh}:KanbanModuleProps){
  const [working,setWorking]=useState<string|null>(null);
  const isCd=access?.role==="ADMIN_CD"||access?.role==="SUPER_ADMIN";
  const canReceive=["RECEBEDOR_CONFERENTE","GERENTE_GERAL","SUBGERENTE","AUXILIAR_GERENTE","SUPER_ADMIN"].includes(access?.role||"");
  async function run(order:Order,action:"APROVAR_TOTAL"|"PARCIAL"|"NEGAR"|"DESPACHAR"|"RECEBER"){
    if(!order.dbId)return;
    setWorking(order.dbId);
    try{
      let error:{message:string}|null=null;
      if(action==="NEGAR"){
        const reason=window.prompt("Motivo da negativa (obrigatório):")?.trim()||"";
        if(reason.length<3)return;
        ({error}=await supabase.rpc("decidir_pedido",{p_id:order.dbId,p_acao:"NEGAR",p_itens:[],p_motivo:reason}));
      }else if(action==="PARCIAL"){
        const items:Array<{id:string;qtd:number}>=[];
        for(const item of order.items){
          if(!item.orderItemId)continue;
          const value=window.prompt(`Quantidade aprovada de ${item.description}:`,String(item.quantity));
          if(value===null)return;
          const qtd=Number(value);
          if(!Number.isFinite(qtd)||qtd<0||qtd>item.quantity)throw new Error(`Quantidade inválida para ${item.description}`);
          items.push({id:item.orderItemId,qtd});
        }
        ({error}=await supabase.rpc("decidir_pedido",{p_id:order.dbId,p_acao:"PARCIAL",p_itens:items,p_motivo:"Aprovação parcial pelo CD"}));
      }else if(action==="APROVAR_TOTAL"){
        ({error}=await supabase.rpc("decidir_pedido",{p_id:order.dbId,p_acao:"APROVAR_TOTAL",p_itens:[],p_motivo:""}));
      }else if(action==="DESPACHAR"){
        const motorista=window.prompt("Nome do motorista:")?.trim()||"";
        const placa=window.prompt("Placa do veículo:")?.trim()||"";
        if(!motorista||!placa)return;
        ({error}=await supabase.rpc("gerar_romaneio",{p_id:order.dbId,p_motorista:motorista,p_placa:placa,p_saida:new Date().toISOString()}));
      }else{
        const obs=window.prompt("Observação ou divergência (opcional):")?.trim()||"";
        ({error}=await supabase.rpc("confirmar_recebimento",{p_id:order.dbId,p_itens:[],p_obs:obs}));
      }
      if(error)throw new Error(error.message);
      toast.success("Pedido atualizado com sucesso.");onRefresh();
    }catch(error){toast.error(error instanceof Error?error.message:"Não foi possível atualizar o pedido.");}
    finally{setWorking(null);}
  }
  return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
    {COLUMNS.map(column=><div key={column.key} className="flex flex-col gap-3 min-w-0">
      <h3 className="font-bold text-xs text-slate-700 flex items-center gap-2"><column.icon size={16}/>{column.label}<span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-[10px]">{orders.filter(order=>normalizeFulfillmentStage(order.fulfillmentStage,order.status)===column.key).length}</span></h3>
      {orders.filter(order=>normalizeFulfillmentStage(order.fulfillmentStage,order.status)===column.key).map(order=><article key={order.dbId||order.id} className="p-3 bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="flex justify-between gap-2"><strong className="text-sm">{order.id}</strong><span className="text-[10px] text-slate-500 text-right">{order.originOrganizationName}</span></div>
        <p className="text-xs text-slate-600 my-2">{order.items.length} itens · {order.items.reduce((sum,item)=>sum+item.quantity,0)} unidades</p>
        {order.reviewMessage&&<p className="text-[11px] rounded bg-amber-50 text-amber-900 p-2 mb-2">{order.reviewMessage}</p>}
        <div className="flex flex-wrap gap-1.5">
          {column.key==="submitted"&&isCd&&<><Button size="sm" disabled={working===order.dbId} onClick={()=>void run(order,"APROVAR_TOTAL")}>Aprovar total</Button><Button size="sm" variant="outline" disabled={working===order.dbId} onClick={()=>void run(order,"PARCIAL")}>Parcial</Button><Button size="sm" variant="destructive" disabled={working===order.dbId} onClick={()=>void run(order,"NEGAR")}>Negar</Button></>}
          {column.key==="separating"&&isCd&&<Button size="sm" disabled={working===order.dbId} onClick={()=>void run(order,"DESPACHAR")}>Emitir romaneio</Button>}
          {column.key==="shipped"&&canReceive&&<Button size="sm" disabled={working===order.dbId} onClick={()=>void run(order,"RECEBER")}>Confirmar recebimento</Button>}
        </div>
      </article>)}
    </div>)}
  </div>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Barcode, Copy, Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export type ProductBarcodeProps = {
  product: { id:string; code?:string; description:string; supplier?:string; unit?:string; stock?:number; price?:number|null; ncm?:string; barcode?:string };
  onUpdateCode?: (code:string) => void;
};

function checksum(code12:string) {
  const digits = code12.replace(/\D/g, "").slice(0,12).padStart(12,"0");
  const sum = [...digits].reduce((total,digit,index)=>total + Number(digit) * (index % 2 ? 3 : 1),0);
  return `${digits}${(10 - (sum % 10)) % 10}`;
}

function generatedEan(productId:string, code?:string) {
  const seed = `${code || ""}${productId}`.replace(/\D/g, "");
  return checksum(`789${(seed + "123456789").slice(0,9)}`);
}

function normalizeEan(value:string, productId:string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 13) return checksum(digits.slice(0,12));
  if (digits.length === 12) return checksum(digits);
  return generatedEan(productId, value);
}

export function ProductBarcode({ product, onUpdateCode }:ProductBarcodeProps) {
  const [value,setValue] = useState(()=>normalizeEan(product.barcode || product.code || "", product.id));
  const svgRef = useRef<SVGSVGElement|null>(null);

  useEffect(()=>{
    if (!svgRef.current) return;
    JsBarcode(svgRef.current,value,{format:"EAN13",lineColor:"#140507",width:2,height:68,displayValue:true,fontSize:15,textMargin:5,margin:8,background:"#fff"});
  },[value]);

  function save(next:string) { const valid = normalizeEan(next,product.id); setValue(valid); onUpdateCode?.(valid); }
  function download() {
    if (!svgRef.current) return;
    const svg = new XMLSerializer().serializeToString(svgRef.current);
    const link = document.createElement("a"); link.download=`ean13-${product.code || product.id}.svg`; link.href=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; link.click();
  }
  function print() {
    if (!svgRef.current) return;
    const popup=window.open("","_blank","width=520,height=520");
    if(!popup) return void toast.error("Permita pop-ups para imprimir a etiqueta.");
    popup.document.write(`<html><head><title>Etiqueta EAN-13</title><style>body{font-family:Arial;display:grid;place-items:center;padding:24px}.label{width:320px;text-align:center;border:1px dashed #777;padding:16px}.title{font-weight:800;margin:8px 0}.price{font-size:20px;font-weight:800;color:#790a0e}</style></head><body><div class="label"><b>CDM · CASA DAS MANGUEIRAS</b><div class="title">${product.description}</div>${svgRef.current.outerHTML}${product.price != null ? `<div class="price">${new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(product.price)}</div>` : ""}</div><script>onload=()=>{print();setTimeout(close,400)}</script></body></html>`);
    popup.document.close();
  }

  return <div className="flex flex-col gap-4 text-left">
    <div className="flex items-center justify-between rounded-xl border border-[#e8dfe0] bg-[#faf7f7] p-3"><div><span className="text-[10px] font-extrabold uppercase tracking-wider text-[#790a0e]">Padrão brasileiro</span><h3 className="font-bold">Código de barras EAN‑13 / GTIN‑13</h3><p className="text-xs text-[#7a6c6e]">Um único formato para etiquetas, leitores e inventário.</p></div><Badge>EAN‑13</Badge></div>
    <label className="text-xs font-bold">13 dígitos<Input inputMode="numeric" maxLength={13} value={value} onChange={(event)=>setValue(event.target.value.replace(/\D/g,"").slice(0,13))} onBlur={()=>save(value)}/></label>
    <div className="flex min-h-32 items-center justify-center overflow-hidden rounded-xl border bg-white p-3"><svg ref={svgRef}/></div>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>save(generatedEan(product.id,product.code))}><RefreshCw size={15}/> Gerar EAN‑13</Button><Button type="button" variant="outline" onClick={()=>{void navigator.clipboard.writeText(value);toast.success("Código copiado.")}}><Copy size={15}/> Copiar</Button><Button type="button" variant="outline" onClick={download}><Download size={15}/> Baixar SVG</Button><Button type="button" onClick={print}><Printer size={15}/> Imprimir etiqueta</Button></div>
    <div className="flex items-start gap-2 rounded-lg bg-[#f6e8ea] p-3 text-xs text-[#5f2023]"><Barcode size={16}/><p>O prefixo <strong>789</strong> identifica códigos GS1 Brasil. Para venda externa, use um GTIN oficialmente atribuído à empresa; o gerador é indicado para controle interno.</p></div>
  </div>;
}

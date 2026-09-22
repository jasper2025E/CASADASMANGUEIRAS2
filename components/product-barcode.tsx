"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import {
  Barcode,
  Check,
  Copy,
  Download,
  Info,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export type ProductBarcodeProps = {
  product: {
    id: string;
    code?: string;
    description: string;
    supplier?: string;
    brand?: string;
    category?: string;
    unit?: string;
    stock?: number;
    price?: number | null;
    ncm?: string;
    barcode?: string;
  };
  onUpdateCode?: (code: string) => void;
};

type BarcodeMode = "QR" | "CODE128" | "EAN13";

// Calculates valid EAN-13 check digit
function calculateEan13Checksum(code12: string): string {
  const digits = code12.replace(/\D/g, "").slice(0, 12).padStart(12, "0");
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  const checkDigit = remainder === 0 ? 0 : 10 - remainder;
  return digits + checkDigit.toString();
}

// Generates a Brazilian EAN-13 (prefix 789) based on product data or random seed
function generateBrazilianEan13(productId: string, code?: string): string {
  const rawNum = `${code || ""}${productId}`.replace(/\D/g, "");
  const padded = (rawNum + "123456789").slice(0, 9);
  return calculateEan13Checksum("789" + padded);
}

export function ProductBarcode({ product, onUpdateCode }: ProductBarcodeProps) {
  const defaultCode = (product.barcode || product.code || product.id).trim();
  const [mode, setMode] = useState<BarcodeMode>("CODE128");
  const [barcodeValue, setBarcodeValue] = useState(defaultCode || "CDM001");
  const [qrFormat, setQrFormat] = useState<"code" | "full">("code");
  const [includePrice, setIncludePrice] = useState(true);
  const [includeStock, setIncludeStock] = useState(false);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  // QR Code payload
  const qrPayload = useMemo(() => {
    return qrFormat === "code"
      ? barcodeValue
      : JSON.stringify({
          empresa: "Casa das Mangueiras",
          codigo: barcodeValue,
          desc: product.description,
          unidade: product.unit || "un",
          fornecedor: product.supplier || "",
        });
  }, [qrFormat, barcodeValue, product.description, product.unit, product.supplier]);

  // Validation messages calculated purely on render
  const validationError = useMemo(() => {
    if (mode === "CODE128") {
      if (!barcodeValue.trim()) return "Informe um código para gerar o código de barras.";
      if (/[^\x00-\x7F]/.test(barcodeValue)) {
        return "O código contém caracteres especiais incompatíveis com CODE128.";
      }
    } else if (mode === "EAN13") {
      const digitsOnly = barcodeValue.replace(/\D/g, "");
      if (!digitsOnly) {
        return "O formato EAN-13 requer dígitos numéricos. Clique em 'Gerar EAN-13' para criar um código válido.";
      }
    }
    return null;
  }, [mode, barcodeValue]);

  // Render Barcode or QR
  useEffect(() => {
    if (mode === "QR") {
      if (canvasRef.current) {
        QRCode.toCanvas(
          canvasRef.current,
          qrPayload,
          {
            width: 200,
            margin: 2,
            color: {
              dark: "#140507",
              light: "#ffffff",
            },
            errorCorrectionLevel: "M",
          },
          () => {}
        );
      }
    } else if (mode === "CODE128") {
      if (svgRef.current) {
        try {
          const valueToRender = barcodeValue.trim() || "000000";
          JsBarcode(svgRef.current, valueToRender, {
            format: "CODE128",
            lineColor: "#140507",
            width: 2,
            height: 65,
            displayValue: true,
            fontSize: 14,
            font: "monospace",
            textMargin: 4,
            margin: 10,
            background: "#ffffff",
          });
        } catch {
          // Handled gracefully
        }
      }
    } else if (mode === "EAN13") {
      if (svgRef.current) {
        try {
          const digitsOnly = barcodeValue.replace(/\D/g, "");
          let ean13ToUse = digitsOnly;
          if (digitsOnly.length === 12) {
            ean13ToUse = calculateEan13Checksum(digitsOnly);
          } else if (digitsOnly.length !== 13) {
            ean13ToUse = generateBrazilianEan13(product.id, barcodeValue);
          }

          JsBarcode(svgRef.current, ean13ToUse, {
            format: "EAN13",
            lineColor: "#140507",
            width: 2.2,
            height: 65,
            displayValue: true,
            fontSize: 15,
            font: "monospace",
            textMargin: 4,
            margin: 10,
            background: "#ffffff",
          });
        } catch {
          // Handled gracefully
        }
      }
    }
  }, [mode, barcodeValue, qrPayload, product.id]);

  function copyToClipboard() {
    navigator.clipboard.writeText(barcodeValue);
    setCopied(true);
    toast.success("Código copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleGenerateEan() {
    const newEan = generateBrazilianEan13(product.id, barcodeValue);
    setBarcodeValue(newEan);
    setMode("EAN13");
    onUpdateCode?.(newEan);
    toast.success("EAN-13 brasileiro (prefixo 789) gerado!");
  }

  function handleResetToProductCode() {
    const code = (product.code || product.id).trim();
    setBarcodeValue(code);
    onUpdateCode?.(code);
    toast.success("Restaurado para o código original do produto.");
  }

  function downloadImage() {
    try {
      const fileName = `etiqueta-${(product.code || product.id).replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;

      if (mode === "QR" && canvasRef.current) {
        const link = document.createElement("a");
        link.download = fileName;
        link.href = canvasRef.current.toDataURL("image/png");
        link.click();
        toast.success("QR Code baixado com sucesso!");
        return;
      }

      if (svgRef.current) {
        const svgElement = svgRef.current;
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            const link = document.createElement("a");
            link.download = fileName;
            link.href = canvas.toDataURL("image/png");
            link.click();
            toast.success("Código de barras baixado com sucesso!");
          }
        };

        img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
      }
    } catch {
      toast.error("Não foi possível gerar a imagem para download.");
    }
  }

  function handlePrintLabel() {
    const printWindow = window.open("", "_blank", "width=600,height=600");
    if (!printWindow) {
      toast.error("Permita pop-ups no navegador para imprimir a etiqueta.");
      return;
    }

    let codeHtml = "";
    if (mode === "QR" && canvasRef.current) {
      codeHtml = `<img src="${canvasRef.current.toDataURL("image/png")}" style="width: 150px; height: 150px; margin: 0 auto; display: block;" />`;
    } else if (svgRef.current) {
      codeHtml = svgRef.current.outerHTML;
    }

    const priceHtml =
      includePrice && product.price
        ? `<div style="font-size: 19px; font-weight: 800; color: #790a0e; margin-top: 6px;">R$ ${product.price.toFixed(2).replace(".", ",")} <span style="font-size: 11px; font-weight: normal; color: #555;">/${product.unit || "un"}</span></div>`
        : "";

    const stockHtml =
      includeStock
        ? `<div style="font-size: 12px; color: #444; margin-top: 3px;">Estoque atual: <strong>${product.stock || 0} ${product.unit || "un"}</strong></div>`
        : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta - ${product.code || product.description}</title>
          <style>
            @page {
              size: auto;
              margin: 4mm;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              margin: 0;
              padding: 10px;
              color: #111;
              background: #fff;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .label-card {
              width: 320px;
              border: 2px dashed #999;
              padding: 14px;
              border-radius: 8px;
              text-align: center;
              box-sizing: border-box;
            }
            .brand-header {
              font-size: 10px;
              font-weight: bold;
              letter-spacing: 0.1em;
              color: #790a0e;
              text-transform: uppercase;
              border-bottom: 1px solid #ddd;
              padding-bottom: 4px;
              margin-bottom: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .prod-title {
              font-size: 13px;
              font-weight: 800;
              line-height: 1.25;
              color: #111;
              margin-bottom: 5px;
            }
            .prod-meta {
              font-size: 11px;
              color: #666;
              margin-bottom: 8px;
            }
            .code-wrap {
              background: #fff;
              padding: 6px 0;
              display: flex;
              justify-content: center;
            }
            .code-wrap svg {
              max-width: 100%;
              height: auto;
            }
            .footer-info {
              margin-top: 8px;
              padding-top: 6px;
              border-top: 1px dotted #ccc;
              font-size: 10px;
              color: #777;
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="brand-header">
              <span>CASA DAS MANGUEIRAS</span>
              <span>CDM INVENTÁRIO</span>
            </div>
            <div class="prod-title">${product.description}</div>
            <div class="prod-meta">
              <strong>Cód: ${barcodeValue}</strong> ${product.supplier ? `· ${product.supplier}` : ""}
              ${product.ncm ? `<br/>NCM: ${product.ncm}` : ""}
            </div>
            <div class="code-wrap">
              ${codeHtml}
            </div>
            ${priceHtml}
            ${stockHtml}
            <div class="footer-info">
              Formato: ${mode} · Leitura para coletores e inventário físico
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className="flex flex-col gap-4 text-left">
      {/* Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ede5e6] pb-3">
        <div className="flex items-center gap-1.5">
          <ScanLine className="h-4 w-4 text-[#790a0e]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#211718]">
            Formato de leitura
          </span>
        </div>
        <div className="inline-flex rounded-lg bg-[#f4ecec] p-1 text-xs">
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition ${
              mode === "CODE128"
                ? "bg-white text-[#790a0e] shadow-xs"
                : "text-[#6e5f61] hover:text-[#211718]"
            }`}
            onClick={() => setMode("CODE128")}
          >
            <Barcode className="h-3.5 w-3.5" />
            Code 128 (Universal)
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition ${
              mode === "EAN13"
                ? "bg-white text-[#790a0e] shadow-xs"
                : "text-[#6e5f61] hover:text-[#211718]"
            }`}
            onClick={() => setMode("EAN13")}
          >
            <Barcode className="h-3.5 w-3.5" />
            EAN-13 (Comercial)
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition ${
              mode === "QR"
                ? "bg-white text-[#790a0e] shadow-xs"
                : "text-[#6e5f61] hover:text-[#211718]"
            }`}
            onClick={() => setMode("QR")}
          >
            <QrCode className="h-3.5 w-3.5" />
            QR Code (2D)
          </button>
        </div>
      </div>

      {/* Code Input & Helpers */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#4a3c3e]">
            Valor codificado para coletores
          </label>
          <div className="flex items-center gap-1.5">
            <Input
              value={barcodeValue}
              onChange={(e) => {
                setBarcodeValue(e.target.value);
                onUpdateCode?.(e.target.value);
              }}
              placeholder="Digite o código para o leitor..."
              className="font-mono text-sm uppercase border-[#ded3d5] bg-white text-[#211718]"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Copiar código"
              onClick={copyToClipboard}
              className="shrink-0 border-[#ded3d5] hover:bg-[#fdf5f5] hover:text-[#790a0e]"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex flex-col justify-end gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateEan}
              title="Gerar código padrão EAN-13 válido (Brasil 789)"
              className="text-xs border-[#ded3d5] hover:bg-[#fdf5f5] hover:text-[#790a0e]"
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5 text-[#790a0e]" />
              Gerar EAN-13 (789)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetToProductCode}
              title="Usar código original do cadastro"
              className="text-xs text-[#6e5f61] hover:text-[#211718] hover:bg-[#f5eded]"
            >
              Usar código original
            </Button>
          </div>
        </div>
      </div>

      {mode === "QR" && (
        <div className="flex items-center gap-2 rounded-md bg-[#faf7f7] border border-[#eee6e7] p-2 text-xs text-[#5c4e50]">
          <span className="font-semibold text-[#211718]">Conteúdo do QR:</span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="qrFormat"
              checked={qrFormat === "code"}
              onChange={() => setQrFormat("code")}
              className="accent-[#790a0e]"
            />
            Apenas código ({barcodeValue})
          </label>
          <label className="flex items-center gap-1 cursor-pointer ml-3">
            <input
              type="radio"
              name="qrFormat"
              checked={qrFormat === "full"}
              onChange={() => setQrFormat("full")}
              className="accent-[#790a0e]"
            />
            Ficha completa (SKU + Descrição + Empresa)
          </label>
        </div>
      )}

      {/* Main Barcode Display Container */}
      <div
        ref={printAreaRef}
        className="flex flex-col items-center justify-center rounded-xl border border-[#e5dcdd] bg-white p-5 shadow-xs transition"
      >
        <div className="mb-2 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#790a0e]">
            Casa das Mangueiras · CDM
          </span>
          <h4 className="max-w-[380px] truncate text-sm font-bold text-[#211718]" title={product.description}>
            {product.description}
          </h4>
          <p className="text-xs text-[#7a6c6e]">
            {product.supplier || "Geral"} {product.category ? `· ${product.category}` : ""}
            {product.unit ? ` · Unidade: ${product.unit}` : ""}
          </p>
        </div>

        {/* Visual Barcode or QR Canvas */}
        <div className="my-2 flex min-h-[110px] items-center justify-center rounded-lg bg-[#faf7f7] border border-[#f0e8e9] p-3">
          {mode === "QR" ? (
            <canvas ref={canvasRef} className="rounded shadow-xs bg-white" />
          ) : (
            <div className="overflow-x-auto max-w-full">
              <svg ref={svgRef} className="mx-auto block" />
            </div>
          )}
        </div>

        {validationError && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[#a33e3e]">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-[#e5dcdd] text-[#4e3f41]">
            {mode === "QR"
              ? "Leitura 2D (Câmeras / Smartphones / Coletores 2D)"
              : mode === "CODE128"
              ? "Leitura 1D / 2D (Coletores laser, Honeywell, Zebra, etc.)"
              : "Padrão Internacional EAN-13"}
          </Badge>
          {product.price != null && product.price > 0 && (
            <Badge variant="secondary" className="font-semibold bg-[#f6e8ea] text-[#790a0e] border border-[#eed5d8]">
              R$ {product.price.toFixed(2).replace(".", ",")}
            </Badge>
          )}
        </div>
      </div>

      {/* Label Options & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#faf7f7] border border-[#eee6e7] p-3">
        <div className="flex items-center gap-4 text-xs text-[#4e3f41]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includePrice}
              onChange={(e) => setIncludePrice(e.target.checked)}
              className="rounded accent-[#790a0e]"
            />
            Incluir preço na etiqueta
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeStock}
              onChange={(e) => setIncludeStock(e.target.checked)}
              className="rounded accent-[#790a0e]"
            />
            Incluir estoque atual
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadImage}
            className="flex items-center gap-1.5 text-xs border-[#ded3d5] text-[#211718] hover:bg-[#fdf5f5] hover:text-[#790a0e]"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar imagem (PNG)
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePrintLabel}
            className="flex items-center gap-1.5 bg-[#790a0e] text-xs text-white hover:bg-[#590607]"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir etiqueta
          </Button>
        </div>
      </div>
    </div>
  );
}

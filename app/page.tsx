"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Archive, Barcode, Boxes, Check, ChevronDown, ClipboardCheck, ClipboardList, Download, Eye, FileDown, FileSpreadsheet, LayoutDashboard, Menu, Minus, PackagePlus, Plus, Printer, RotateCcw, Search, Settings, ShoppingCart, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { jsPDF } from "jspdf";
import productsSeed from "@/lib/products.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast, Toaster } from "sonner";
import { BalanceModule } from "@/components/balance-module";
import { AuthScreen } from "@/components/auth-screen";
import { SettingsModule } from "@/components/settings-module";
import { ProductBarcode } from "@/components/product-barcode";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Product = { id: string; supplier: string; brand: string; code: string; description: string; category: string; unit: string; stock: number; suggested: number; image: string | null; sourceRow: number; cost?: number | null; price?: number | null; ncm?: string; barcode?: string };
type Order = { id: string; dbId?: string; supplier: string; createdAt: string; status: "Rascunho" | "Finalizado"; items: Array<Product & { quantity: number }> };
type ImportPreview = { fileName: string; rows: number; duplicates: number; invalid: number; products: Product[] };

const supplierColors: Record<string, string> = { "Force Line": "#ea580c", Jamaica: "#a16207", "Tubo PU": "#7c3aed", Sucção: "#b91c1c", Bariflex: "#15803d" };
const navItems = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "order", label: "Novo pedido", icon: ShoppingCart },
  { id: "history", label: "Histórico", icon: Archive },
  { id: "products", label: "Produtos", icon: Boxes },
  { id: "balance", label: "Balanço de estoque", icon: ClipboardCheck },
  { id: "settings", label: "Configurações", icon: Settings },
];

const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").trim().toUpperCase();
const productKey = (product: Pick<Product, "code" | "description" | "supplier">) => product.code ? `COD:${normalize(product.code)}` : `DESC:${normalize(product.description)}|${normalize(product.supplier)}`;
const fromCloudProduct = (product: Record<string, unknown>): Product => ({ id:String(product.id),code:String(product.code||""),description:String(product.description||""),brand:String(product.brand||""),supplier:String(product.supplier||""),category:String(product.category||"Diversos"),unit:String(product.unit||"un"),stock:Number(product.stock)||0,suggested:0,image:product.image_url ? String(product.image_url) : null,sourceRow:0,cost:product.cost===null?null:Number(product.cost),price:product.price===null?null:Number(product.price),ncm:String(product.ncm||"") });

function openCatalogDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("central-pedido", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("catalog");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function loadCatalog(): Promise<Product[] | null> {
  try { const db = await openCatalogDb(); return await new Promise((resolve, reject) => { const req = db.transaction("catalog").objectStore("catalog").get("products"); req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error); }); } catch { return null; }
}
async function persistCatalog(products: Product[]) {
  const db = await openCatalogDb();
  await new Promise<void>((resolve, reject) => { const tx = db.transaction("catalog", "readwrite"); tx.objectStore("catalog").put(products, "products"); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
}

export default function Home() {
  const [view, setView] = useState("order");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>(productsSeed as Product[]);
  const [supplier, setSupplier] = useState("Force Line");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("pedido-central-orders") || "[]") as Order[]; } catch { return []; }
  });
  const [onlySelected, setOnlySelected] = useState(false);
  const [productModal, setProductModal] = useState<Product | null>(null);
  const [productModalTab, setProductModalTab] = useState<"dados" | "codigo">("dados");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState("Conectando ao banco...");
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) setAuthLoading(false);
    }, 2500);

    void supabase.auth.getSession().then(({ data }) => {
      resolved = true;
      clearTimeout(timeout);
      setUser(data.session?.user || null);
      setAuthLoading(false);
    }).catch(() => {
      resolved = true;
      clearTimeout(timeout);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setAuthLoading(false);
    });
    return () => {
      clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function connectCloud() {
      setOrganizationId(null);
      setCloudStatus("Sincronizando dados...");
      const { data: memberships, error: membershipError } = await supabase.from("organization_members").select("organization_id").eq("user_id", user!.id);
      if (membershipError) { console.error("Falha ao carregar organizações", membershipError); setCloudStatus("Falha na sincronização"); return; }
      const preferredId = localStorage.getItem("central-active-organization");
      let orgId = memberships?.find((item) => item.organization_id === preferredId)?.organization_id || memberships?.[0]?.organization_id as string | undefined;
      if (!orgId) {
        const { data: existingOrganization } = await supabase.from("organizations").select("id").eq("created_by", user!.id).limit(1).maybeSingle();
        let organization = existingOrganization;
        if (!organization) {
          const result = await supabase.from("organizations").insert({ name: "Casa das Mangueiras", created_by: user!.id }).select("id").single();
          if (result.error) { setCloudStatus("Falha ao criar a organização"); return; }
          organization = result.data;
        }
        orgId = organization.id;
        const { error: memberError } = await supabase.from("organization_members").insert({ organization_id: orgId, user_id: user!.id, role: "owner" });
        if (memberError && memberError.code !== "23505") { setCloudStatus("Falha ao autorizar o administrador"); return; }
        const { count } = await supabase.from("inventory_sectors").select("id", { count:"exact", head:true }).eq("organization_id", orgId);
        if (!count) await supabase.from("inventory_sectors").insert([
          { organization_id:orgId, name:"Loja / Salão", location:"Área de vendas", owner_name:"", status:"Não iniciado", notes:"" },
          { organization_id:orgId, name:"Depósito", location:"Estoque interno", owner_name:"", status:"Não iniciado", notes:"" },
          { organization_id:orgId, name:"Área externa", location:"Pátio", owner_name:"", status:"Não iniciado", notes:"" },
        ]);
      }
      if (!orgId || cancelled) return;
      localStorage.setItem("central-active-organization", orgId);
      setOrganizationId(orgId);
      const cloudProducts: Product[] = []; let from = 0;
      while (true) {
        const { data, error } = await supabase.from("products").select("id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,image_url").eq("organization_id", orgId).range(from, from + 999);
        if (error) { setCloudStatus("Falha ao carregar produtos"); return; }
        cloudProducts.push(...(data || []).map((product) => fromCloudProduct(product)));
        if (!data || data.length < 1000) break; from += 1000;
      }
      if (!cloudProducts.length) {
        setCloudStatus("Enviando catálogo inicial...");
        for (let index = 0; index < productsSeed.length; index += 400) {
          const batch = (productsSeed as Product[]).slice(index,index+400).map((p)=>({organization_id:orgId,code:p.code||null,description:p.description,brand:p.brand||"",supplier:p.supplier,category:p.category,unit:p.unit,stock:p.stock,cost:p.cost??null,price:p.price??null,ncm:p.ncm||null,image_url:p.image||null,created_by:user!.id}));
          const { data, error } = await supabase.from("products").upsert(batch,{onConflict:"organization_id,product_key",ignoreDuplicates:true}).select("id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,image_url");
          if (error) { setCloudStatus("Falha ao enviar o catálogo"); return; }
          cloudProducts.push(...(data || []).map((product) => fromCloudProduct(product)));
        }
      }
      const { data: orderRows, error: ordersError } = await supabase.from("purchase_orders").select("id,order_number,supplier,status,created_at,purchase_order_items(quantity,unit,products(id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,image_url))").eq("organization_id", orgId).order("created_at", { ascending:false }).limit(250);
      if (ordersError) { setCloudStatus("Produtos sincronizados; falha no histórico"); return; }
      const cloudOrders: Order[] = (orderRows || []).map((row) => ({ id:row.order_number,dbId:row.id,supplier:row.supplier,createdAt:row.created_at,status:row.status as Order["status"],items:(row.purchase_order_items || []).flatMap((item) => item.products ? [{...fromCloudProduct(item.products as unknown as Record<string, unknown>),quantity:Number(item.quantity)}] : []) }));
      if (!cancelled) {
        setProducts(cloudProducts);
        setOrders(cloudOrders);
        localStorage.setItem("pedido-central-orders", JSON.stringify(cloudOrders));
        await persistCatalog(cloudProducts);
        setCloudStatus("Dados sincronizados");
      }
    }
    void connectCloud(); return () => { cancelled = true; };
  }, [user, syncAttempt]);

  useEffect(() => {
    void loadCatalog().then((catalog) => { if (catalog?.length) setProducts(catalog); });
  }, []);

  useEffect(() => {
    const context = (document as unknown as { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "search_products",
      title: "Pesquisar produtos",
      description: "Pesquisa produtos cadastrados por código, descrição ou fornecedor.",
      inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input: unknown) {
        const query = String((input as { query?: string }).query || "").toLocaleLowerCase("pt-BR");
        return products.filter((p) => `${p.code} ${p.description} ${p.supplier}`.toLocaleLowerCase("pt-BR").includes(query)).slice(0, 20).map(({ id, code, description, supplier, unit, stock }) => ({ id, code, description, supplier, unit, stock }));
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [products]);

  const suppliers = useMemo(() => Array.from(new Set(products.map((p) => p.supplier))), [products]);
  const categories = useMemo(() => ["Todas", ...Array.from(new Set(products.filter((p) => p.supplier === supplier).map((p) => p.category)))], [products, supplier]);
  const filtered = useMemo(() => {
    const normalized = search.toLocaleLowerCase("pt-BR").trim();
    return products.filter((p) => p.supplier === supplier && (category === "Todas" || p.category === category) && (!normalized || `${p.code} ${p.description}`.toLocaleLowerCase("pt-BR").includes(normalized)) && (!onlySelected || (quantities[p.id] || 0) > 0));
  }, [products, supplier, category, search, onlySelected, quantities]);
  const selectedItems = useMemo(() => products.filter((p) => (quantities[p.id] || 0) > 0).map((p) => ({ ...p, quantity: quantities[p.id] })), [products, quantities]);
  const supplierItems = selectedItems.filter((p) => p.supplier === supplier);
  const totalUnits = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  function setQuantity(id: string, value: number) { setQuantities((current) => ({ ...current, [id]: Math.max(0, Number.isFinite(value) ? value : 0) })); }
  async function saveOrder(status: Order["status"]) {
    if (!selectedItems.length) return void toast.error("Adicione pelo menos um produto ao pedido.");
    if (savingOrder) return;
    setSavingOrder(true);
    const order: Order = { id: `PED-${String(Date.now()).slice(-6)}`, supplier: supplierItems.length === selectedItems.length ? supplier : "Vários fornecedores", createdAt: new Date().toISOString(), status, items: selectedItems };
    try {
      if (organizationId && user) {
        const { data: saved, error } = await supabase.from("purchase_orders").insert({ organization_id:organizationId, order_number:order.id, supplier:order.supplier, status, created_by:user.id }).select("id").single();
        if (error || !saved) throw error || new Error("Pedido não retornado pelo banco");
        order.dbId = saved.id;
        const { error: itemError } = await supabase.from("purchase_order_items").insert(selectedItems.map((item)=>({order_id:saved.id,product_id:item.id,quantity:item.quantity,unit:item.unit})));
        if (itemError) { await supabase.from("purchase_orders").delete().eq("id", saved.id); throw itemError; }
      }
      const updated = [order, ...orders];
      setOrders(updated); localStorage.setItem("pedido-central-orders", JSON.stringify(updated));
      toast.success(status === "Finalizado" ? "Pedido finalizado e sincronizado." : "Rascunho salvo e sincronizado.");
      if (status === "Finalizado") setQuantities({});
    } catch {
      toast.error("Não foi possível salvar o pedido. A seleção foi preservada.");
    } finally {
      setSavingOrder(false);
    }
  }
  async function exportXlsx() {
    if (!selectedItems.length) return void toast.error("Não há itens para exportar.");
    const XLSX = await import("xlsx");
    const rows = selectedItems.map((i) => ({ Fornecedor: i.supplier, Código: i.code, Produto: i.description, Categoria: i.category, Estoque: i.stock, Quantidade: i.quantity, Unidade: i.unit }));
    const sheet = XLSX.utils.json_to_sheet(rows); sheet["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 58 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Pedido"); XLSX.writeFile(book, `pedido-${new Date().toISOString().slice(0, 10)}.xlsx`); toast.success("Planilha XLSX baixada.");
  }
  function exportPdf() {
    if (!selectedItems.length) return void toast.error("Não há itens para exportar.");
    const doc = new jsPDF({ orientation: "landscape" }); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("CDM — Pedido de compra", 14, 16); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Casa das Mangueiras · Emitido em ${new Date().toLocaleString("pt-BR")}`, 14, 22);
    let y = 31; doc.setFillColor(20, 46, 74); doc.rect(14, y - 5, 269, 8, "F"); doc.setTextColor(255, 255, 255); doc.text("FORNECEDOR", 16, y); doc.text("CÓDIGO", 52, y); doc.text("PRODUTO", 82, y); doc.text("ESTOQUE", 232, y); doc.text("PEDIDO", 258, y); y += 8; doc.setTextColor(30, 41, 59);
    selectedItems.forEach((i, index) => { if (y > 190) { doc.addPage(); y = 16; } if (index % 2 === 0) { doc.setFillColor(244, 247, 250); doc.rect(14, y - 5, 269, 8, "F"); } doc.text(i.supplier.slice(0, 18), 16, y); doc.text((i.code || "—").slice(0, 15), 52, y); doc.text(i.description.slice(0, 72), 82, y); doc.text(`${i.stock} ${i.unit}`, 232, y); doc.setFont("helvetica", "bold"); doc.text(`${i.quantity} ${i.unit}`, 258, y); doc.setFont("helvetica", "normal"); y += 8; });
    doc.save(`pedido-${new Date().toISOString().slice(0, 10)}.pdf`); toast.success("PDF baixado.");
  }
  async function saveProduct(product: Product) {
    if (!product.description.trim() || !product.supplier.trim()) return void toast.error("Descrição e fornecedor são obrigatórios.");
    const payload = { code:product.code||null,description:product.description.trim(),brand:product.brand.trim(),supplier:product.supplier.trim(),category:product.category.trim()||"Diversos",unit:product.unit.trim()||"un",stock:product.stock,cost:product.cost??null,price:product.price??null,ncm:product.ncm||null,image_url:product.image };
    try {
      let savedProduct = product;
      if (organizationId) {
        if (creatingProduct) {
          const { data, error } = await supabase.from("products").insert({ ...payload, organization_id:organizationId, created_by:user?.id }).select("id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,image_url").single();
          if (error || !data) throw error || new Error("Produto não retornado");
          savedProduct = fromCloudProduct(data);
        } else {
          const { data, error } = await supabase.from("products").update(payload).eq("id",product.id).eq("organization_id",organizationId).select("id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,image_url").single();
          if (error || !data) throw error || new Error("Produto não atualizado");
          savedProduct = fromCloudProduct(data);
        }
      }
      const updated = creatingProduct ? [savedProduct, ...products] : products.map((item) => item.id === savedProduct.id ? savedProduct : item);
      setProducts(updated); await persistCatalog(updated); setProductModal(null); setCreatingProduct(false);
      toast.success(creatingProduct ? "Produto cadastrado." : "Produto atualizado.");
    } catch { toast.error("Não foi possível salvar o produto. Verifique se o código já existe."); }
  }
  async function inspectImport(file?: File) {
    if (!file) return;
    setImporting(true); setImportPreview(null);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: "" });
      const existing = new Set(products.map(productKey)); const inFile = new Set<string>(); const imported: Product[] = [];
      let duplicates = 0, invalid = 0;
      const field = (row: Record<string, unknown>, names: string[]) => { const key = Object.keys(row).find((candidate) => names.includes(normalize(candidate))); return key ? row[key] : ""; };
      raw.forEach((row, index) => {
        const description = String(field(row, ["DESCRICAO", "PRODUTO", "NOME", "ITEM"])).trim();
        const code = String(field(row, ["AUXILIAR", "CODIGO", "COD", "SKU", "REFERENCIA"])).trim();
        const supplierName = String(field(row, ["FORNECEDOR", "FABRICANTE"])).trim() || "Fornecedor não informado";
        if (!description) { invalid++; return; }
        const candidate: Product = { id: `importado-${Date.now()}-${index}`, supplier: supplierName, brand: String(field(row, ["MARCA", "APELIDO"])).trim() || supplierName, code, description, category: String(field(row, ["CATEGORIA", "GRUPO"])).trim() || "Diversos", unit: String(field(row, ["UNIDADE", "UND", "UN"])).trim() || "un", stock: Number(field(row, ["ESTOQUE", "SALDO"])) || 0, suggested: 0, image: null, sourceRow: index + 2, cost: Number(field(row, ["PR CUSTO", "PRECO CUSTO", "CUSTO"])) || null, price: Number(field(row, ["VALOR VENDA AVISTA", "PRECO VENDA", "VENDA"])) || null, ncm: String(field(row, ["NCM"])).trim() };
        const key = productKey(candidate);
        if (existing.has(key) || inFile.has(key)) { duplicates++; return; }
        inFile.add(key); imported.push(candidate);
      });
      setImportPreview({ fileName: file.name, rows: raw.length, duplicates, invalid, products: imported });
    } catch { toast.error("Não foi possível ler a planilha. Use um arquivo XLSX, XLS ou CSV válido."); }
    finally { setImporting(false); }
  }
  async function confirmImport() {
    if (!importPreview?.products.length) return;
    setImporting(true);
    try {
      const persisted: Product[] = [];
      if (organizationId && user) {
        for(let index=0;index<importPreview.products.length;index+=300){
          const batch=importPreview.products.slice(index,index+300).map((p)=>({organization_id:organizationId,code:p.code||null,description:p.description,brand:p.brand,supplier:p.supplier,category:p.category,unit:p.unit,stock:p.stock,cost:p.cost??null,price:p.price??null,ncm:p.ncm||null,image_url:p.image,created_by:user.id}));
          const {data,error}=await supabase.from("products").upsert(batch,{onConflict:"organization_id,product_key",ignoreDuplicates:true}).select("id,code,description,brand,supplier,category,unit,stock,cost,price,ncm,image_url");
          if(error) throw error;
          persisted.push(...(data||[]).map((item)=>fromCloudProduct(item)));
        }
      } else persisted.push(...importPreview.products);
      const updated = [...products, ...persisted]; setProducts(updated); await persistCatalog(updated);
      toast.success(`${persisted.length.toLocaleString("pt-BR")} produtos importados sem duplicidade.`); setImportOpen(false); setImportPreview(null);
    } catch { toast.error("Não foi possível concluir a importação. O catálogo anterior foi preservado."); }
    finally { setImporting(false); }
  }

  function createProduct() {
    setCreatingProduct(true);
    setProductModalTab("dados");
    setProductModal({ id:`new-${Date.now()}`,supplier:supplier || "",brand:"",code:"",description:"",category:"Diversos",unit:"un",stock:0,suggested:0,image:null,sourceRow:0,cost:null,price:null,ncm:"",barcode:"" });
  }

  function repeatOrder(order: Order) {
    setQuantities(Object.fromEntries(order.items.map((item) => [item.id, item.quantity])));
    if (order.items[0]?.supplier) setSupplier(order.items[0].supplier);
    setView("order");
    toast.success("Itens carregados em um novo pedido.");
  }

  async function removeOrder(order: Order) {
    if (!confirm(`Excluir o pedido ${order.id}?`)) return;
    if (order.dbId && organizationId) {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", order.dbId).eq("organization_id", organizationId);
      if (error) return void toast.error("Não foi possível excluir o pedido.");
    }
    const updated = orders.filter((item) => item.id !== order.id);
    setOrders(updated); localStorage.setItem("pedido-central-orders", JSON.stringify(updated));
    toast.success("Pedido excluído.");
  }

  if (authLoading) return <main className="auth-page"><div className="auth-loading">Carregando acesso seguro...</div></main>;
  if (!user) return <AuthScreen />;
  return <div className="app-shell">
    <Toaster richColors position="top-right" />
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Image src="/brand/casa-das-mangueiras-logo.webp" width={40} height={40} priority alt="Casa das Mangueiras" /></div><div><strong>CDM</strong><span>Casa das Mangueiras</span></div><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"><X /></button></div>
      <nav><p className="nav-label">OPERAÇÃO</p>{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setSidebarOpen(false); }}><Icon size={19} /><span>{item.label}</span>{item.id === "order" && selectedItems.length > 0 && <b>{selectedItems.length}</b>}</button>; })}</nav>
      <div className="sidebar-foot"><div className="user-card"><div className="avatar">{(user.email?.[0] || "C").toUpperCase()}</div><div><strong>{user.email?.split("@")[0] || "Equipe de compras"}</strong><span>{cloudStatus}</span></div></div></div>
    </aside>
    {sidebarOpen && <button className="backdrop" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}
    <main className="main-area"><header className="topbar"><button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu"><Menu /></button><div className="topbar-search"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto, código ou medida..." /></div><div className="topbar-actions"><span className={`sync-dot ${cloudStatus.startsWith("Falha") ? "sync-error" : cloudStatus === "Dados sincronizados" ? "sync-ok" : "sync-loading"}`} /> {cloudStatus}<button className="logout-button" onClick={() => supabase.auth.signOut()}>Sair</button></div></header>
      {view === "order" && <section className="content order-content">
        <div className="page-heading"><div><span className="eyebrow">COMPRAS</span><h1>Novo pedido</h1><p>Selecione o fornecedor, confira o estoque e informe o que precisa comprar.</p></div><div className="heading-actions"><Button variant="outline" disabled={savingOrder} onClick={() => saveOrder("Rascunho")}>Salvar rascunho</Button><Button disabled={savingOrder} onClick={() => saveOrder("Finalizado")}><Check size={17} /> {savingOrder ? "Salvando..." : "Finalizar pedido"}</Button></div></div>
        <div className="supplier-selector"><div><span>Fornecedor do pedido</span><strong>{suppliers.length.toLocaleString("pt-BR")} fornecedores cadastrados</strong></div><div className="select-wrap supplier-select"><Boxes size={17} /><select value={supplier} onChange={(e) => { setSupplier(e.target.value); setCategory("Todas"); }}>{suppliers.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={15} /></div><Badge variant="secondary">{products.filter((p) => p.supplier === supplier).length.toLocaleString("pt-BR")} produtos</Badge></div>
        <div className="order-layout"><div className="catalog-card"><div className="catalog-toolbar"><div><h2>Produtos de {supplier}</h2><span>{filtered.length} produtos encontrados</span></div><div className="filters"><div className="select-wrap"><SlidersHorizontal size={16} /><select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={14} /></div><button className={onlySelected ? "filter-active" : ""} onClick={() => setOnlySelected((v) => !v)}>Somente adicionados</button></div></div>
          <div className="product-list-head"><span>Produto</span><span>Estoque</span><span>Quantidade do pedido</span></div><div className="product-list">{filtered.map((product) => { const quantity = quantities[product.id] || 0; return <article className={`product-row ${quantity > 0 ? "has-quantity" : ""}`} key={product.id}><div className="product-main"><button className="product-image" onClick={() => { setProductModal(product); setProductModalTab("dados"); }} aria-label={`Editar ${product.description}`}>{product.image ? <img src={product.image} alt="" /> : <PackagePlus size={25} />}</button><div><div className="product-meta flex items-center justify-between gap-2"><span>{product.code || product.category}</span><button type="button" onClick={(e) => { e.stopPropagation(); setProductModal(product); setProductModalTab("codigo"); }} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#f6e8ea] text-[#790a0e] hover:bg-[#eed5d8] border border-[#eed5d8] transition" title="Código de barras / QR Code (Leitor de inventário)"><Barcode size={12} /><span>Barras/QR</span></button></div><strong>{product.description}</strong><span>{product.category} · unidade: {product.unit}</span></div></div><div className="stock"><strong>{product.stock}</strong><span>{product.unit}</span></div><div className="quantity-control"><button onClick={() => setQuantity(product.id, quantity - 1)} disabled={quantity === 0} aria-label="Diminuir"><Minus size={16} /></button><input aria-label={`Quantidade de ${product.description}`} type="number" min="0" value={quantity || ""} placeholder="0" onChange={(e) => setQuantity(product.id, Number(e.target.value))} /><button onClick={() => setQuantity(product.id, quantity + 1)} aria-label="Aumentar"><Plus size={16} /></button><span>{product.unit}</span></div></article>; })}</div></div>
          <aside className="order-summary"><div className="summary-title"><div><ShoppingCart size={19} /><h2>Resumo do pedido</h2></div><Badge>{selectedItems.length} itens</Badge></div>{selectedItems.length === 0 ? <div className="empty-summary"><ShoppingCart size={29} /><strong>Seu pedido está vazio</strong><span>Informe a quantidade ao lado dos produtos.</span></div> : <div className="summary-items">{selectedItems.slice(0, 8).map((item) => <div key={item.id}><i style={{ background: supplierColors[item.supplier] }} /><div><strong>{item.description}</strong><span>{item.supplier}</span></div><b>{item.quantity} {item.unit}</b><button onClick={() => setQuantity(item.id, 0)} aria-label="Remover"><Trash2 size={15} /></button></div>)}{selectedItems.length > 8 && <p>+ {selectedItems.length - 8} outros produtos</p>}</div>}<div className="summary-total"><span>Total solicitado</span><strong>{totalUnits.toLocaleString("pt-BR")} <small>unidades/medidas</small></strong></div><div className="export-label">EXPORTAR OU COMPARTILHAR</div><div className="export-grid"><button onClick={exportPdf}><FileDown size={18} /><span>Baixar PDF</span></button><button onClick={exportXlsx}><Download size={18} /><span>Baixar XLSX</span></button><button onClick={() => window.print()}><Printer size={18} /><span>Imprimir</span></button></div><Button className="w-full" disabled={savingOrder} onClick={() => saveOrder("Finalizado")}><Check size={17} /> {savingOrder ? "Salvando..." : "Finalizar e salvar"}</Button></aside>
        </div>
      </section>}
      {view === "dashboard" && <Dashboard products={products} orders={orders} onNew={() => setView("order")} />}
      {view === "history" && <History orders={orders} onRemove={removeOrder} onRepeat={repeatOrder} />}
      {view === "products" && <Products products={products} onEdit={(product, tab = "dados") => { setCreatingProduct(false); setProductModal(product); setProductModalTab(tab); }} onCreate={createProduct} onImport={() => setImportOpen(true)} />}
      {view === "balance" && <BalanceModule products={products} organizationId={organizationId} userId={user.id} />}
      {view === "settings" && (organizationId ? <SettingsModule user={user} organizationId={organizationId} onOrganizationChange={() => window.location.reload()} /> : <section className="content settings-unavailable"><div className="panel"><Settings size={30}/><div><span className="eyebrow">CONFIGURAÇÕES</span><h1>{cloudStatus.startsWith("Falha") ? "Não foi possível carregar agora" : "Preparando sua organização"}</h1><p>{cloudStatus.startsWith("Falha") ? "A conexão foi interrompida. Tente novamente; seus dados locais continuam preservados." : "Estamos conectando sua conta e preparando os dados da empresa."}</p></div><Button onClick={() => setSyncAttempt((attempt) => attempt + 1)} disabled={!cloudStatus.startsWith("Falha")}><RotateCcw size={16}/> Tentar novamente</Button></div></section>)}
    </main>
    <Dialog open={!!productModal} onOpenChange={(open) => { if (!open) { setProductModal(null); setCreatingProduct(false); } }}><DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{creatingProduct ? "Cadastrar produto" : "Detalhes do produto"}</DialogTitle></DialogHeader>{productModal && <ProductEditor key={`${productModal.id}-${productModalTab}`} product={productModal} initialTab={productModalTab} onSave={saveProduct} />}</DialogContent></Dialog>
    <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) setImportPreview(null); }}><DialogContent className="sm:max-w-[600px]"><DialogHeader><DialogTitle>Importar novos produtos</DialogTitle></DialogHeader><div className="import-box"><label className="file-drop"><FileSpreadsheet size={30} /><strong>{importing ? "Analisando a planilha..." : "Selecionar planilha de produtos"}</strong><span>XLSX, XLS ou CSV · os produtos repetidos serão ignorados</span><input type="file" accept=".xlsx,.xls,.csv" disabled={importing} onChange={(e) => inspectImport(e.target.files?.[0])} /></label>{importPreview && <div className="import-result"><div><span>Arquivo</span><strong>{importPreview.fileName}</strong></div><div className="import-metrics"><article><strong>{importPreview.rows.toLocaleString("pt-BR")}</strong><span>linhas lidas</span></article><article className="success"><strong>{importPreview.products.length.toLocaleString("pt-BR")}</strong><span>produtos novos</span></article><article><strong>{importPreview.duplicates.toLocaleString("pt-BR")}</strong><span>duplicados ignorados</span></article><article><strong>{importPreview.invalid.toLocaleString("pt-BR")}</strong><span>linhas inválidas</span></article></div><p>A comparação usa o código do produto. Sem código, utiliza descrição e fornecedor.</p><Button className="w-full" disabled={!importPreview.products.length} onClick={confirmImport}><Upload size={17} /> Confirmar importação</Button></div>}</div></DialogContent></Dialog>
  </div>;
}

function Dashboard({ products, orders, onNew }: { products: Product[]; orders: Order[]; onNew: () => void }) {
  const suppliers = Array.from(new Set(products.map((p) => p.supplier))); const last = orders[0];
  return <section className="content"><div className="page-heading"><div><span className="eyebrow">PAINEL</span><h1>Visão geral</h1><p>Produtos, fornecedores e pedidos em um só lugar.</p></div><Button onClick={onNew}><Plus size={17} /> Criar pedido</Button></div><div className="metric-grid"><div><span>Produtos cadastrados</span><strong>{products.length}</strong><small>Importados das planilhas</small></div><div><span>Fornecedores</span><strong>{suppliers.length}</strong><small>Catálogos unificados</small></div><div><span>Pedidos salvos</span><strong>{orders.length}</strong><small>{orders.filter((o) => o.status === "Finalizado").length} finalizados</small></div><div><span>Último pedido</span><strong className="small-metric">{last ? new Date(last.createdAt).toLocaleDateString("pt-BR") : "Nenhum"}</strong><small>{last?.supplier || "Comece um novo pedido"}</small></div></div><div className="dashboard-grid"><div className="panel"><div className="panel-heading"><h2>Catálogos por fornecedor</h2><span>Base atual</span></div>{suppliers.map((name) => <div className="supplier-line" key={name}><i style={{ background: supplierColors[name] }} /><div><strong>{name}</strong><span>{products.filter((p) => p.supplier === name).length} produtos</span></div><b>{Math.round(products.filter((p) => p.supplier === name).length / products.length * 100)}%</b></div>)}</div><div className="panel"><div className="panel-heading"><h2>Pedidos recentes</h2><span>{orders.length} registros</span></div>{orders.length ? orders.slice(0, 6).map((order) => <div className="recent-order" key={order.id}><div><strong>{order.id}</strong><span>{order.supplier} · {new Date(order.createdAt).toLocaleDateString("pt-BR")}</span></div><Badge variant="secondary">{order.status}</Badge><b>{order.items.length} itens</b></div>) : <div className="empty-panel"><ClipboardList /><strong>Nenhum pedido salvo</strong><span>Os pedidos finalizados aparecerão aqui.</span></div>}</div></div></section>;
}

function History({ orders, onRemove, onRepeat }: { orders: Order[]; onRemove: (order: Order) => void; onRepeat: (order: Order) => void }) {
  const [selected, setSelected] = useState<Order | null>(null);
  return <section className="content"><div className="page-heading"><div><span className="eyebrow">REGISTROS</span><h1>Histórico de pedidos</h1><p>Consulte, confira e refaça pedidos sincronizados.</p></div></div><div className="panel table-panel"><div className="history-head"><span>Pedido</span><span>Fornecedor</span><span>Data</span><span>Itens</span><span>Status</span><span>Ações</span></div>{orders.length ? orders.map((order) => <div className="history-row" key={order.dbId || order.id}><strong>{order.id}</strong><span>{order.supplier}</span><span>{new Date(order.createdAt).toLocaleString("pt-BR")}</span><span>{order.items.length}</span><Badge variant={order.status === "Finalizado" ? "default" : "secondary"}>{order.status}</Badge><div className="row-actions"><button onClick={() => setSelected(order)} title="Ver itens"><Eye size={16} /></button><button onClick={() => onRepeat(order)} title="Repetir pedido"><RotateCcw size={16} /></button><button className="danger" onClick={() => void onRemove(order)} title="Excluir"><Trash2 size={16} /></button></div></div>) : <div className="empty-panel tall"><Archive /><strong>Histórico vazio</strong><span>Salve um rascunho ou finalize um pedido para começar.</span></div>}</div><Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="sm:max-w-[720px]"><DialogHeader><DialogTitle>Pedido {selected?.id}</DialogTitle></DialogHeader>{selected && <div className="order-detail"><div className="order-detail-meta"><span>{selected.supplier}</span><span>{new Date(selected.createdAt).toLocaleString("pt-BR")}</span><Badge>{selected.status}</Badge></div><div className="order-detail-list">{selected.items.map((item) => <div key={item.id}><div><strong>{item.description}</strong><span>{item.code || "Sem código"} · {item.supplier}</span></div><b>{item.quantity} {item.unit}</b></div>)}</div><Button onClick={() => { onRepeat(selected); setSelected(null); }}><RotateCcw size={16}/> Criar novo com estes itens</Button></div>}</DialogContent></Dialog></section>;
}

function Products({ products, onEdit, onCreate, onImport }: { products: Product[]; onEdit: (product: Product, tab?: "dados" | "codigo") => void; onCreate: () => void; onImport: () => void }) {
  const [term, setTerm] = useState(""); const [supplierFilter, setSupplierFilter] = useState("Todos"); const [limit, setLimit] = useState(120);
  const suppliers = useMemo(() => Array.from(new Set(products.map((p) => p.supplier))).sort((a,b) => a.localeCompare(b, "pt-BR")), [products]);
  const filtered = useMemo(() => products.filter((p) => (supplierFilter === "Todos" || p.supplier === supplierFilter) && `${p.description} ${p.code} ${p.supplier} ${p.brand}`.toLowerCase().includes(term.toLowerCase())), [products, supplierFilter, term]);
  return <section className="content"><div className="page-heading"><div><span className="eyebrow">CATÁLOGO MESTRE</span><h1>Produtos</h1><p>Base unificada, sem duplicidades e pronta para receber novas planilhas.</p></div><div className="heading-actions"><Button variant="outline" onClick={onCreate}><Plus size={17}/> Novo produto</Button><Button onClick={onImport}><Upload size={17} /> Importar planilha</Button></div></div><div className="products-toolbar"><div className="inline-search"><Search size={17} /><Input value={term} onChange={(e) => { setTerm(e.target.value); setLimit(120); }} placeholder="Pesquisar produto, código, marca ou fornecedor..." /></div><div className="select-wrap"><select value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setLimit(120); }}><option>Todos</option>{suppliers.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={14} /></div><Badge variant="secondary">{filtered.length.toLocaleString("pt-BR")} produtos</Badge></div><div className="product-grid">{filtered.slice(0, limit).map((product) => <div key={product.id} className="product-card flex items-start justify-between gap-2 p-3"><div className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(product, "dados")}><div className="card-image">{product.image ? <img src={product.image} alt="" /> : <PackagePlus />}</div><div className="flex-1 min-w-0"><span>{product.supplier} · {product.code || product.category}</span><strong>{product.description}</strong><small>{product.brand !== product.supplier ? `${product.brand} · ` : ""}Estoque: {product.stock} {product.unit}</small></div></div><button type="button" className="p-2 text-[#9c8e90] hover:text-[#790a0e] hover:bg-[#f6e8ea] rounded-lg transition shrink-0" title="Ver código de barras / QR Code deste produto" onClick={(e) => { e.stopPropagation(); onEdit(product, "codigo"); }}><Barcode size={18} /></button></div>)}</div>{filtered.length > limit && <div className="load-more"><Button variant="outline" onClick={() => setLimit((value) => value + 120)}>Mostrar mais produtos ({(filtered.length - limit).toLocaleString("pt-BR")})</Button></div>}</section>;
}

function ProductEditor({ product, initialTab = "dados", onSave }: { product: Product; initialTab?: "dados" | "codigo"; onSave: (product: Product) => void }) {
  const [tab, setTab] = useState<"dados" | "codigo">(initialTab);
  const [draft, setDraft] = useState(product);

  function loadImage(file?: File) {
    if (!file) return;
    if (file.size > 1_000_000) return void toast.error("A imagem deve ter no máximo 1 MB.");
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, image: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex border-b border-[#ede5e6]">
        <button
          type="button"
          onClick={() => setTab("dados")}
          className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition ${
            tab === "dados"
              ? "border-[#790a0e] text-[#790a0e]"
              : "border-transparent text-[#7a6c6e] hover:text-[#211718]"
          }`}
        >
          Dados cadastrais
        </button>
        <button
          type="button"
          onClick={() => setTab("codigo")}
          className={`pb-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition ${
            tab === "codigo"
              ? "border-[#790a0e] text-[#790a0e]"
              : "border-transparent text-[#7a6c6e] hover:text-[#211718]"
          }`}
        >
          <Barcode className="h-4 w-4" />
          Código de barras & QR Code (Inventário)
        </button>
      </div>

      {tab === "dados" ? (
        <div className="editor-form">
          <div className="editor-image">
            {draft.image ? <img src={draft.image} alt="" /> : <PackagePlus />}
            <label>
              Trocar imagem
              <input type="file" accept="image/*" onChange={(e) => loadImage(e.target.files?.[0])} />
            </label>
          </div>
          <label>
            Descrição
            <Input required value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <div className="form-row">
            <label>
              Código do produto (SKU)
              <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
            </label>
            <label>
              NCM
              <Input value={draft.ncm || ""} onChange={(e) => setDraft({ ...draft, ncm: e.target.value })} />
            </label>
          </div>

          <div className="rounded-lg border border-[#ede5e6] bg-[#faf7f7] p-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Barcode className="h-4 w-4 text-[#790a0e]" />
              <div>
                <strong className="text-xs text-[#211718] block">Leitura ótica para coletores e inventário</strong>
                <span className="text-[11px] text-[#7a6c6e] block">
                  Código ativo: <span className="font-mono font-semibold text-[#790a0e]">{draft.barcode || draft.code || draft.id}</span>
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTab("codigo")}
              className="text-xs h-7 border-[#ded3d5] text-[#790a0e] hover:bg-[#fdf5f5]"
            >
              Gerar / Ver etiqueta
            </Button>
          </div>

          <div className="form-row">
            <label>
              Fornecedor
              <Input value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} />
            </label>
            <label>
              Marca
              <Input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Categoria
              <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            </label>
            <label>
              Unidade
              <Input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Estoque
              <Input type="number" min="0" step="any" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) })} />
            </label>
            <label>
              Custo
              <Input type="number" min="0" step="0.01" value={draft.cost ?? ""} onChange={(e) => setDraft({ ...draft, cost: e.target.value === "" ? null : Number(e.target.value) })} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Preço de venda
              <Input type="number" min="0" step="0.01" value={draft.price ?? ""} onChange={(e) => setDraft({ ...draft, price: e.target.value === "" ? null : Number(e.target.value) })} />
            </label>
          </div>
          <Button onClick={() => onSave(draft)}>Salvar alterações</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ProductBarcode
            product={draft}
            onUpdateCode={(code) => {
              setDraft((d) => ({ ...d, barcode: code, code: d.code || code }));
            }}
          />
          <div className="flex justify-between items-center pt-2 border-t border-[#ede5e6]">
            <Button type="button" variant="outline" size="sm" onClick={() => setTab("dados")}>
              Voltar aos dados do produto
            </Button>
            <Button size="sm" onClick={() => onSave(draft)}>
              Salvar produto
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

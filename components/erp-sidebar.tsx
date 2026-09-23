"use client";

import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  Search,
  ShoppingCart,
  Factory,
  Truck,
  DollarSign,
  Package,
  Wrench,
  FileText,
  BarChart3,
  Settings,
  Folder,
  FolderOpen,
  Building2,
  Percent,
  Keyboard,
  Globe,
  Users,
  ShoppingBag,
  Download,
  UserCheck,
  Barcode,
  ClipboardList,
  Lock,
  Zap,
  Monitor,
  ChevronRight,
  ChevronDown,
  X,
  LogOut,
  Info,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { UserAccess } from "@/lib/access";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ErpSidebarProps {
  currentView: string;
  onNavigate: (view: string, subTab?: string) => void;
  onOpenErpOrderModal: () => void;
  onOpenImport: () => void;
  onOpenLabels?: () => void;
  organizationName: string;
  user: User | null;
  access: UserAccess | null;
  cloudStatus: string;
  selectedOrderCount?: number;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onSignOut: () => void;
}

export function ErpSidebar({
  currentView,
  onNavigate,
  onOpenErpOrderModal,
  onOpenImport,
  onOpenLabels,
  organizationName,
  user,
  access,
  cloudStatus,
  selectedOrderCount = 0,
  sidebarOpen,
  setSidebarOpen,
  onSignOut,
}: ErpSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    config: true,
    sistema: true,
  });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [marginModalOpen, setMarginModalOpen] = useState(false);

  // Derive active item from selection or current view
  const activeItem = useMemo(() => {
    if (selectedItemId) return selectedItemId;
    if (currentView === "dashboard") return "relatorios";
    if (currentView === "order") return "compras_vendas";
    if (currentView === "products" || currentView === "balance") return "estoque";
    if (currentView === "settings") return "empresa";
    return "empresa";
  }, [selectedItemId, currentView]);

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey],
    }));
  };

  const handleItemClick = (itemId: string) => {
    setSelectedItemId(itemId);
    setSidebarOpen(false);

    switch (itemId) {
      case "compras_vendas":
      case "vendas":
        onNavigate("order", "compose");
        break;
      case "forca_vendas":
        onOpenErpOrderModal();
        break;
      case "producao":
        onNavigate("order", "history");
        break;
      case "transportes":
        onNavigate("order", "history");
        break;
      case "financeiro":
        onNavigate("dashboard");
        break;
      case "estoque":
        onNavigate("balance");
        break;
      case "ferramentas":
        onNavigate("products");
        break;
      case "relatorios":
      case "graficos":
        onNavigate("dashboard");
        break;
      case "empresa":
        onNavigate("settings");
        break;
      case "margem":
        setMarginModalOpen(true);
        break;
      case "atalhos":
        setShortcutsModalOpen(true);
        break;
      case "informacao_web":
        onNavigate("settings");
        break;
      case "usuarios":
      case "controle_usuario":
        onNavigate("settings");
        break;
      case "importar_exportar":
        onOpenImport();
        break;
      case "etiquetas":
        if (onOpenLabels) onOpenLabels();
        else onNavigate("products");
        break;
      case "auditoria":
        onNavigate("order", "history");
        break;
      case "painel_restrito":
        onNavigate("settings");
        break;
      case "sistema_root":
        onNavigate("dashboard");
        break;
      default:
        break;
    }
  };

  // Keyboard shortcut Ctrl+K to focus sidebar search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("erp-sidebar-search");
        el?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const searchLower = searchTerm.toLowerCase().trim();

  // Highlight helper
  const matchesSearch = (text: string) => {
    if (!searchLower) return true;
    return text.toLowerCase().includes(searchLower);
  };

  return (
    <>
      <aside
        className={`erp-sidebar fixed inset-0 md:top-0 md:bottom-0 md:left-0 z-40 w-[260px] bg-[#ffffff] border-r border-[#cbd5e1] flex flex-col transition-transform duration-200 shadow-sm ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{ fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif" }}
      >
        {/* Brand Header: Matches 'una sistemas e tecnologia' style from user image */}
        <div className="h-[74px] px-3.5 flex items-center gap-3 border-b border-[#e2e8f0] bg-[#ffffff] select-none">
          <div className="w-10 h-10 rounded-full bg-[#f8fafc] border border-[#cbd5e1] p-1 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
            <Image
              src="/brand/casa-das-mangueiras-logo.webp"
              width={34}
              height={34}
              priority
              alt="Casa das Mangueiras"
              className="object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-[#1e293b] text-base tracking-tight leading-none">
                una sistemas
              </span>
            </div>
            <div className="text-[11px] text-[#64748b] leading-tight font-medium">
              e tecnologia
            </div>
            <div className="text-[10px] text-[#94a3b8] truncate mt-0.5 flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#790a0e]" />
              {organizationName}
            </div>
          </div>
          <button
            type="button"
            className="md:hidden text-[#64748b] hover:text-[#0f172a] p-1.5"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar: Exactly '🔍 abrir' like the screenshot */}
        <div className="p-2 border-b border-[#e2e8f0] bg-[#f8fafc]">
          <div className="relative flex items-center bg-[#ffffff] border border-[#cbd5e1] rounded text-[#334155] focus-within:border-[#3b82f6] focus-within:ring-1 focus-within:ring-[#3b82f6]/30 transition shadow-inner">
            <Search size={14} className="ml-2.5 text-[#64748b] shrink-0" />
            <input
              id="erp-sidebar-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="abrir..."
              className="w-full h-[30px] pl-2 pr-6 text-xs text-[#0f172a] bg-transparent outline-none placeholder:text-[#94a3b8]"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-1.5 p-0.5 text-[#94a3b8] hover:text-[#0f172a]"
                title="Limpar busca"
              >
                <X size={12} />
              </button>
            ) : (
              <span className="absolute right-1.5 text-[10px] text-[#94a3b8] font-mono select-none pointer-events-none">
                Ctrl+K
              </span>
            )}
          </div>
        </div>

        {/* Tree Menu Area with realistic ERP dotted connectors & icons */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 text-[12.5px] leading-tight select-none">
          <ul className="space-y-0.5 text-[#1e293b]">
            {/* 1. Compras / Vendas */}
            {matchesSearch("Compras / Vendas") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("compras_vendas")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "compras_vendas"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <ShoppingCart size={15} className="text-[#0284c7] shrink-0" />
                  <span className="flex-1 truncate">Compras / Vendas</span>
                  {selectedOrderCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-[#790a0e] text-white rounded-full text-[10px] font-bold">
                      {selectedOrderCount}
                    </span>
                  )}
                </button>
              </li>
            )}

            {/* 2. Produção */}
            {matchesSearch("Produção") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("producao")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "producao"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <Factory size={15} className="text-[#64748b] shrink-0" />
                  <span className="flex-1 truncate">Produção</span>
                </button>
              </li>
            )}

            {/* 3. Transportes */}
            {matchesSearch("Transportes") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("transportes")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "transportes"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <Truck size={15} className="text-[#ea580c] shrink-0" />
                  <span className="flex-1 truncate">Transportes</span>
                </button>
              </li>
            )}

            {/* 4. Financeiro */}
            {matchesSearch("Financeiro") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("financeiro")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "financeiro"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <DollarSign size={15} className="text-[#16a34a] shrink-0" />
                  <span className="flex-1 truncate">Financeiro</span>
                </button>
              </li>
            )}

            {/* 5. Estoque */}
            {matchesSearch("Estoque") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("estoque")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "estoque"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <Package size={15} className="text-[#ca8a04] shrink-0" />
                  <span className="flex-1 truncate">Estoque</span>
                </button>
              </li>
            )}

            {/* 6. Ferramentas */}
            {matchesSearch("Ferramentas") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("ferramentas")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "ferramentas"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <Wrench size={15} className="text-[#0284c7] shrink-0" />
                  <span className="flex-1 truncate">Ferramentas</span>
                </button>
              </li>
            )}

            {/* 7. Relatórios */}
            {matchesSearch("Relatórios") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("relatorios")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "relatorios"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <FileText size={15} className="text-[#64748b] shrink-0" />
                  <span className="flex-1 truncate">Relatórios</span>
                </button>
              </li>
            )}

            {/* 8. Gráficos */}
            {matchesSearch("Gráficos") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("graficos")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "graficos"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <BarChart3 size={15} className="text-[#dc2626] shrink-0" />
                  <span className="flex-1 truncate">Gráficos</span>
                </button>
              </li>
            )}

            {/* 9. Configurações (Tree folder with nested sub-items) */}
            <li className="pt-0.5">
              <div
                onClick={() => toggleFolder("config")}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[#f1f5f9] cursor-pointer text-[#1e293b] font-medium"
              >
                <span className="w-3.5 flex justify-center text-[#64748b]">
                  {expandedFolders.config ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
                <Settings size={15} className="text-[#475569] shrink-0" />
                <span className="flex-1 truncate">Configurações</span>
              </div>

              {expandedFolders.config && (
                <ul className="relative pl-5 ml-3.5 space-y-0.5 border-l border-slate-300">
                  {/* Nested Folder: Sistema */}
                  <li className="relative">
                    <div
                      onClick={() => toggleFolder("sistema")}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#f1f5f9] cursor-pointer text-[#1e293b] text-xs font-semibold"
                    >
                      <span className="w-3 flex justify-center text-[#64748b]">
                        {expandedFolders.sistema ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </span>
                      {expandedFolders.sistema ? (
                        <FolderOpen size={14} className="text-[#d97706] shrink-0" />
                      ) : (
                        <Folder size={14} className="text-[#d97706] shrink-0" />
                      )}
                      <span className="truncate">Sistema</span>
                    </div>

                    {expandedFolders.sistema && (
                      <ul className="relative pl-4 ml-3 space-y-0.5 border-l border-slate-300 pt-0.5">
                        {/* Sub-item: Alterar dados da empresa (Highlighted in screenshot!) */}
                        {matchesSearch("Alterar dados da empresa") && (
                          <li className="relative">
                            <button
                              type="button"
                              onClick={() => handleItemClick("empresa")}
                              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition ${
                                activeItem === "empresa"
                                  ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd] shadow-xs"
                                  : "hover:bg-[#f1f5f9] text-[#1e293b]"
                              }`}
                            >
                              <Building2 size={13} className="text-[#0284c7] shrink-0" />
                              <span className="truncate">Alterar dados da empresa</span>
                            </button>
                          </li>
                        )}

                        {/* Sub-item: Margem */}
                        {matchesSearch("Margem") && (
                          <li className="relative">
                            <button
                              type="button"
                              onClick={() => handleItemClick("margem")}
                              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition ${
                                activeItem === "margem"
                                  ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                                  : "hover:bg-[#f1f5f9] text-[#1e293b]"
                              }`}
                            >
                              <Percent size={13} className="text-[#475569] shrink-0" />
                              <span className="truncate">Margem</span>
                            </button>
                          </li>
                        )}

                        {/* Sub-item: Configuração Atalhos */}
                        {matchesSearch("Configuração Atalhos") && (
                          <li className="relative">
                            <button
                              type="button"
                              onClick={() => handleItemClick("atalhos")}
                              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition ${
                                activeItem === "atalhos"
                                  ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                                  : "hover:bg-[#f1f5f9] text-[#1e293b]"
                              }`}
                            >
                              <Keyboard size={13} className="text-[#0284c7] shrink-0" />
                              <span className="truncate">Configuração Atalhos</span>
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </li>

                  {/* Other config tree nodes */}
                  {matchesSearch("Informação Web") && (
                    <li>
                      <button
                        type="button"
                        onClick={() => handleItemClick("informacao_web")}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition ${
                          activeItem === "informacao_web"
                            ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                            : "hover:bg-[#f1f5f9] text-[#1e293b]"
                        }`}
                      >
                        <Globe size={13} className="text-[#0284c7] shrink-0" />
                        <span className="truncate">Informação Web</span>
                      </button>
                    </li>
                  )}

                  {matchesSearch("Usuário / Permissões") && (
                    <li>
                      <button
                        type="button"
                        onClick={() => handleItemClick("usuarios")}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition ${
                          activeItem === "usuarios"
                            ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                            : "hover:bg-[#f1f5f9] text-[#1e293b]"
                        }`}
                      >
                        <Users size={13} className="text-[#ea580c] shrink-0" />
                        <span className="truncate">Usuário / Permissões</span>
                      </button>
                    </li>
                  )}

                  {matchesSearch("Vendas") && (
                    <li>
                      <button
                        type="button"
                        onClick={() => handleItemClick("vendas")}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition ${
                          activeItem === "vendas"
                            ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                            : "hover:bg-[#f1f5f9] text-[#1e293b]"
                        }`}
                      >
                        <ShoppingBag size={13} className="text-[#0284c7] shrink-0" />
                        <span className="truncate">Vendas</span>
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </li>

            {/* 10. Importar / Exportar */}
            {matchesSearch("Importar / Exportar") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("importar_exportar")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "importar_exportar"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <Download size={15} className="text-[#64748b] shrink-0" />
                  <span className="flex-1 truncate">Importar / Exportar</span>
                </button>
              </li>
            )}

            {/* 11. Controle de Usuário */}
            {matchesSearch("Controle de Usuário") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("controle_usuario")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "controle_usuario"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <UserCheck size={15} className="text-[#0284c7] shrink-0" />
                  <span className="flex-1 truncate">Controle de Usuário</span>
                </button>
              </li>
            )}

            {/* 12. Impressão Etiquetas */}
            {matchesSearch("Impressão Etiquetas") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("etiquetas")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "etiquetas"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <Barcode size={15} className="text-[#0284c7] shrink-0" />
                  <span className="flex-1 truncate">Impressão Etiquetas</span>
                </button>
              </li>
            )}

            {/* 13. Auditoria */}
            {matchesSearch("Auditoria") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("auditoria")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "auditoria"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <ClipboardList size={15} className="text-[#64748b] shrink-0" />
                  <span className="flex-1 truncate">Auditoria</span>
                </button>
              </li>
            )}

            {/* 14. Painel Restrito */}
            {matchesSearch("Painel Restrito") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("painel_restrito")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "painel_restrito"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <Lock size={15} className="text-[#475569] shrink-0" />
                  <span className="flex-1 truncate">Painel Restrito</span>
                </button>
              </li>
            )}

            {/* 15. Força de Vendas */}
            {matchesSearch("Força de Vendas") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("forca_vendas")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "forca_vendas"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <Zap size={15} className="text-[#eab308] shrink-0 fill-amber-400" />
                  <span className="flex-1 truncate font-medium">Força de Vendas (PDV)</span>
                  <span className="text-[10px] font-mono px-1 py-0.2 bg-slate-100 rounded text-slate-600 border border-slate-200">
                    F3
                  </span>
                </button>
              </li>
            )}

            {/* 16. Sistema */}
            {matchesSearch("Sistema") && (
              <li>
                <button
                  type="button"
                  onClick={() => handleItemClick("sistema_root")}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition text-left ${
                    activeItem === "sistema_root"
                      ? "bg-[#dcecfe] text-[#0369a1] font-semibold border border-[#bae6fd]"
                      : "hover:bg-[#f1f5f9] text-[#1e293b]"
                  }`}
                >
                  <Monitor size={15} className="text-[#64748b] shrink-0" />
                  <span className="flex-1 truncate">Sistema</span>
                </button>
              </li>
            )}
          </ul>
        </div>

        {/* Footer: Operator & System Info */}
        <div className="p-2.5 border-t border-[#e2e8f0] bg-[#f8fafc] text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded bg-[#790a0e] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                {(user?.email?.[0] || "C").toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[#0f172a] truncate text-[11px]">
                  {user?.email?.split("@")[0] || "Operador CDM"}
                </div>
                <div className="text-[10px] text-[#64748b] truncate flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      cloudStatus === "Dados sincronizados" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {access?.role === "support" ? "Acesso Total" : "Conectado"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              className="p-1.5 text-[#64748b] hover:text-[#dc2626] hover:bg-[#fee2e2] rounded transition"
              title="Sair do sistema"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Modal: Configuração de Atalhos (F3, Ctrl+K, etc.) */}
      <Dialog open={shortcutsModalOpen} onOpenChange={setShortcutsModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Keyboard className="h-5 w-5 text-[#0284c7]" />
              Configuração de Atalhos do Sistema
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-slate-600">
              Utilize os atalhos de teclado para agilizar o atendimento no balcão e a operação do sistema:
            </p>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <div className="flex items-center justify-between p-2.5">
                <span className="font-medium text-slate-800">Emissão Rápida de Pedido / PDV</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded shadow-xs font-mono font-bold text-slate-700">
                  F3
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="font-medium text-slate-800">Buscar no Menu Lateral</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded shadow-xs font-mono font-bold text-slate-700">
                  Ctrl + K
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="font-medium text-slate-800">Buscar Produto / Código SKU</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded shadow-xs font-mono font-bold text-slate-700">
                  F2
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="font-medium text-slate-800">Fechar Janela ou Modal</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded shadow-xs font-mono font-bold text-slate-700">
                  ESC
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="font-medium text-slate-800">Confirmar Inserção de Item</span>
                <kbd className="px-2 py-1 bg-white border border-slate-300 rounded shadow-xs font-mono font-bold text-slate-700">
                  ENTER
                </kbd>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg flex items-start gap-2 text-blue-800 text-[11px]">
              <Info size={16} className="shrink-0 text-blue-600 mt-0.5" />
              <span>
                Os atalhos funcionam em qualquer tela do sistema enquanto a janela do navegador estiver ativa.
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Margem Comercial e Markup */}
      <Dialog open={marginModalOpen} onOpenChange={setMarginModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Percent className="h-5 w-5 text-[#16a34a]" />
              Margem de Lucro & Markup Padrão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-600">
              Configure as diretrizes de precificação e margem bruta sugerida para a empresa:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Markup Médio Aplicado sobre Custo:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={45}
                    className="w-24 px-3 py-1.5 border border-slate-300 rounded text-sm font-bold text-slate-900"
                  />
                  <span className="font-bold text-slate-600">%</span>
                </div>
                <small className="text-slate-500">Ex: Custo R$ 100,00 + 45% = Venda R$ 145,00</small>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Desconto Máximo Autorizado no Balcão:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={12}
                    className="w-24 px-3 py-1.5 border border-slate-300 rounded text-sm font-bold text-slate-900"
                  />
                  <span className="font-bold text-slate-600">%</span>
                </div>
                <small className="text-slate-500">Descontos superiores exigirão aprovação de gerente.</small>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMarginModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => setMarginModalOpen(false)}
                className="px-3 py-1.5 bg-[#790a0e] hover:bg-[#600609] text-white rounded font-bold"
              >
                Salvar Parâmetros
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

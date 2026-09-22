"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, Clipboard, KeyRound, LogOut, RefreshCw, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Role = "owner" | "admin" | "operator" | "viewer";
type Member = { user_id: string; role: Role; created_at: string };
type Membership = { organization_id: string; role: Role; organizations: { name: string } | null };

const roleLabels: Record<Role, string> = { owner: "Proprietário", admin: "Administrador", operator: "Operador", viewer: "Consulta" };

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

export function SettingsModule({ user, organizationId, onOrganizationChange }: { user: User; organizationId: string; onOrganizationChange: (id: string) => void }) {
  const [name, setName] = useState("Casa das Mangueiras");
  const [role, setRole] = useState<Role>("operator");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const canManage = role === "owner" || role === "admin";

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const [organizationResult, memberResult, membershipsResult, inviteResult] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", organizationId).single(),
      supabase.from("organization_members").select("user_id,role,created_at").eq("organization_id", organizationId).order("created_at"),
      supabase.from("organization_members").select("organization_id,role,organizations(name)").eq("user_id", user.id).order("created_at"),
      supabase.from("organization_invites").select("code,expires_at").eq("organization_id", organizationId).gt("expires_at", new Date().toISOString()).maybeSingle(),
    ]);
    if (organizationResult.data) setName(organizationResult.data.name);
    if (memberResult.data) {
      const rows = memberResult.data as Member[];
      setMembers(rows);
      setRole(rows.find((item) => item.user_id === user.id)?.role || "operator");
    }
    if (membershipsResult.data) setMemberships(membershipsResult.data as unknown as Membership[]);
    if (inviteResult.data) setInviteCode(inviteResult.data.code);
    setLoading(false);
  }, [organizationId, user.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSettings(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSettings]);

  async function saveOrganization() {
    const trimmed = name.trim();
    if (!trimmed) return void toast.error("Informe o nome da organização.");
    const { error } = await supabase.from("organizations").update({ name: trimmed }).eq("id", organizationId);
    if (error) return void toast.error("Não foi possível atualizar o nome.");
    toast.success("Nome da organização atualizado.");
  }

  async function generateInvite() {
    const code = makeCode();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("organization_invites").upsert({ organization_id: organizationId, code, role: "operator", expires_at: expiresAt, created_by: user.id }, { onConflict: "organization_id" });
    if (error) return void toast.error("Não foi possível gerar o código de acesso.");
    setInviteCode(code);
    toast.success("Novo código criado. Ele vale por 30 dias.");
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteCode);
    toast.success("Código copiado.");
  }

  async function joinOrganization() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return void toast.error("Digite o código recebido.");
    const { data, error } = await supabase.rpc("accept_organization_invite", { p_code: code });
    if (error || !data) return void toast.error("Código inválido ou expirado.");
    localStorage.setItem("central-active-organization", String(data));
    toast.success("Acesso liberado. Trocando de organização...");
    onOrganizationChange(String(data));
  }

  async function changeRole(member: Member, nextRole: Role) {
    if (member.user_id === user.id || member.role === "owner") return;
    const { error } = await supabase.from("organization_members").update({ role: nextRole }).eq("organization_id", organizationId).eq("user_id", member.user_id);
    if (error) return void toast.error("Não foi possível alterar a permissão.");
    setMembers((current) => current.map((item) => item.user_id === member.user_id ? { ...item, role: nextRole } : item));
    toast.success("Permissão atualizada.");
  }

  async function removeMember(member: Member) {
    if (member.user_id === user.id || member.role === "owner" || !confirm("Remover este usuário da equipe?")) return;
    const { error } = await supabase.from("organization_members").delete().eq("organization_id", organizationId).eq("user_id", member.user_id);
    if (error) return void toast.error("Não foi possível remover o usuário.");
    setMembers((current) => current.filter((item) => item.user_id !== member.user_id));
    toast.success("Usuário removido da equipe.");
  }

  function switchOrganization(id: string) {
    localStorage.setItem("central-active-organization", id);
    onOrganizationChange(id);
  }

  return <section className="content settings-module">
    <div className="page-heading"><div><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Configurações e equipe</h1><p>Gerencie a empresa, os acessos e sua conta.</p></div><Button variant="outline" onClick={() => void loadSettings()} disabled={loading}><RefreshCw size={16}/> Atualizar</Button></div>
    <div className="settings-grid">
      <div className="panel settings-card"><div className="settings-title"><Building2/><div><h2>Organização</h2><span>Empresa ativa neste dispositivo</span></div></div><label>Nome da organização<Input value={name} onChange={(event) => setName(event.target.value)} disabled={!canManage}/></label>{canManage && <Button onClick={saveOrganization}><Check size={16}/> Salvar nome</Button>}<div className="organization-list">{memberships.map((item) => <button key={item.organization_id} className={item.organization_id === organizationId ? "active" : ""} onClick={() => switchOrganization(item.organization_id)}><div><strong>{item.organizations?.name || "Organização"}</strong><span>{roleLabels[item.role]}</span></div>{item.organization_id === organizationId && <Badge>Ativa</Badge>}</button>)}</div></div>
      <div className="panel settings-card"><div className="settings-title"><UserRound/><div><h2>Minha conta</h2><span>Acesso autenticado pelo Supabase</span></div></div><div className="account-line"><span>E-mail</span><strong>{user.email || "Não informado"}</strong></div><div className="account-line"><span>Permissão atual</span><Badge variant="secondary">{roleLabels[role]}</Badge></div><Button variant="outline" onClick={() => void supabase.auth.signOut()}><LogOut size={16}/> Sair do sistema</Button></div>
      <div className="panel settings-card invite-card"><div className="settings-title"><KeyRound/><div><h2>Código de acesso</h2><span>Permite que outro usuário entre na equipe</span></div></div>{canManage ? <>{inviteCode ? <div className="invite-code"><strong>{inviteCode}</strong><Button variant="outline" onClick={copyInvite}><Clipboard size={16}/> Copiar</Button></div> : <p className="settings-help">Ainda não existe um código ativo para esta organização.</p>}<Button onClick={generateInvite}>{inviteCode ? <RefreshCw size={16}/> : <KeyRound size={16}/>} {inviteCode ? "Gerar novo código" : "Criar código"}</Button><small>O código expira em 30 dias. Gere outro para revogar o anterior.</small></> : <p className="settings-help">Somente administradores podem criar códigos de acesso.</p>}</div>
      <div className="panel settings-card"><div className="settings-title"><ShieldCheck/><div><h2>Entrar em outra equipe</h2><span>Use o código enviado pelo administrador</span></div></div><label>Código de 8 caracteres<Input value={joinCode} maxLength={8} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="EX.: M4NGUE1R"/></label><Button onClick={joinOrganization}>Validar código</Button></div>
    </div>
    <div className="panel team-panel"><div className="balance-toolbar"><div><h2>Usuários e permissões</h2><span>{members.length} {members.length === 1 ? "usuário" : "usuários"} nesta organização</span></div><Users size={20}/></div><div className="team-list">{members.map((member) => <div className="team-row" key={member.user_id}><div className="member-avatar">{member.user_id === user.id ? "EU" : member.user_id.slice(0,2).toUpperCase()}</div><div><strong>{member.user_id === user.id ? user.email : `Usuário ${member.user_id.slice(0,8)}`}</strong><span>{member.user_id === user.id ? "Sua conta" : `ID ${member.user_id}`}</span></div>{canManage && member.role !== "owner" && member.user_id !== user.id ? <select value={member.role} onChange={(event) => void changeRole(member, event.target.value as Role)}><option value="admin">Administrador</option><option value="operator">Operador</option><option value="viewer">Consulta</option></select> : <Badge variant="secondary">{roleLabels[member.role]}</Badge>}{canManage && member.user_id !== user.id && member.role !== "owner" && <button className="row-delete" onClick={() => void removeMember(member)} aria-label="Remover usuário"><Trash2 size={16}/></button>}</div>)}</div></div>
  </section>;
}

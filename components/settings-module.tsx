"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, Clipboard, KeyRound, Link2, LockKeyhole, LogOut, RefreshCw, ShieldCheck, Trash2, UserCheck, UserRound, Users } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { assignableRoles, can, permissionGroups, roleLabels, rolePresets, type MemberRole, type PermissionKey, type UserAccess } from "@/lib/access";
import { toast } from "sonner";

type Member = {
  user_id: string;
  email: string;
  full_name: string;
  slug: string;
  role: MemberRole;
  permissions: string[];
  active: boolean;
  created_at: string;
};
type Membership = { organization_id: string; role: MemberRole; organizations: { name: string } | null };

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

export function SettingsModule({ user, organizationId, onOrganizationChange }: { user: User; organizationId: string; onOrganizationChange: (id: string) => void }) {
  const [name, setName] = useState("Casa das Mangueiras");
  const [members, setMembers] = useState<Member[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("checker");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRole, setDraftRole] = useState<MemberRole>("checker");
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [draftActive, setDraftActive] = useState(true);

  const currentMember = members.find((member) => member.user_id === user.id);
  const currentAccess: UserAccess | null = currentMember ? { role: currentMember.role, permissions: currentMember.permissions, active: currentMember.active, slug: currentMember.slug } : null;
  const canManageUsers = can(currentAccess, "users.manage");
  const canManageSettings = can(currentAccess, "settings.manage");
  const editingMember = members.find((member) => member.user_id === editingId) || null;

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const [organizationResult, memberResult, membershipsResult, inviteResult] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", organizationId).single(),
      supabase.rpc("list_organization_members", { p_organization_id: organizationId }),
      supabase.from("organization_members").select("organization_id,role,organizations(name)").eq("user_id", user.id).eq("active", true).order("created_at"),
      supabase.from("organization_invites").select("code,role,expires_at").eq("organization_id", organizationId).gt("expires_at", new Date().toISOString()).maybeSingle(),
    ]);
    if (organizationResult.data) setName(organizationResult.data.name);
    if (memberResult.data) setMembers(memberResult.data as Member[]);
    if (membershipsResult.data) setMemberships(membershipsResult.data as unknown as Membership[]);
    if (inviteResult.data) {
      setInviteCode(inviteResult.data.code);
      setInviteRole(inviteResult.data.role as MemberRole);
    }
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
    if (error) return void toast.error("Você não tem autorização para alterar a organização.");
    toast.success("Nome da organização atualizado.");
  }

  async function generateInvite() {
    const code = makeCode();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("organization_invites").upsert({
      organization_id: organizationId,
      code,
      role: inviteRole,
      permissions: rolePresets[inviteRole],
      expires_at: expiresAt,
      created_by: user.id,
    }, { onConflict: "organization_id" });
    if (error) return void toast.error("Não foi possível gerar o acesso.");
    setInviteCode(code);
    toast.success(`Convite de ${roleLabels[inviteRole]} criado por 30 dias.`);
  }

  async function copyText(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    toast.success(message);
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

  function openAccessEditor(member: Member) {
    setEditingId(member.user_id);
    setDraftRole(member.role);
    setDraftPermissions(member.permissions);
    setDraftActive(member.active);
  }

  function applyRole(role: MemberRole) {
    setDraftRole(role);
    setDraftPermissions([...rolePresets[role]]);
  }

  function togglePermission(permission: PermissionKey) {
    setDraftPermissions((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  }

  async function saveMemberAccess() {
    if (!editingMember || editingMember.role === "support") return;
    const { error } = await supabase.from("organization_members").update({
      role: draftRole,
      permissions: draftPermissions,
      active: draftActive,
    }).eq("organization_id", organizationId).eq("user_id", editingMember.user_id);
    if (error) return void toast.error("Não foi possível atualizar as autorizações.");
    setMembers((current) => current.map((member) => member.user_id === editingMember.user_id
      ? { ...member, role: draftRole, permissions: draftPermissions, active: draftActive }
      : member));
    setEditingId(null);
    toast.success("Perfil e autorizações atualizados.");
  }

  async function removeMember(member: Member) {
    if (member.user_id === user.id || member.role === "support" || !confirm("Remover este usuário da equipe?")) return;
    const { error } = await supabase.from("organization_members").delete().eq("organization_id", organizationId).eq("user_id", member.user_id);
    if (error) return void toast.error("Não foi possível remover o usuário.");
    setMembers((current) => current.filter((item) => item.user_id !== member.user_id));
    toast.success("Usuário removido da equipe.");
  }

  function switchOrganization(id: string) {
    localStorage.setItem("central-active-organization", id);
    onOrganizationChange(id);
  }

  const profileUrl = useMemo(() => currentMember && typeof window !== "undefined" ? `${window.location.origin}/u/${currentMember.slug}` : "", [currentMember]);

  return <section className="content settings-module">
    <div className="page-heading">
      <div><span className="eyebrow">ADMINISTRAÇÃO E SEGURANÇA</span><h1>Usuários e acessos</h1><p>Perfis isolados, URL individual e permissões por função.</p></div>
      <Button variant="outline" onClick={() => void loadSettings()} disabled={loading}><RefreshCw size={16}/> Atualizar</Button>
    </div>

    <div className="settings-grid">
      <div className="panel settings-card">
        <div className="settings-title"><Building2/><div><h2>Organização</h2><span>Empresa ativa neste dispositivo</span></div></div>
        <label>Nome da organização<Input value={name} onChange={(event) => setName(event.target.value)} disabled={!canManageSettings}/></label>
        {canManageSettings && <Button onClick={saveOrganization}><Check size={16}/> Salvar nome</Button>}
        <div className="organization-list">{memberships.map((item) => <button key={item.organization_id} className={item.organization_id === organizationId ? "active" : ""} onClick={() => switchOrganization(item.organization_id)}><div><strong>{item.organizations?.name || "Organização"}</strong><span>{roleLabels[item.role]}</span></div>{item.organization_id === organizationId && <Badge>Ativa</Badge>}</button>)}</div>
      </div>

      <div className="panel settings-card">
        <div className="settings-title"><UserRound/><div><h2>Minha conta</h2><span>Perfil autenticado e isolado</span></div></div>
        <div className="account-line"><span>E-mail</span><strong>{user.email || "Não informado"}</strong></div>
        <div className="account-line"><span>Perfil</span><Badge variant="secondary">{currentMember ? roleLabels[currentMember.role] : "Carregando"}</Badge></div>
        {profileUrl && <div className="profile-url"><span>Sua URL individual</span><code>{profileUrl}</code><Button variant="outline" onClick={() => void copyText(profileUrl, "URL individual copiada.")}><Link2 size={16}/> Copiar URL</Button></div>}
        <Button variant="outline" onClick={() => void supabase.auth.signOut()}><LogOut size={16}/> Sair do sistema</Button>
      </div>

      <div className="panel settings-card invite-card">
        <div className="settings-title"><KeyRound/><div><h2>Novo acesso</h2><span>Crie um convite já com a função correta</span></div></div>
        {canManageUsers ? <>
          <label>Função inicial<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as MemberRole)}>{assignableRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>
          {inviteCode ? <div className="invite-code"><strong>{inviteCode}</strong><Button variant="outline" onClick={() => void copyText(inviteCode, "Código copiado.")}><Clipboard size={16}/> Copiar</Button></div> : <p className="settings-help">Escolha a função e gere o código que será usado após o cadastro.</p>}
          <Button onClick={generateInvite}>{inviteCode ? <RefreshCw size={16}/> : <KeyRound size={16}/>} {inviteCode ? "Gerar novo código" : "Criar código"}</Button>
          <small>O convite expira em 30 dias. As permissões poderão ser personalizadas depois.</small>
        </> : <p className="settings-help">Somente usuários autorizados podem gerar acessos.</p>}
      </div>

      <div className="panel settings-card">
        <div className="settings-title"><ShieldCheck/><div><h2>Entrar em outra equipe</h2><span>Use o código enviado pelo administrador</span></div></div>
        <label>Código de 8 caracteres<Input value={joinCode} maxLength={8} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="EX.: M4NGUE1R"/></label>
        <Button onClick={joinOrganization}>Validar código</Button>
      </div>
    </div>

    <div className="panel team-panel">
      <div className="balance-toolbar"><div><h2>Equipe e permissões</h2><span>{members.length} {members.length === 1 ? "usuário" : "usuários"} nesta organização</span></div><Users size={20}/></div>
      <div className="team-list">{members.map((member) => <div className={`team-row ${!member.active ? "member-disabled" : ""}`} key={member.user_id}>
        <div className="member-avatar">{member.user_id === user.id ? "EU" : (member.full_name || member.email).slice(0,2).toUpperCase()}</div>
        <div className="member-identity"><strong>{member.full_name || member.email}</strong><span>{member.email} · /u/{member.slug}</span></div>
        <Badge variant={member.active ? "secondary" : "outline"}>{member.active ? roleLabels[member.role] : "Suspenso"}</Badge>
        {canManageUsers && member.user_id !== user.id && member.role !== "support" && <Button variant="outline" onClick={() => openAccessEditor(member)}><LockKeyhole size={15}/> Autorizações</Button>}
        {canManageUsers && member.user_id !== user.id && member.role !== "support" && <button className="row-delete" onClick={() => void removeMember(member)} aria-label="Remover usuário"><Trash2 size={16}/></button>}
      </div>)}</div>
    </div>

    {editingMember && <div className="panel access-editor">
      <div className="access-editor-head"><div><span className="eyebrow">PERFIL INDIVIDUAL</span><h2>{editingMember.full_name || editingMember.email}</h2><p>Selecione uma função pronta e ajuste qualquer permissão individualmente.</p></div><Badge>{draftActive ? "Acesso ativo" : "Acesso suspenso"}</Badge></div>
      <div className="access-profile-row">
        <label>Função<select value={draftRole} onChange={(event) => applyRole(event.target.value as MemberRole)}>{assignableRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>
        <label className="access-active"><input type="checkbox" checked={draftActive} onChange={(event) => setDraftActive(event.target.checked)}/><span><strong>Usuário ativo</strong><small>Desative para bloquear o acesso sem excluir o histórico.</small></span></label>
      </div>
      <div className="permission-groups">{permissionGroups.map((group) => <fieldset key={group.label}><legend>{group.label}</legend>{group.items.map((permission) => <label key={permission.key}><input type="checkbox" checked={draftPermissions.includes(permission.key)} onChange={() => togglePermission(permission.key)}/><span>{permission.label}</span></label>)}</fieldset>)}</div>
      <div className="access-actions"><Button variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button><Button onClick={() => void saveMemberAccess()}><UserCheck size={16}/> Salvar autorizações</Button></div>
    </div>}
  </section>;
}


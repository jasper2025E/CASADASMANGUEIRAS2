"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Clipboard, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, UserCheck, UserRound, Users } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { assignableRoles, can, permissionGroups, roleLabels, rolePresets, type MemberRole, type PermissionKey, type UserAccess } from "@/lib/access";
import { toast } from "sonner";

type Member = { user_id:string; email:string; full_name:string; cargo:MemberRole; direitos:string[]; ativo:boolean; created_at:string };

export function SettingsModule({ user, organizationId, access, onOrganizationChange }: { user:User; organizationId:string; access:UserAccess|null; onOrganizationChange:(id:string)=>void }) {
  const [name,setName]=useState("Casa das Mangueiras");
  const [members,setMembers]=useState<Member[]>([]);
  const [inviteCode,setInviteCode]=useState("");
  const [inviteRole,setInviteRole]=useState<MemberRole>("RECEBEDOR_CONFERENTE");
  const [joinCode,setJoinCode]=useState("");
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState<Member|null>(null);
  const [draftRole,setDraftRole]=useState<MemberRole>("VENDEDOR");
  const [draftRights,setDraftRights]=useState<string[]>([]);
  const [draftActive,setDraftActive]=useState(true);
  const canManage=can(access,"users.manage");

  const load=useCallback(async()=>{
    setLoading(true);
    if(organizationId){
      const organization=await supabase.from("organizations").select("name").eq("id",organizationId).maybeSingle();
      if(organization.data) setName(organization.data.name);
    } else setName("Aguardando vínculo");
    if(canManage || access?.role==="ADMIN_CD" || access?.role==="SUPER_ADMIN"){
      const result=await supabase.rpc("listar_equipe");
      if(result.error) toast.error("Não foi possível carregar a equipe.");
      else setMembers((result.data||[]) as Member[]);
    } else {
      const result=await supabase.from("usuarios_filial").select("user_id,cargo,direitos,ativo,created_at").eq("user_id",user.id).maybeSingle();
      if(result.data) setMembers([{...result.data,email:user.email||"",full_name:String(user.user_metadata?.full_name||"")} as Member]);
    }
    setLoading(false);
  },[organizationId,user,canManage,access?.role]);

  useEffect(()=>{
    const timer=window.setTimeout(()=>void load(),0);
    return ()=>window.clearTimeout(timer);
  },[load]);

  async function generateInvite(){
    const {data,error}=await supabase.rpc("criar_convite_filial",{p_cargo:inviteRole,p_direitos:rolePresets[inviteRole]});
    if(error || !data) return void toast.error(error?.message||"Não foi possível criar o convite.");
    setInviteCode(String(data)); toast.success(`Convite de ${roleLabels[inviteRole]} criado por 30 dias.`);
  }
  async function acceptInvite(){
    const {data,error}=await supabase.rpc("aceitar_convite_filial",{p_codigo:joinCode.trim().toUpperCase()});
    if(error || !data) return void toast.error(error?.message||"Código inválido ou expirado.");
    toast.success("Acesso vinculado à filial."); onOrganizationChange(String(data));
  }
  function openEditor(member:Member){ setEditing(member);setDraftRole(member.cargo);setDraftRights(member.direitos||[]);setDraftActive(member.ativo); }
  function applyRole(role:MemberRole){ setDraftRole(role);setDraftRights([...rolePresets[role]]); }
  function toggleRight(right:PermissionKey){ setDraftRights(current=>current.includes(right)?current.filter(item=>item!==right):[...current,right]); }
  async function saveAccess(){
    if(!editing) return;
    const {error}=await supabase.rpc("atualizar_usuario_filial",{p_user_id:editing.user_id,p_cargo:draftRole,p_direitos:draftRights,p_ativo:draftActive});
    if(error) return void toast.error(error.message||"Não foi possível atualizar o acesso.");
    setEditing(null);toast.success("Acesso atualizado com segurança.");void load();
  }

  const me=members.find(member=>member.user_id===user.id);
  return <section className="content settings-module">
    <div className="page-heading">
      <div><span className="eyebrow">ADMINISTRAÇÃO E SEGURANÇA</span><h1>Usuários e acessos</h1><p>Um usuário, uma filial e permissões aplicadas também pelo banco.</p></div>
      <Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> Atualizar</Button>
    </div>
    <div className="settings-grid">
      <div className="panel settings-card">
        <div className="settings-title"><Building2/><div><h2>Unidade vinculada</h2><span>O vínculo não pode ser trocado pelo navegador</span></div></div>
        <div className="account-line"><span>Organização</span><strong>{name}</strong></div>
        <div className="account-line"><span>Isolamento</span><Badge>RLS ativo</Badge></div>
      </div>
      <div className="panel settings-card">
        <div className="settings-title"><UserRound/><div><h2>Minha conta</h2><span>Perfil autenticado no Supabase</span></div></div>
        <div className="account-line"><span>E-mail</span><strong>{user.email||"Não informado"}</strong></div>
        <div className="account-line"><span>Cargo</span><Badge variant="secondary">{me?roleLabels[me.cargo]:access?roleLabels[access.role]:"Sem vínculo"}</Badge></div>
      </div>
      <div className="panel settings-card invite-card">
        <div className="settings-title"><KeyRound/><div><h2>Novo acesso</h2><span>Convite ligado somente a esta filial</span></div></div>
        {canManage ? <>
          <label>Cargo inicial<select value={inviteRole} onChange={event=>setInviteRole(event.target.value as MemberRole)}>{assignableRoles.map(role=><option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
          {inviteCode&&<div className="invite-code"><strong>{inviteCode}</strong><Button variant="outline" onClick={async()=>{await navigator.clipboard.writeText(inviteCode);toast.success("Código copiado.");}}><Clipboard size={16}/> Copiar</Button></div>}
          <Button onClick={()=>void generateInvite()}><KeyRound size={16}/>{inviteCode?"Gerar outro código":"Criar convite"}</Button>
          <small>O código expira em 30 dias e só pode ser usado uma vez.</small>
        </>:<p className="settings-help">Somente a gestão autorizada da filial pode criar acessos.</p>}
      </div>
      {!access&&<div className="panel settings-card">
        <div className="settings-title"><ShieldCheck/><div><h2>Vincular minha conta</h2><span>Use o convite recebido do gerente</span></div></div>
        <label>Código de 8 caracteres<Input value={joinCode} maxLength={8} onChange={event=>setJoinCode(event.target.value.toUpperCase())}/></label>
        <Button onClick={()=>void acceptInvite()}>Validar código</Button>
      </div>}
    </div>
    {(canManage||members.length>0)&&<div className="panel team-panel">
      <div className="balance-toolbar"><div><h2>Equipe da unidade</h2><span>{members.length} usuário(s) visível(is)</span></div><Users size={20}/></div>
      <div className="team-list">{members.map(member=><div className={`team-row ${!member.ativo?"member-disabled":""}`} key={member.user_id}>
        <div className="member-avatar">{member.user_id===user.id?"EU":(member.full_name||member.email||"US").slice(0,2).toUpperCase()}</div>
        <div className="member-identity"><strong>{member.full_name||member.email||"Usuário"}</strong><span>{member.email}</span></div>
        <Badge variant={member.ativo?"secondary":"outline"}>{member.ativo?roleLabels[member.cargo]:"Suspenso"}</Badge>
        {canManage&&member.user_id!==user.id&&<Button variant="outline" onClick={()=>openEditor(member)}><LockKeyhole size={15}/> Autorizações</Button>}
      </div>)}</div>
    </div>}
    {editing&&<div className="panel access-editor">
      <div className="access-editor-head"><div><span className="eyebrow">PERFIL DA FILIAL</span><h2>{editing.full_name||editing.email}</h2><p>O backend valida cargo, filial e permissões protegidas.</p></div><Badge>{draftActive?"Ativo":"Suspenso"}</Badge></div>
      <div className="access-profile-row"><label>Cargo<select value={draftRole} onChange={event=>applyRole(event.target.value as MemberRole)}>{assignableRoles.map(role=><option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
        <label className="access-active"><input type="checkbox" checked={draftActive} onChange={event=>setDraftActive(event.target.checked)}/><span><strong>Usuário ativo</strong><small>Desative sem apagar o histórico.</small></span></label></div>
      <div className="permission-groups">{permissionGroups.map(group=><fieldset key={group.label}><legend>{group.label}</legend>{group.items.map(item=><label key={item.key}><input type="checkbox" checked={draftRights.includes(item.key)} onChange={()=>toggleRight(item.key)}/><span>{item.label}</span></label>)}</fieldset>)}</div>
      <div className="access-actions"><Button variant="outline" onClick={()=>setEditing(null)}>Cancelar</Button><Button onClick={()=>void saveAccess()}><UserCheck size={16}/> Salvar autorizações</Button></div>
    </div>}
  </section>;
}

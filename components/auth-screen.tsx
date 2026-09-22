"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export function AuthScreen() {
  const [email, setEmail] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem("cdm-login-email") || ""); const [password, setPassword] = useState(""); const [mode, setMode] = useState<"login"|"signup">("login"); const [loading, setLoading] = useState(false); const [message, setMessage] = useState(""); const [remember, setRemember] = useState(() => typeof window !== "undefined" && !!localStorage.getItem("cdm-login-email"));
  async function submit(e: React.FormEvent) { e.preventDefault(); setLoading(true); setMessage("");
    if (!supabaseConfigured) { setMessage("A conexão com o banco ainda não foi configurada na hospedagem."); setLoading(false); return; }
    const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    if (result.error) setMessage(result.error.message); else { if (remember) localStorage.setItem("cdm-login-email", email); else localStorage.removeItem("cdm-login-email"); if (mode === "signup" && !result.data.session) setMessage("Cadastro criado. Verifique seu e-mail para confirmar o acesso."); }
    setLoading(false);
  }
  async function resetPassword() { if (!email.trim()) return setMessage("Digite seu e-mail para receber a recuperação de senha."); setLoading(true); setMessage(""); const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); setMessage(error ? error.message : "Link de recuperação enviado para seu e-mail."); setLoading(false); }
  return <main className="auth-page"><section className="auth-card auth-card-clone"><div className="auth-brand auth-brand-floating"><div className="auth-logo-orb"><Image className="auth-logo" src="/brand/casa-das-mangueiras-logo.webp" width={104} height={104} priority alt="Casa das Mangueiras Barreirinhas"/></div><strong>CDM</strong><span>Sistema oficial Casa das Mangueiras</span></div><form onSubmit={submit}><label className="auth-field"><span className="auth-field-icon"><Mail size={18}/></span><Input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="E-mail" autoComplete="email"/></label><label className="auth-field"><span className="auth-field-icon"><LockKeyhole size={18}/></span><Input type="password" minLength={6} required value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Senha" autoComplete={mode === "login" ? "current-password" : "new-password"}/></label>{mode === "login" && <div className="auth-options"><label className="auth-remember"><input type="checkbox" checked={remember} onChange={(event)=>setRemember(event.target.checked)}/><span>Salvar meu e-mail</span></label><button type="button" onClick={()=>void resetPassword()} disabled={loading}>Esqueci minha senha</button></div>}{message&&<p className={`auth-message ${message.includes("enviado") || message.includes("criado") ? "success" : ""}`}>{message}</p>}<Button className="w-full auth-submit" disabled={loading}>{loading?<Loader2 className="spin" size={17}/>:null}{mode === "login" ? "ENTRAR" : "CRIAR CONTA"}</Button></form><button className="auth-switch" onClick={()=>{setMode(mode === "login" ? "signup" : "login");setMessage("")}}>{mode === "login" ? "Primeiro acesso? Criar conta" : "Já possui conta? Entrar"}</button><small className="auth-footer">Casa das Mangueiras · Barreirinhas</small></section></main>;
}

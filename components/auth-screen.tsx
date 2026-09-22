"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export function AuthScreen() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [mode, setMode] = useState<"login"|"signup">("login"); const [loading, setLoading] = useState(false); const [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) { e.preventDefault(); setLoading(true); setMessage("");
    if (!supabaseConfigured) { setMessage("A conexão com o banco ainda não foi configurada na hospedagem."); setLoading(false); return; }
    const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    if (result.error) setMessage(result.error.message); else if (mode === "signup" && !result.data.session) setMessage("Cadastro criado. Verifique seu e-mail para confirmar o acesso.");
    setLoading(false);
  }
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><Image className="auth-logo" src="/brand/casa-das-mangueiras-logo.webp" width={170} height={170} priority alt="Casa das Mangueiras Barreirinhas"/><strong>CDM</strong><span>Sistema oficial Casa das Mangueiras</span></div><div className="auth-copy"><span>ACESSO SEGURO</span><h1>{mode === "login" ? "Entrar no sistema" : "Criar acesso administrador"}</h1><p>Pedidos, produtos e balanço sincronizados em todos os dispositivos.</p></div><form onSubmit={submit}><label><Mail size={17}/><Input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="E-mail"/></label><label><LockKeyhole size={17}/><Input type="password" minLength={6} required value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Senha"/></label>{message&&<p className="auth-message">{message}</p>}<Button className="w-full" disabled={loading}>{loading?<Loader2 className="spin" size={17}/>:null}{mode === "login" ? "Entrar" : "Criar minha conta"}</Button></form><button className="auth-switch" onClick={()=>{setMode(mode === "login" ? "signup" : "login");setMessage("")}}>{mode === "login" ? "Primeiro acesso? Criar conta" : "Já possui conta? Entrar"}</button></section></main>;
}

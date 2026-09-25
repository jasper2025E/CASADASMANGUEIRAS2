"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, LockKeyhole, Mail, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase, supabaseConfigured } from "@/lib/supabase";

function translateAuthError(errMessage: string): string {
  const msg = errMessage.toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
    return "E-mail ou senha incorretos. Verifique suas credenciais.";
  }
  if (msg.includes("email not confirmed")) {
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada e spam.";
  }
  if (msg.includes("user already registered")) {
    return "Este e-mail já está cadastrado. Alterne para a opção 'Entrar'.";
  }
  if (msg.includes("password should be at least")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Falha de conexão com a nuvem. Verifique sua internet.";
  }
  return errMessage;
}

export function AuthScreen() {
  const [email, setEmail] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("cdm-login-email") || ""
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [remember, setRemember] = useState(
    () => typeof window !== "undefined" && !!localStorage.getItem("cdm-login-email")
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Por favor, informe seu e-mail.");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (!supabaseConfigured) {
      setErrorMessage("A conexão com o banco ainda não foi configurada na hospedagem.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const result = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (result.error) {
          setErrorMessage(translateAuthError(result.error.message));
        } else {
          if (remember) {
            localStorage.setItem("cdm-login-email", cleanEmail);
          } else {
            localStorage.removeItem("cdm-login-email");
          }
        }
      } else {
        const result = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (result.error) {
          setErrorMessage(translateAuthError(result.error.message));
        } else {
          if (remember) {
            localStorage.setItem("cdm-login-email", cleanEmail);
          }
          if (result.data.session) {
            setSuccessMessage("Conta criada com sucesso! Acessando...");
          } else {
            setSuccessMessage(
              "Cadastro efetuado! Se a confirmação de e-mail estiver ativa, confira sua caixa de entrada."
            );
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado ao autenticar.";
      setErrorMessage(translateAuthError(msg));
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Digite seu e-mail no campo acima para receber as instruções de recuperação.");
      setSuccessMessage("");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const redirectUrl = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        setErrorMessage(translateAuthError(error.message));
      } else {
        setSuccessMessage("Link de redefinição enviado com sucesso! Verifique sua caixa de entrada e spam.");
      }
    } catch {
      setErrorMessage("Não foi possível enviar o link de recuperação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card auth-card-clone">
        {/* Brand Header */}
        <div className="auth-brand auth-brand-floating">
          <div className="auth-logo-orb">
            <Image
              className="auth-logo"
              src="/brand/casa-das-mangueiras-logo.webp"
              width={104}
              height={104}
              priority
              alt="Casa das Mangueiras Barreirinhas"
            />
          </div>
          <strong>CDM</strong>
          <span>Sistema oficial Casa das Mangueiras</span>
        </div>

        {/* Form Container */}
        <form onSubmit={submit}>
          <div className="auth-header-mode">
            <h2>{mode === "login" ? "Login Corporativo" : "Novo Cadastro"}</h2>
            <p>
              {mode === "login"
                ? "Entre com seu e-mail e senha corporativos"
                : "Cadastre seu usuário para ter acesso ao inventário e pedidos"}
            </p>
          </div>

          {/* Email input */}
          <label className="auth-field">
            <span className="auth-field-icon" title="E-mail">
              <Mail size={18} />
            </span>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu-email@casadasmangueiras.com"
              autoComplete="email"
              disabled={loading}
            />
          </label>

          {/* Password input with toggle visibility */}
          <label className="auth-field">
            <span className="auth-field-icon" title="Senha">
              <LockKeyhole size={18} />
            </span>
            <Input
              type={showPassword ? "text" : "password"}
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "login" ? "Sua senha de acesso" : "Crie uma senha (mín. 6 caracteres)"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={loading}
            />
            <button
              type="button"
              className="auth-field-action"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              title={showPassword ? "Ocultar senha" : "Ver senha"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </label>

          {/* Options: Remember & Forgot Password */}
          {mode === "login" && (
            <div className="auth-options">
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  disabled={loading}
                />
                <span>Lembrar meu e-mail</span>
              </label>
              <button
                type="button"
                onClick={() => void resetPassword()}
                disabled={loading}
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          {/* Error & Success Messages */}
          {errorMessage && (
            <div className="auth-alert error">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="auth-alert success">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full auth-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="spin" size={17} />
                <span>PROCESSANDO...</span>
              </>
            ) : (
              <>
                <span>{mode === "login" ? "ENTRAR NO SISTEMA" : "CRIAR MINHA CONTA"}</span>
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </form>

        {/* Switch mode */}
        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setErrorMessage("");
            setSuccessMessage("");
          }}
          disabled={loading}
        >
          {mode === "login"
            ? "Primeiro acesso da equipe? Criar nova conta"
            : "Já possui credenciais cadastradas? Clique para entrar"}
        </button>

        <small className="auth-footer">
          Casa das Mangueiras · Barreirinhas - MA · Gestão & Suprimentos
        </small>
      </section>
    </main>
  );
}

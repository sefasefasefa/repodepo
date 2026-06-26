import { AppLayout } from "@/components/layout/app-layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Phone, Smartphone, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";

const loginSchema = z.object({
  email: z.string().min(1, "Kullanıcı adı veya e-posta zorunludur"),
  password: z.string().min(1, "Şifre zorunludur"),
});

const smsSchema = z.object({
  phone: z.string().min(8, "Geçerli bir telefon numarası girin"),
});

const otpSchema = z.object({
  code: z.string().length(6, "6 haneli kod girin"),
});

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<"password" | "sms">("password");
  const [smsStep, setSmsStep] = useState<"phone" | "code">("phone");
  const [pendingPhone, setPendingPhone] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [smsBusy, setSmsBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Handle Google OAuth redirect token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleToken = params.get("google_token");
    const error = params.get("error");

    if (error) {
      const messages: Record<string, string> = {
        google_not_configured: "Google girişi henüz yapılandırılmamış",
        google_cancelled: "Google girişi iptal edildi",
        google_token_failed: "Google token alınamadı",
        google_error: "Google girişinde hata oluştu",
      };
      toast({ title: "Hata", description: messages[error] || error, variant: "destructive" });
      window.history.replaceState({}, "", "/login");
    }

    if (googleToken) {
      localStorage.setItem("token", googleToken);
      window.location.href = "/";
    }
  }, []);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const smsForm = useForm<z.infer<typeof smsSchema>>({
    resolver: zodResolver(smsSchema),
    defaultValues: { phone: "" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      await login(values);
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Giriş başarısız",
        description: error?.message || "Kullanıcı adı/e-posta veya şifre hatalı.",
        variant: "destructive",
      });
    }
  };

  const onGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const onSendSms = async (values: z.infer<typeof smsSchema>) => {
    setSmsBusy(true);
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: values.phone }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPendingPhone(values.phone);
      setSmsStep("code");
      if (d.dev_otp) setDevOtp(d.dev_otp);
      toast({ title: "Kod gönderildi", description: d.message });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSmsBusy(false);
    }
  };

  const onVerifyOtp = async (values: z.infer<typeof otpSchema>) => {
    setSmsBusy(true);
    try {
      const res = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: pendingPhone, code: values.code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      localStorage.setItem("token", d.token);
      window.location.href = "/";
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    } finally {
      setSmsBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 max-w-md flex flex-col justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-[#141414] border border-[#2a2a2a] p-8 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-violet-500" />

          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
              <LogIn className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Giriş Yap</h1>
            <p className="text-[#666] text-sm mt-1">Hesabınıza erişmek için giriş yapın</p>
          </div>

          {/* Google ile Giriş */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 h-11 border-[#333] bg-[#1e1e1e] text-white hover:bg-[#2a2a2a] flex items-center gap-3"
            onClick={onGoogleLogin}
          >
            <FcGoogle className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium">Google ile Giriş Yap</span>
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#2a2a2a]" />
            <span className="text-[#555] text-xs">veya</span>
            <div className="flex-1 h-px bg-[#2a2a2a]" />
          </div>

          {/* Tab selector */}
          <div className="flex rounded-lg border border-[#2a2a2a] mb-6 overflow-hidden">
            <button
              onClick={() => setTab("password")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === "password" ? "bg-primary text-white" : "text-[#666] hover:text-[#aaa]"}`}
            >
              Şifre ile
            </button>
            <button
              onClick={() => { setTab("sms"); setSmsStep("phone"); setDevOtp(null); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${tab === "sms" ? "bg-primary text-white" : "text-[#666] hover:text-[#aaa]"}`}
            >
              <Smartphone className="h-3.5 w-3.5" /> SMS Kodu
            </button>
          </div>

          {tab === "password" && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#aaa] text-sm">Kullanıcı Adı veya E-posta</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="admin veya ornek@email.com"
                          autoComplete="username"
                          className="bg-[#1e1e1e] border-[#333] text-white placeholder:text-[#555] focus:border-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#aaa] text-sm">Şifre</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            className="bg-[#1e1e1e] border-[#333] text-white placeholder:text-[#555] focus:border-primary pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#aaa] transition-colors"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full mt-2 bg-primary hover:bg-primary/90 text-white font-semibold h-11"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Giriş yapılıyor..." : "Giriş Yap"}
                </Button>
              </form>
            </Form>
          )}

          {tab === "sms" && smsStep === "phone" && (
            <Form {...smsForm}>
              <form onSubmit={smsForm.handleSubmit(onSendSms)} className="space-y-4">
                <FormField
                  control={smsForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#aaa] text-sm">Telefon Numarası</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+905xxxxxxxxx"
                          type="tel"
                          className="bg-[#1e1e1e] border-[#333] text-white placeholder:text-[#555] focus:border-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-11 font-semibold"
                  disabled={smsBusy}
                >
                  {smsBusy ? "Gönderiliyor..." : "Kod Gönder"}
                </Button>
              </form>
            </Form>
          )}

          {tab === "sms" && smsStep === "code" && (
            <Form {...otpForm}>
              <form onSubmit={otpForm.handleSubmit(onVerifyOtp)} className="space-y-4">
                <p className="text-[#888] text-sm">
                  <Phone className="inline h-3.5 w-3.5 mr-1" />
                  {pendingPhone} numarasına gönderilen 6 haneli kodu girin
                </p>
                {devOtp && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-yellow-400 text-sm font-mono">
                    <span className="text-yellow-500/60 text-xs">Geliştirici modu — Kod: </span>
                    {devOtp}
                  </div>
                )}
                <FormField
                  control={otpForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#aaa] text-sm">Doğrulama Kodu</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123456"
                          maxLength={6}
                          className="bg-[#1e1e1e] border-[#333] text-white placeholder:text-[#555] focus:border-primary font-mono text-center text-xl tracking-[0.5em]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-[#333] text-[#aaa]"
                    onClick={() => { setSmsStep("phone"); setDevOtp(null); }}
                    disabled={smsBusy}
                  >
                    Geri
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 font-semibold"
                    disabled={smsBusy}
                  >
                    {smsBusy ? "Doğrulanıyor..." : "Doğrula ve Giriş Yap"}
                  </Button>
                </div>
                <button
                  type="button"
                  className="w-full text-xs text-[#555] hover:text-primary text-center mt-1"
                  onClick={() => smsForm.handleSubmit(onSendSms)(smsForm.getValues() as any)}
                  disabled={smsBusy}
                >
                  Kodu tekrar gönder
                </button>
              </form>
            </Form>
          )}

          <div className="mt-6 text-center text-sm">
            <span className="text-[#555]">Hesabınız yok mu? </span>
            <Link href="/register" className="text-primary hover:underline font-medium">Kayıt Ol</Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

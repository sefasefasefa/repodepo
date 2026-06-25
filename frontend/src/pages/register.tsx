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
import { UserPlus } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

const registerSchema = z.object({
  username: z.string().min(3, "En az 3 karakter"),
  email: z.string().email("Geçerli e-posta girin"),
  password: z.string().min(6, "En az 6 karakter"),
  displayName: z.string().min(2, "En az 2 karakter"),
});

export default function Register() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", displayName: "" },
  });

  const onSubmit = async (values: z.infer<typeof registerSchema>) => {
    try {
      await register(values);
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Kayıt başarısız",
        description: error?.message || "Bir hata oluştu, tekrar deneyin.",
        variant: "destructive",
      });
    }
  };

  const onGoogleRegister = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-md space-y-6 flex flex-col justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-[#141414] border border-[#2a2a2a] p-8 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-violet-500" />

          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Hesap Oluştur</h1>
            <p className="text-[#666] text-sm mt-1">En hızlı büyüyen içerik platformuna katıl</p>
          </div>

          {/* Google ile Kayıt */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 h-11 border-[#333] bg-[#1e1e1e] text-white hover:bg-[#2a2a2a] flex items-center gap-3"
            onClick={onGoogleRegister}
          >
            <FcGoogle className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium">Google ile Kayıt Ol</span>
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-[#2a2a2a]" />
            <span className="text-[#555] text-xs">veya e-posta ile</span>
            <div className="flex-1 h-px bg-[#2a2a2a]" />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#aaa] text-sm">Ad Soyad</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Adınız Soyadınız"
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
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#aaa] text-sm">Kullanıcı Adı</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="benzersiz_kullanici"
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#aaa] text-sm">E-posta</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ornek@email.com"
                        type="email"
                        autoComplete="email"
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
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
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
                className="w-full mt-2 bg-primary hover:bg-primary/90 text-white font-semibold h-11"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Hesap oluşturuluyor..." : "Kayıt Ol"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm">
            <span className="text-[#555]">Zaten hesabınız var mı? </span>
            <Link href="/login" className="text-primary hover:underline font-medium">Giriş Yap</Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

import type { Metadata, Viewport } from "next";
import "@/css/styles.css";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications } from "@/lib/data";
import { SessionProvider, type ClientUser } from "@/components/session";
import { ToastProvider } from "@/components/toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AuthRecoveryGuard from "@/components/AuthRecoveryGuard";

export const metadata: Metadata = {
  title: "J's Pickle Yard — Play • Connect • Compete",
  description: "Premium pickleball courts, easy online booking, and a community that loves the game.",
};

export const viewport: Viewport = {
  themeColor: "#0c0a10",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  const notifications = session ? await getNotifications(session.id) : [];
  const user: ClientUser | null = session
    ? {
        id: session.id,
        email: session.email,
        name: session.profile.name,
        phone: session.profile.phone,
        role: session.profile.role,
        active: session.profile.active,
        createdAt: session.profile.createdAt,
      }
    : null;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SessionProvider user={user}>
          <ToastProvider>
            <AuthRecoveryGuard />
            <Header notifications={notifications} />
            {children}
            <Footer />
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

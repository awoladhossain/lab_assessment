import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import "./styles/bootstrap.min.css";
import "./styles/common.css";
import "./styles/main.css";
import "./styles/responsive.css";
import { AuthProvider } from "./context/AuthContext";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Buddy Script",
  description: "A Next.js Social Media Frontend integrated with Node.js backend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

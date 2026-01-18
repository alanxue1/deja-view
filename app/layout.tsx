import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import CustomCursor from "@/components/effects/CustomCursor";
import SmoothScroll from "@/components/effects/SmoothScroll";
import GlobalHeader from "@/components/layout/GlobalHeader";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Deja View",
  description: "Experience rooms in 3D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasClerk =
    !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

  return (
    <html lang="en" className={`${playfairDisplay.variable} ${inter.variable}`}>
      <body>
        <SmoothScroll>
          <CustomCursor />
          {hasClerk ? (
            <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
              <GlobalHeader />
              {children}
            </ClerkProvider>
          ) : (
            <>
              <GlobalHeader />
              {children}
            </>
          )}
        </SmoothScroll>
      </body>
    </html>
  );
}

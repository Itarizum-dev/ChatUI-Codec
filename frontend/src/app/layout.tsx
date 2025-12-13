import type { Metadata } from "next";
import { Share_Tech_Mono, Orbitron } from "next/font/google";
import "./globals.css";

const shareTechMono = Share_Tech_Mono({
    weight: "400",
    subsets: ["latin"],
    variable: "--font-mono",
});

const orbitron = Orbitron({
    subsets: ["latin"],
    variable: "--font-display",
});

export const metadata: Metadata = {
    title: "CODEC - Tactical Communications Interface",
    description: "Multi-LLM Chat Interface inspired by Metal Gear 2",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ja">
            <body className={`${shareTechMono.variable} ${orbitron.variable}`}>
                <div className="crt-screen">
                    {children}
                </div>
            </body>
        </html>
    );
}

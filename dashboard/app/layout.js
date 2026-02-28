import "./globals.css";

export const metadata = {
  title: "ZeroClaw App Factory",
  description: "Autonomous iOS app generation pipeline dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a]">{children}</body>
    </html>
  );
}

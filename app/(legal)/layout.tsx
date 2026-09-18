import Footer from "@/app/components/Footer";
import Header from "@/app/components/Header";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <Header />
      {children}
      <Footer />
    </div>
  );
}

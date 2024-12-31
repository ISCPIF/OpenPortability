export default function RootLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    console.log("📄 [RootLayout] Rendering layout...");
    // console.log("🔄 [RootLayout] URL:", typeof window !== 'undefined' ? window.location.pathname : 'server-side');
    
    return (
      <html>
        <body>{children}</body>
      </html>
    );
  }
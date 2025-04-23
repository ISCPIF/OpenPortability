export default function RootLayout({
    children,
  }: {
    children: React.ReactNode
  }) {
    // Remove console.log as it can also contribute to hydration issues
    // by executing differently on server vs client
    
    // Don't wrap with HTML or body tags - these are already in the locale layout
    return children;
  }
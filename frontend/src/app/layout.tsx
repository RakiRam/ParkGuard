import { Toaster } from 'react-hot-toast';
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ParkGuard - Smart Vehicle Protection',
  description: 'Protect your vehicle with privacy-first QR contact labels and real-time incident reporting.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500/30">
        {children}
        <Toaster 
          position="top-center" 
          toastOptions={{
            duration: 4000,
            style: {
              background: '#333',
              color: '#fff',
              padding: '16px',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }
          }}
        />
      </body>
    </html>
  );
}

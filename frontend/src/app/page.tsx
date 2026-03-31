import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Shield, QrCode, Bell, Smartphone } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden">
      {/* Navbar Pattern */}
      <nav className="fixed top-0 w-full bg-white/70 backdrop-blur-lg border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">ParkGuard</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Sign In</Link>
            <Link href="/register">
              <Button variant="gradient" size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-medium mb-8 animate-in" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
            <span className="flex h-2 w-2 rounded-full bg-indigo-600"></span>
            Reimagining vehicle safety
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 animate-in" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
            Protect your vehicle with <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">privacy-first</span> QR codes.
          </h1>
          <p className="mt-4 text-xl text-slate-600 max-w-2xl mx-auto mb-10 animate-in" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
            No phone numbers on your dashboard. When someone needs to contact you regarding your vehicle, they scan your ParkGuard QR code to alert you instantly and securely.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 animate-in" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
            <Link href="/register">
              <Button size="lg" variant="gradient" className="w-full sm:w-auto h-14 px-8 text-base">
                Secure Your Vehicle Now
              </Button>
            </Link>
            <Link href="/shop">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 bg-white">
                View Sticker Shop
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="max-w-7xl mx-auto mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: QrCode, title: "Smart QR Labels", desc: "Premium weatherproof stickers linked securely to your ParkGuard account." },
            { icon: Bell, title: "Instant Alerts", desc: "Receive immediate notifications when someone reports an issue with your car." },
            { icon: Smartphone, title: "Privacy First", desc: "Anonymous VoIP calls and messages keep your personal details completely hidden." }
          ].map((feature, i) => (
            <div key={i} className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 hover:-translate-y-1 transition-transform duration-300" style={{ animationDelay: `${500 + i*100}ms`, animationFillMode: 'backwards' }}>
              <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6 text-indigo-600">
                <feature.icon className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

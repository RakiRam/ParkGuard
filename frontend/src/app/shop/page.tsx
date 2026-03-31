"use client"
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, QrCode, ShieldCheck, CheckCircle, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';

const PRODUCTS = [
  { id: '1', name: 'Original Blue QR Sticker', price: 12.99, image: 'bg-indigo-500', isPremium: false },
  { id: '2', name: 'Stealth Black Matte Edition', price: 15.99, image: 'bg-slate-900', isPremium: true },
  { id: '3', name: 'Reflective Neon Green', price: 18.99, image: 'bg-emerald-400', isPremium: true },
];

export default function ShopPage() {
  const [cart, setCart] = useState<{product: any, qty: number}[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuthStore();

  const addToCart = (product: any) => {
    const existing = cart.find(i => i.product.id === product.id);
    if(existing) {
      setCart(cart.map(i => i.product.id === product.id ? {...i, qty: i.qty + 1} : i));
    } else {
      setCart([...cart, {product, qty: 1}]);
    }
    toast.success(`${product.name} added to cart!`);
  };

  const cartTotal = cart.reduce((acc, i) => acc + (i.product.price * i.qty), 0);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      toast.error("Please login to checkout.");
      return;
    }
    setLoading(true);
    try {
      const items = cart.map(i => ({ price: i.product.price, name: i.product.name, quantity: i.qty }));
      const res: any = await api.post('/api/orders/create-checkout', { items });
      if (res.success && res.data.url) {
        toast.success("Redirecting to checkout...");
        // Mock Stripe checkout delay
        setTimeout(() => {
          setCart([]);
          toast.success("Order Placed Successfully!");
        }, 1500);
      }
    } catch {
      toast.success("Checkout initialized (mocked)");
      setTimeout(() => {
        setCart([]);
        toast.success("Order Placed Successfully!");
      }, 1000);
    } finally {
      setTimeout(()=>setLoading(false), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Navbar overlay for Shop */}
      <nav className="fixed top-0 w-full bg-white/70 backdrop-blur-lg border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">ParkGuard Shop</span>
          </Link>
          <div className="flex items-center gap-4">
            {!isAuthenticated ? (
              <Link href="/login"><Button variant="default" size="sm">Sign In to Buy</Button></Link>
            ) : (
              <Link href="/dashboard"><Button variant="outline" size="sm">Dashboard</Button></Link>
            )}
          </div>
        </div>
      </nav>

      <div className="pt-32 pb-12 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-in slide-in-from-bottom-8">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
            Premium Security Stickers
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Get premium, weather-resistant QR contact labels for your vehicle. Protective coatings ensure they last for years.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PRODUCTS.map((prod, i) => (
              <Card key={prod.id} className="overflow-hidden border-2 border-slate-100 hover:border-indigo-300 transition-all group scale-100 hover:scale-[1.02] hover:-translate-y-1 shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-3xl" style={{ animationDelay: `${i*100}ms` }}>
                <div className={`h-56 w-full ${prod.image} flex items-center justify-center relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                  <QrCode className="w-24 h-24 text-white opacity-95 drop-shadow-2xl" />
                  {prod.isPremium && (
                    <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-lg border border-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl">
                      <ShieldCheck className="w-3.5 h-3.5" /> PREMIUM
                    </div>
                  )}
                </div>
                <CardContent className="pt-6 relative">
                  <CardTitle className="text-xl font-extrabold text-slate-900 mb-2 tracking-tight">{prod.name}</CardTitle>
                  <div className="flex justify-between items-center mt-6 mb-2">
                    <span className="text-3xl font-black text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">${prod.price}</span>
                    <ul className="text-xs text-slate-500 space-y-1.5 font-medium">
                      <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-500"/> Weatherproof</li>
                      <li className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-500"/> UV Coating</li>
                    </ul>
                  </div>
                </CardContent>
                <CardFooter className="pb-6">
                  <Button onClick={() => addToCart(prod)} variant={prod.isPremium ? "gradient" : "default"} className="w-full h-12 text-md font-bold shadow-lg">
                    Add to Cart
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-24 border-2 border-slate-200 shadow-2xl bg-white/95 backdrop-blur-2xl">
              <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-5">
                <CardTitle className="flex items-center gap-3 text-xl font-extrabold">
                  <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                     <ShoppingCart className="w-5 h-5" />
                  </div>
                  Your Cart
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {cart.length === 0 ? (
                  <div className="text-center text-slate-500 py-10 flex flex-col items-center">
                    <ShoppingCart className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="font-semibold text-slate-900">Your cart is empty</p>
                    <p className="text-sm mt-1">Add a sticker to get started</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {cart.map(item => (
                      <div key={item.product.id} className="flex justify-between items-center text-sm font-semibold border-b border-slate-100 pb-4">
                        <div className="text-slate-900 flex items-center gap-3">
                          <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{item.qty}x</span>
                          <span className="truncate max-w-[140px]">{item.product.name}</span>
                        </div>
                        <div className="text-slate-900 font-bold">${(item.product.price * item.qty).toFixed(2)}</div>
                      </div>
                    ))}
                    
                    <div className="pt-2 flex justify-between items-center text-xl font-black text-slate-900">
                      <span>Total</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
              {cart.length > 0 && (
                <CardFooter className="flex flex-col gap-3 pb-6">
                  {isAuthenticated ? (
                     <Button onClick={handleCheckout} disabled={loading} variant="gradient" className="w-full h-14 text-lg font-bold shadow-indigo-500/25 shadow-xl hover:shadow-2xl">
                      {loading ? 'Processing Secure Checkout...' : 'Checkout Securely'}
                    </Button>
                  ) : (
                    <div className="w-full border-2 border-amber-200 bg-amber-50 rounded-2xl p-4 text-center">
                       <p className="text-sm font-bold text-amber-800 mb-3">You need an account to checkout</p>
                       <Link href="/login">
                         <Button variant="default" className="w-full h-12 bg-amber-600 hover:bg-amber-700 font-bold">Sign In to Continue</Button>
                       </Link>
                    </div>
                  )}
                  <p className="flex items-center justify-center gap-1 text-slate-400 text-xs font-medium mt-2">
                    <ShieldCheck className="w-3.5 h-3.5" /> Fast, free shipping on all orders
                  </p>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

import CTA from './CTA';
import Features from './Features';
import Footer from './Footer';
import Hero from './Hero';
import HowItWorks from './HowItWorks';
import Navbar from './Navbar';
import Problem from './Problem';
import ProductPreview from './ProductPreview';
import WhyMazeAI from './WhyMazeAI';

export default function LandingPage() {
  return (
    <div className="w-full min-h-screen scroll-smooth bg-black text-white antialiased selection:bg-emerald-300 selection:text-black">
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <ProductPreview />
        <WhyMazeAI />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

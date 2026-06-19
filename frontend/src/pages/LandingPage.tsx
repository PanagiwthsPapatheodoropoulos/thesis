/**
 * @file LandingPage.tsx
 * @description Academic Thesis Presentation & Simulation Hub landing page for the Multi-Agent Resource Allocation platform.
 * Styled with an ultra-premium charcoal grey theme.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, Brain, Users, Activity, TrendingUp, Target, BarChart3,
  Menu, X, ArrowRight
} from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [scrolled, setScrolled] = useState<boolean>(false);

  // Scroll handler for navbar glass effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Clear stale auth on load
  useEffect(() => {
    localStorage.clear();
  }, []);

  const features = [
    {
      icon: Brain,
      title: 'Neural Scheduling',
      description: 'Intelligent scheduling with ML algorithms (LSTM, Random Forest).',
      tag: 'AI Core',
      iconColor: 'bg-indigo-950/40 text-indigo-400 border-indigo-900/30',
      hoverStyle: 'hover:border-indigo-500/30 hover:shadow-[0_0_25px_rgba(99,102,241,0.06)]'
    },
    {
      icon: Users,
      title: 'Resource Allocation',
      description: 'Automated task assignment using genetic algorithms.',
      tag: 'Optimization',
      iconColor: 'bg-blue-950/40 text-blue-400 border-blue-900/30',
      hoverStyle: 'hover:border-blue-500/30 hover:shadow-[0_0_25px_rgba(59,130,246,0.06)]'
    },
    {
      icon: Activity,
      title: 'Anomaly Detection',
      description: 'Deviation detection with Isolation Forest & Autoencoders.',
      tag: 'Security',
      iconColor: 'bg-rose-950/40 text-rose-400 border-rose-900/30',
      hoverStyle: 'hover:border-rose-500/30 hover:shadow-[0_0_25px_rgba(244,63,94,0.06)]'
    },
    {
      icon: TrendingUp,
      title: 'Predictive Analytics',
      description: 'Task duration forecasting with 95%+ accuracy.',
      tag: 'Forecast',
      iconColor: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30',
      hoverStyle: 'hover:border-emerald-500/30 hover:shadow-[0_0_25px_rgba(16,185,129,0.06)]'
    },
    {
      icon: Target,
      title: 'Skill Matching',
      description: 'Fit scoring based on skills and availability.',
      tag: 'HR Tech',
      iconColor: 'bg-pink-950/40 text-pink-400 border-pink-900/30',
      hoverStyle: 'hover:border-pink-500/30 hover:shadow-[0_0_25px_rgba(236,72,153,0.06)]'
    },
    {
      icon: BarChart3,
      title: 'Live Telemetry',
      description: 'Interactive visualizations with Heatmaps & Charts.',
      tag: 'Dashboard',
      iconColor: 'bg-amber-950/40 text-amber-400 border-amber-900/30',
      hoverStyle: 'hover:border-amber-500/30 hover:shadow-[0_0_25px_rgba(245,158,11,0.06)]'
    }
  ];

  const handleSmoothScroll = (e: React.MouseEvent, targetId: string) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#18181b] via-[#111113] to-[#0a0a0b] text-[#d1d1d6] font-sans selection:bg-blue-500/20 overflow-x-hidden relative">
      
      {/* AMBIENT GLOW EFFECTS */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-indigo-500/8 to-transparent rounded-full blur-[100px] pointer-events-none z-0" />
      <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-blue-500/4 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-[30%] left-[5%] w-[450px] h-[450px] bg-purple-500/3 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${scrolled ? 'bg-[#18181b]/95 backdrop-blur-md border-white/[0.06] shadow-lg py-3' : 'bg-transparent border-transparent py-5'}`}>
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] group-hover:bg-blue-500 transition-colors">
                <Zap className="w-4 h-4 fill-white" />
              </div>
              <span className="text-base font-bold text-white tracking-tight">
                TaskScheduler<span className="text-blue-500">.ai</span>
              </span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              {['features', 'about'].map((item) => (
                <a 
                  key={item}
                  href={`#${item}`}
                  onClick={(e) => handleSmoothScroll(e, item)}
                  className="text-xs font-semibold text-[#8e8e93] hover:text-white transition-colors uppercase tracking-wider font-mono"
                >
                  {item}
                </a>
              ))}
              <div className="h-4 w-[1px] bg-white/[0.08]" />
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-xs transition shadow-[0_0_15px_rgba(59,130,246,0.25)] cursor-pointer flex items-center gap-1.5"
              >
                Login <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile Toggle */}
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-[#8e8e93] hover:text-white transition">
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-45 bg-[#18181b]/98 backdrop-blur-lg pt-24 px-6 md:hidden">
          <div className="flex flex-col space-y-6 text-lg font-semibold font-mono">
             {['features', 'about'].map((item) => (
                <a key={item} href={`#${item}`} onClick={(e) => handleSmoothScroll(e, item)} className="text-[#d1d1d6] capitalize tracking-wide">
                   {item}
                </a>
             ))}
             <div className="h-[1px] bg-white/[0.08]" />
             <button onClick={() => navigate('/login')} className="text-left text-blue-500">Login / Sign Up</button>
             <button onClick={() => navigate('/company-setup')} className="text-left text-[#d1d1d6]">Create My Workspace</button>
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <section className="relative z-10 pt-36 pb-20">
        <div className="container mx-auto px-6 max-w-5xl text-center">
          <div className="space-y-6">
            
            {/* Thesis Registry Tag */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#222226]/80 border border-white/[0.06] rounded shadow-inner">
                <span className="w-2 h-2 rounded bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono font-semibold text-[#8e8e93] uppercase tracking-widest">Active Simulation Hub</span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 mt-2 block">
                Optimize Resources <span>Intelligently.</span>
              </span>
            </h1>

            {/* Description */}
            <p className="text-xs md:text-sm text-[#8e8e93] max-w-2xl mx-auto leading-relaxed">
              An intelligent optimization framework employing Machine Learning estimation models and genetic optimization algorithms for real-time task scheduling and system telemetry.
            </p>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <button
                onClick={() => navigate('/company-setup')}
                className="group px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs transition shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] cursor-pointer flex flex-col items-center gap-0.5"
              >
                <span>Create / Join company →</span>
              </button>
              <button
                onClick={(e) => handleSmoothScroll(e, 'features')}
                className="px-6 py-3 bg-[#222226]/60 border border-white/[0.06] text-[#d1d1d6] hover:border-white/[0.15] hover:text-white rounded font-bold text-xs transition cursor-pointer"
              >
                Learn More
              </button>
            </div>

            {/* Thesis Details Card */}
            <div className="relative border border-white/[0.06] bg-[#1e1e22]/90 backdrop-blur-md p-6 rounded max-w-2xl mx-auto mt-12 text-left shadow-2xl">
              {/* Glowing accent border */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
              
              {/* Technical Blueprint Corner Crosshairs */}
              <div className="absolute -top-1.5 -left-1.5 text-white/20 font-mono text-[10px] select-none">+</div>
              <div className="absolute -top-1.5 -right-1.5 text-white/20 font-mono text-[10px] select-none">+</div>
              <div className="absolute -bottom-1.5 -left-1.5 text-white/20 font-mono text-[10px] select-none">+</div>
              <div className="absolute -bottom-1.5 -right-1.5 text-white/20 font-mono text-[10px] select-none">+</div>

              <div className="border-b border-white/[0.05] pb-3 mb-4">
                <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-widest">DIPLOMA THESIS DETAILS</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <div className="text-[9px] text-[#636366] uppercase tracking-wider">Research Candidates</div>
                  <div className="text-[#e5e5ea] mt-0.5 font-sans font-semibold">Iliana Christana & Panagiotis Papatheodoropoulos</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#636366] uppercase tracking-wider">Institution</div>
                  <div className="text-[#e5e5ea] mt-0.5 font-sans font-semibold">Department of Informatics & Telecommunications</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#636366] uppercase tracking-wider">Academic Supervisor Board</div>
                  <div className="text-[#e5e5ea] mt-0.5 font-sans font-semibold">Thesis Evaluation Committee</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#636366] uppercase tracking-wider">Academic Year / Calendar</div>
                  <div className="text-[#e5e5ea] mt-0.5 font-sans font-semibold">Session 2025 - 2026</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLATFORM CAPABILITIES */}
      <section id="features" className="py-24 bg-[#18181b]/50 border-y border-white/[0.06] relative">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 border-b border-white/[0.06] pb-6">
            <div>
              <span className="text-[9px] font-mono text-blue-400 font-bold uppercase tracking-widest">SYSTEM MODULES</span>
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">Platform Capabilities</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className={`group relative p-6 bg-gradient-to-b from-[#222226] to-[#18181c] border border-white/[0.06] rounded hover:bg-gradient-to-b hover:from-[#26262b] hover:to-[#1c1c20] transition-all duration-300 ${feature.hoverStyle}`}
                >
                  {/* Drafting corner decorations */}
                  <div className="absolute -top-1 -left-1 text-white/10 font-mono text-[9px] select-none opacity-0 group-hover:opacity-100 transition-opacity">+</div>
                  <div className="absolute -top-1 -right-1 text-white/10 font-mono text-[9px] select-none opacity-0 group-hover:opacity-100 transition-opacity">+</div>
                  <div className="absolute -bottom-1 -left-1 text-white/10 font-mono text-[9px] select-none opacity-0 group-hover:opacity-100 transition-opacity">+</div>
                  <div className="absolute -bottom-1 -right-1 text-white/10 font-mono text-[9px] select-none opacity-0 group-hover:opacity-100 transition-opacity">+</div>

                  <div className="flex items-start justify-between mb-6">
                    <div className={`p-2.5 rounded border ${feature.iconColor}`}>
                      <Icon size={20} />
                    </div>
                    <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-[#d1d1d6] border border-white/[0.06] px-2 py-0.5 rounded bg-[#141416]">
                      {feature.tag}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-[#8e8e93] text-xs leading-relaxed font-normal">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ABOUT / CTA */}
      <section id="about" className="py-24 bg-[#141416] border-t border-white/[0.04]">
         <div className="container mx-auto px-6 max-w-4xl text-center space-y-6">
            <span className="text-[9px] font-mono text-blue-400 font-bold uppercase tracking-widest">SIMULATION GATEWAY</span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Ready to optimize?</h2>
            <p className="text-[#8e8e93] text-xs md:text-sm max-w-xl mx-auto leading-relaxed">
               The optimization model and decision engine is operational. Deploy a simulation environment with custom team configurations and telemetry tracking options.
            </p>
            <div className="pt-4 flex justify-center">
              <button
                onClick={() => navigate('/company-setup')}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs transition shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.4)] cursor-pointer"
              >
                 Create Workspace
              </button>
            </div>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-white/[0.06] bg-[#141416] relative z-10">
        <div className="container mx-auto px-6 max-w-6xl flex flex-col md:flex-row justify-between items-center gap-6 text-[11px] font-mono">
          
          <div className="md:flex-1 flex justify-center md:justify-start">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white shadow-sm">
                 <Zap size={12} className="fill-white" />
              </div>
              <span className="font-bold text-white tracking-wider">TaskScheduler<span className="text-blue-500">.ai</span></span>
            </div>
          </div>
          
          <div className="md:flex-1 flex justify-center gap-6 text-[#8e8e93]">
             <button onClick={() => navigate('/legal?doc=privacy')} className="hover:text-white transition-colors">Privacy</button>
             <button onClick={() => navigate('/legal?doc=terms')} className="hover:text-white transition-colors">Terms</button>
             <button onClick={() => navigate('/login')} className="hover:text-white transition-colors">Contact</button>
          </div>

          <div className="md:flex-1 flex justify-center md:justify-end text-[#636366] text-center md:text-right font-sans md:whitespace-nowrap">
            © 2026 Thesis Project • Iliana Christana & Panagiotis Papatheodoropoulos
          </div>

        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
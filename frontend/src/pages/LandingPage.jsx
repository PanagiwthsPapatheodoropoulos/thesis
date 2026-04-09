/**
 * @file LandingPage.jsx
 * @description The main public landing page showcasing platform features and offering login/signup routes.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, Brain, Users, Activity, TrendingUp, Target, BarChart3,
  Code, Database, Sparkles, Layers, Shield, Menu, X, ArrowRight, CheckCircle2
} from 'lucide-react';

/**
 * LandingPage Component
 * 
 * Displays heroic sections, feature grids, and technology stack information.
 * Uses smooth scrolling and dynamic navbar styling.
 * 
 * @returns {React.ReactElement} The landing page UI.
 */
const LandingPage = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
      color: 'from-purple-500 to-indigo-600'
    },
    {
      icon: Users,
      title: 'Resource Allocation',
      description: 'Automated task assignment using genetic algorithms.',
      tag: 'Optimization',
      color: 'from-blue-500 to-cyan-600'
    },
    {
      icon: Activity,
      title: 'Anomaly Detection',
      description: 'Deviation detection with Isolation Forest & Autoencoders.',
      tag: 'Security',
      color: 'from-red-500 to-orange-600'
    },
    {
      icon: TrendingUp,
      title: 'Predictive Analytics',
      description: 'Task duration forecasting with 95%+ accuracy.',
      tag: 'Forecast',
      color: 'from-green-500 to-emerald-600'
    },
    {
      icon: Target,
      title: 'Skill Matching',
      description: 'Fit scoring based on skills and availability.',
      tag: 'HR Tech',
      color: 'from-pink-500 to-rose-600'
    },
    {
      icon: BarChart3,
      title: 'Live Telemetry',
      description: 'Interactive visualizations with Heatmaps & Charts.',
      tag: 'Dashboard',
      color: 'from-yellow-500 to-amber-600'
    }
  ];

  const techStack = [
    { name: 'Java Spring Boot', icon: Code, category: 'Backend' },
    { name: 'React', icon: Sparkles, category: 'Frontend' },
    { name: 'Python', icon: Brain, category: 'AI/ML' },
    { name: 'PostgreSQL', icon: Database, category: 'Data' },
    { name: 'Docker', icon: Layers, category: 'Infra' },
    { name: 'JWT Auth', icon: Shield, category: 'Security' }
  ];

  /**
   * Smoothly scrolls the window to a specified element ID.
   * 
   * @function handleSmoothScroll
   * @param {React.MouseEvent} e - The click event.
   * @param {string} targetId - The HTML block ID to scroll to.
   */
  const handleSmoothScroll = (e, targetId) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsMenuOpen(false);
    }
  };

  /**
   * Smoothly scrolls the window back to the top of the page.
   * 
   * @function scrollToTop
   */
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0a0e27] text-slate-300 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      
      {/* BACKGROUND*/}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Main Center Glow*/}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-600/15 blur-[120px] rounded-full"></div>
        
        {/* Secondary accent glow*/}
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-purple-600/10 blur-[100px] rounded-full"></div>
        
        {/* Deep Bottom Glow*/}
        <div className="absolute bottom-0 left-0 w-[800px] h-[600px] bg-blue-600/10 blur-[130px] rounded-full"></div>
      </div>

      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b ${scrolled ? 'bg-[#0a0e27]/90 backdrop-blur-xl border-white/10 py-3' : 'bg-transparent border-transparent py-6'}`}>
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={scrollToTop}>
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-md opacity-30 group-hover:opacity-50 transition-opacity"></div>
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center relative z-10 shadow-inner border border-white/20">
                  <Zap className="w-4 h-4 text-white" fill="currentColor" />
                </div>
              </div>
              <span className="text-lg font-semibold text-white tracking-tight group-hover:text-slate-200 transition-colors">TaskScheduler<span className="text-indigo-400">.ai</span></span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              {['features', 'tech', 'about'].map((item) => (
                <a 
                  key={item}
                  href={`#${item}`}
                  onClick={(e) => handleSmoothScroll(e, item)}
                  className="text-sm font-medium text-slate-400 hover:text-white transition-colors capitalize"
                >
                  {item}
                </a>
              ))}
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium text-sm transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 flex items-center gap-2"
              >
                Login <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Mobile Toggle */}
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-white">
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#0a0e27] pt-24 px-6 md:hidden">
          <div className="flex flex-col space-y-6 text-2xl font-light">
             {['features', 'tech', 'about'].map((item) => (
                <a key={item} href={`#${item}`} onClick={(e) => handleSmoothScroll(e, item)} className="text-white capitalize">
                   {item}
                </a>
             ))}
             <button onClick={() => navigate('/login')} className="text-indigo-400">Login / Sign Up</button>
          </div>
        </div>
      )}

      {/*HERO SECTION*/}
      <section className="relative z-10 pt-40 pb-32 container mx-auto px-6 max-w-5xl text-center">
        <div className="space-y-8">
            {/* Minimal Badge */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 backdrop-blur-md rounded-full border border-indigo-400/30">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
                </span>
                <span className="text-xs font-medium text-indigo-200 uppercase tracking-wide">Thesis Project 2026</span>
              </div>
            </div>

            <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold text-white tracking-tight leading-[1.1] max-w-4xl mx-auto">
              Optimize Resources <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400">
                Intelligently.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-light">
              Maximize your team's performance with Machine Learning algorithms and real-time Predictive Analytics.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-6">
              <button
                onClick={() => navigate('/company-setup')}
                className="px-8 py-4 bg-white text-black rounded-lg font-bold text-sm hover:bg-indigo-50 transition-transform hover:-translate-y-0.5 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Start Simulation
              </button>
              <button
                onClick={(e) => handleSmoothScroll(e, 'features')}
                className="px-8 py-4 bg-transparent border border-white/20 text-white rounded-lg font-bold text-sm hover:bg-white/5 transition-colors"
              >
                Learn More
              </button>
            </div>
            
            {/* Trust/Stats Minimal */}
            <div className="pt-16 border-t border-white/10 flex flex-wrap justify-center gap-12 md:gap-24 opacity-80">
              <div className="text-center">
                <div className="text-3xl font-bold text-white tracking-tighter">98%</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white tracking-tighter">50ms</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Latency</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white tracking-tighter">24/7</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Uptime</div>
              </div>
            </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 bg-[#141b3a]/50 border-y border-white/10">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Platform Capabilities</h2>
            <div className="h-1 w-20 bg-indigo-500"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="group p-6 bg-[#1a2341]/80 backdrop-blur-sm rounded-xl border border-white/10 hover:border-indigo-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-8">
                    <div className={`p-3 bg-gradient-to-br ${feature.color} rounded-lg text-white group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <Icon size={24} />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 border border-white/10 px-2 py-1 rounded">
                      {feature.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                  
                  {/* Hover Glow Effect */}
                  <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity pointer-events-none"></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/*TECH STACK List*/}
      <section id="tech" className="py-24 container mx-auto px-6 max-w-6xl bg-[#0a0e27]">
        <div className="flex flex-col md:flex-row gap-16">
          <div className="md:w-1/3">
             <h2 className="text-3xl font-bold text-white mb-6">Built for scale.</h2>
             <p className="text-slate-400 leading-relaxed">
                Designed with speed and security in mind. We use cutting-edge technologies to ensure the integrity and availability of your data.
             </p>
          </div>
          
          <div className="md:w-2/3 grid grid-cols-2 md:grid-cols-3 gap-y-12 gap-x-8">
             {techStack.map((tech, i) => {
                const Icon = tech.icon;
                return (
                   <div key={i} className="flex flex-col gap-3 group">
                      <div className="flex items-center gap-3">
                         <Icon className="text-indigo-400 group-hover:text-indigo-300 transition-colors" size={20} />
                         <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{tech.category}</span>
                      </div>
                      <div className="text-lg font-medium text-white border-l border-white/10 pl-4 group-hover:border-indigo-500 transition-colors">
                         {tech.name}
                      </div>
                   </div>
                )
             })}
          </div>
        </div>
      </section>

      {/* ABOUT / CTA */}
      <section id="about" className="py-24 bg-[#141b3a]/50 border-t border-white/10">
         <div className="container mx-auto px-6 max-w-4xl text-center">
            <h2 className="text-4xl font-bold text-white mb-6">Ready to optimize?</h2>
            <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">
               The AI Task Scheduler platform is available for testing. Start today and see the difference in your team's performance.
            </p>
            <button
              onClick={() => navigate('/company-setup')}
              className="px-10 py-5 bg-white text-black rounded-lg font-bold hover:bg-indigo-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
               Create Workspace
            </button>
         </div>
      </section>

      {/*FOOTER*/}
      <footer className="py-12 border-t border-white/10 bg-[#0a0e27]">
        <div className="container mx-auto px-6 max-w-6xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-sm flex items-center justify-center">
               <Zap size={14} className="text-white" fill="currentColor" />
            </div>
            <span className="font-bold text-white">TaskScheduler.ai</span>
          </div>
          
          <div className="flex gap-8 text-sm text-slate-500">
             <a href="#" className="hover:text-white transition-colors">Privacy</a>
             <a href="#" className="hover:text-white transition-colors">Terms</a>
             <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>

          <div className="text-xs text-slate-600">
            © 2026 Thesis Project
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
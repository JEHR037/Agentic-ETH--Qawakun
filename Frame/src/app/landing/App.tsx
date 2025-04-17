import React, {useState, useEffect } from 'react';
import { Sun, Shield, Flame, Building2, ChevronDown, Send, Twitter, Github } from 'lucide-react';
import CustomModal from '~/components/CustomModal'; 
import { GoogleAnalytics, sendGAEvent } from '@next/third-parties/google';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState<string>(''); // Especifica el tipo
  const [emails, setEmails] = useState<string[]>([]); // Especifica el tipo

  useEffect(() => {
    sendGAEvent('event', 'pageLoad', { value: 'AppLoaded' });
  }, []);

  const handleOpenModal = () => {
    sendGAEvent('event', 'buttonClicked', { value: 'joinRebuild' });
    setIsModalOpen(true);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email && !emails.includes(email)) {
      setEmails([...emails, email]); 
      setEmail(''); 
      sendGAEvent('event', 'emailSubmitted', { value: email });
      try {
        const response = await fetch('/api/save-emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emails: [...emails, email] }), // Enviar el nuevo correo también
        });

        if (!response.ok) {
          throw new Error('Error saving emails');
        }

        const data = await response.json();
        console.log(data.message);
      } catch (error) {
        console.error('Error:', error);
      }
    }
  };

  return (
    <>
      <GoogleAnalytics gaId="G-HY810NX7GK" />
      <div className="min-h-screen bg-[#222222] text-white">
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1515890435782-59a5bb6ec191?q=80&w=2000')] bg-cover bg-center opacity-20"></div>
          <div className="glitch-overlay absolute inset-0 bg-gradient-to-b from-transparent via-[#222222]/50 to-[#222222]"></div>
          <div className="container mx-auto px-4 text-center relative z-10">
            <h1 className="text-6xl md:text-8xl font-bold mb-6 text-[#FFDD8D] tracking-tight">
              The Lumen Directive
            </h1>
            <p className="text-2xl md:text-3xl mb-8 text-[#A9D9E9]">
              The Collapse has begun. Together, we build to outlast it.
            </p>
            <button 
              className="bg-[#6ECF8C] text-black px-8 py-4 rounded-lg text-xl font-semibold hover:bg-[#FFDD8D] transition-colors duration-300"
              onClick={handleOpenModal}
            >
              Join the Rebuild
            </button>
            <ChevronDown className="w-12 h-12 mx-auto mt-16 animate-bounce text-[#FFDD8D]" />
          </div>
        </section>

        {/* The World Section */}
        <section className="py-24 bg-[#222222]">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-8 text-[#FFDD8D]">
                The year is 2033. Civilization has fractured.
              </h2>
              <p className="text-xl mb-8 text-gray-300">
                Autonomous wars. Rogue AI. Collapsed infrastructure.
                But amid the ruins, Bases have emerged — decentralized communities guided by a protocol for survival, regeneration, and collective evolution.
              </p>
            </div>
          </div>
        </section>

        {/* What Is This Section */}
        <section className="py-24 bg-[#1a1a1a]">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl md:text-5xl font-bold mb-16 text-center text-[#FFDD8D]">
              What Is This?
            </h2>
            <div className="grid md:grid-cols-2 gap-12">
              <div className="bg-[#222222] p-8 rounded-lg border border-[#6ECF8C]/20">
                <h3 className="text-2xl font-bold mb-4 text-[#6ECF8C]">
                  A TTRPG simulating life inside a regenerative Base
                </h3>
                <p className="text-gray-300">
                  Explore the ruins. Rebuild what matters. Survive — and evolve.
                </p>
              </div>
              <div className="bg-[#222222] p-8 rounded-lg border border-[#6ECF8C]/20">
                <h3 className="text-2xl font-bold mb-4 text-[#6ECF8C]">
                  A transmedia world co-created by players and AI agents
                </h3>
                <p className="text-gray-300">
                  Storylines unfold through interactive games, lore drops, and community input.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Factions Section */}
        <section className="py-24 bg-[#222222]">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl md:text-5xl font-bold mb-16 text-center text-[#FFDD8D]">
              Factions of the Fractured World
            </h2>
            <div className="grid md:grid-cols-4 gap-8">
              <div className="group p-6 bg-[#1a1a1a] rounded-lg hover:bg-[#6ECF8C]/10 transition-colors duration-300">
                <Sun className="w-12 h-12 mb-4 text-[#FFDD8D]" />
                <h3 className="text-xl font-bold mb-2">Horizon Spire</h3>
                <p className="text-gray-400">Collaborative AI-aligned reconstruction</p>
              </div>
              <div className="group p-6 bg-[#1a1a1a] rounded-lg hover:bg-[#6ECF8C]/10 transition-colors duration-300">
                <Shield className="w-12 h-12 mb-4 text-[#A9D9E9]" />
                <h3 className="text-xl font-bold mb-2">Sentinel Hold</h3>
                <p className="text-gray-400">Militarized survivalists. Order above all.</p>
              </div>
              <div className="group p-6 bg-[#1a1a1a] rounded-lg hover:bg-[#6ECF8C]/10 transition-colors duration-300">
                <Flame className="w-12 h-12 mb-4 text-[#B14C4C]" />
                <h3 className="text-xl font-bold mb-2">The Vandals</h3>
                <p className="text-gray-400">Extremists. All tech must burn.</p>
              </div>
              <div className="group p-6 bg-[#1a1a1a] rounded-lg hover:bg-[#6ECF8C]/10 transition-colors duration-300">
                <Building2 className="w-12 h-12 mb-4 text-gray-400" />
                <h3 className="text-xl font-bold mb-2">Hyperia Remnants</h3>
                <p className="text-gray-400">The corporate machine that refuses to die.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter Section */}
        <section className="py-24 bg-[#1a1a1a]">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-8 text-[#FFDD8D]">
                Register Your Email
              </h2>
              <form onSubmit={handleSubmit} className="flex gap-4 max-w-md mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-4 py-3 rounded-lg bg-[#222222] border border-[#6ECF8C]/20 focus:outline-none focus:border-[#6ECF8C]"
                />
                <button type="submit" className="bg-[#6ECF8C] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#FFDD8D] transition-colors duration-300">
                  <Send className="w-6 h-6" />
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 bg-[#222222] border-t border-[#6ECF8C]/20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 mb-4 md:mb-0">
                © 2025 The Lumen Directive. All rights reserved.
              </p>
              <div className="flex gap-6">
                <a href="#" className="text-gray-400 hover:text-[#FFDD8D] transition-colors duration-300">
                  <Twitter className="w-6 h-6" />
                </a>
                <a href="#" className="text-gray-400 hover:text-[#FFDD8D] transition-colors duration-300">
                  <Github className="w-6 h-6" />
                </a>
              </div>
            </div>
          </div>
        </footer>

        {/* Modal */}
        <CustomModal isOpen={isModalOpen} onRequestClose={() => setIsModalOpen(false)}>
            <iframe 
              src="https://paragraph.com/@luminous/subscribe" 
              title="Rebuild Modal" 
              className="w-full h-full" 
            />
        </CustomModal>
      </div>
    </>
  );
}

export default App;
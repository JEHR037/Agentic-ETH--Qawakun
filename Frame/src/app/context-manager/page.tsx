"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from "~/components/ui/Button";

type ContextType = 'world' | 'laws' | 'personality' | 'characters' | 'examples';

interface ContextSection {
  type: ContextType;
  title: string;
  placeholder: string;
}

const sections: ContextSection[] = [
  {
    type: 'world',
    title: 'World Description',
    placeholder: 'Describe the world and its context...'
  },
  {
    type: 'laws',
    title: 'Laws of the Worlds',
    placeholder: 'Define the rules and laws that govern this world...'
  },
  {
    type: 'personality',
    title: 'Personality and Behavior',
    placeholder: 'Describe the personality traits and behavior patterns...'
  },
  {
    type: 'characters',
    title: 'Characters and Relations',
    placeholder: 'Define the main characters and their relationships...'
  },
  {
    type: 'examples',
    title: 'Examples of Flow Interactions',
    placeholder: 'Provide examples of typical interactions...'
  }
];

export default function ContextManager() {
  const { data: session } = useSession();
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  
  const [contextParts, setContextParts] = useState<Record<ContextType, string>>({
    world: '',
    laws: '',
    personality: '',
    characters: '',
    examples: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const isAuthenticated = !!session || authenticated;
  const author = session?.user?.fid || wallets?.[0]?.address || "anonymous";

  const handleSubmit = async () => {
    if (!isAuthenticated || author === 'anonymous') {
      setMessage('Please connect your wallet first');
      return;
    }

    try {
      setIsLoading(true);
      setMessage('');

      const contextArray = Object.entries(contextParts).map(([type, content]) => ({
        type,
        content,
        author: author.toString()
      }));

      const response = await fetch('/api/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contextArray),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error updating context');
      }

      setMessage('Context updated successfully!');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error updating context');
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar el contexto actual cuando se monta el componente
  useEffect(() => {
    if (isAuthenticated && author !== 'anonymous') {
      fetch('/api/context')
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            const newContextParts: Record<ContextType, string> = {
              world: '',
              laws: '',
              personality: '',
              characters: '',
              examples: ''
            };

            data.forEach((item: { type: ContextType; content: string }) => {
              if (newContextParts.hasOwnProperty(item.type)) {
                newContextParts[item.type] = item.content;
              }
            });

            setContextParts(newContextParts);
          }
        })
        .catch(err => {
          console.error('Error loading context:', err);
        });
    }
  }, [isAuthenticated, author]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full bg-cover bg-center bg-no-repeat flex flex-col items-center justify-center gap-8"
           style={{ backgroundImage: 'url("/container11.jpg")' }}>
        <div className="text-[#f8c20b] text-2xl font-bold text-center">
          Please sign in to access the context manager
        </div>
        <Button
          onClick={login}
          className="w-64 bg-gradient-to-r from-[#1a1812] to-[#8b7435]
                    hover:from-[#1a1812]/90 hover:to-[#8b7435]/90
                    text-[#f8d54b] font-medium
                    transition-all duration-200
                    border border-[#f8d54b]/20
                    shadow-lg shadow-[#f8d54b]/5"
        >
          Connect
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-no-repeat py-8"
         style={{ backgroundImage: 'url("/container11.jpg")' }}>
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-gradient-to-b from-[#5d490d] to-[#040404] p-8 rounded-3xl 
                      shadow-2xl border border-[#7c7c7c]">
          <h1 className="text-3xl font-bold text-[#f8c20b] mb-8 text-center">
            Context Manager
          </h1>

          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section.type} className="space-y-2">
                <label className="block text-[#f8c20b] text-lg font-medium">
                  {section.title}
                </label>
                <textarea
                  value={contextParts[section.type]}
                  onChange={(e) => setContextParts(prev => ({
                    ...prev,
                    [section.type]: e.target.value
                  }))}
                  placeholder={section.placeholder}
                  className="w-full h-40 bg-[#040404]/80 text-[#f8c20b] border-[#545454]
                           placeholder:text-[#7c7c7c] focus:border-[#f8c20b]
                           rounded-lg px-4 py-3 resize-none"
                />
              </div>
            ))}
          </div>

          {message && (
            <div className={`mt-4 p-4 rounded-lg text-center ${
              message.includes('Error') 
                ? 'bg-red-900/50 text-red-200' 
                : 'bg-green-900/50 text-green-200'
            }`}>
              {message}
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-8 py-3 bg-gradient-to-r from-[#f8c20b] to-[#5d490d]
                       hover:from-[#f8c20b]/90 hover:to-[#5d490d]/90
                       text-[#040404] font-bold rounded-lg
                       transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed
                       relative"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#040404] mr-2"></div>
                  Updating...
                </div>
              ) : (
                'Update Context'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 
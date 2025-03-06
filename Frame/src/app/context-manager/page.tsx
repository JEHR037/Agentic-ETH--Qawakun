"use client";

import { useState, useEffect, useMemo } from "react";
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { Button } from "~/components/ui/Button";

type ContextType = 'world' | 'laws' | 'personality' | 'characters' | 'examples';

interface ContextSection {
  type: ContextType;
  title: string;
  placeholder: string;
}

interface GameOption {
  code: string;
  name: string;
}

interface Interaction {
  options: GameOption[];
}

interface Language {
  code: string;
  name: string;
  interactions: Interaction[];
}

interface GameOptions {
  languages: Language[];
}

interface ContextPart {
  type: string;
  content: string;
  author?: string;
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
  const { authenticated, login, user } = usePrivy();
  const router = useRouter();
  
  const isAdmin = useMemo(() => {
    const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET || '';
    return !!user?.wallet?.address && 
           adminWallet.toLowerCase() === user.wallet.address.toLowerCase();
  }, [user]);
  
  const [contextParts, setContextParts] = useState<Record<ContextType, string>>({
    world: '',
    laws: '',
    personality: '',
    characters: '',
    examples: ''
  });
  const [initialContextParts, setInitialContextParts] = useState<Record<ContextType, string>>({
    world: '',
    laws: '',
    personality: '',
    characters: '',
    examples: ''
  });
  const [gameOptions, setGameOptions] = useState<GameOptions>({
    languages: []
  });
  const [activeLanguageIndex, setActiveLanguageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [isGameOptionsLoading, setIsGameOptionsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [gameOptionsMessage, setGameOptionsMessage] = useState('');
  const [hasContextChanges, setHasContextChanges] = useState(false);

  // Cargar contextos al inicio
  useEffect(() => {
    if (authenticated && isAdmin) {
      fetchContexts();
      fetchGameOptions();
    }
  }, [authenticated, isAdmin]);

  // Detectar cambios en el contexto
  useEffect(() => {
    const hasChanges = JSON.stringify(contextParts) !== JSON.stringify(initialContextParts);
    setHasContextChanges(hasChanges);
  }, [contextParts, initialContextParts]);

  const fetchContexts = async () => {
    try {
      setIsContextLoading(true);
      const response = await fetch('/api/context', {
        headers: {
          'Content-Type': 'application/json',
          'x-user-wallet': user?.wallet?.address || ''
        }
      });

      if (!response.ok) {
        throw new Error('Error cargando contextos');
      }

      const data = await response.json();
      
      // Inicializar un objeto temporal para almacenar los datos
      const tempContexts: Record<ContextType, string> = {
        world: 'UNCONFIGURED',
        laws: 'UNCONFIGURED',
        personality: 'UNCONFIGURED',
        characters: 'UNCONFIGURED',
        examples: 'UNCONFIGURED'
      };
      
      // Llenar el objeto con los datos recibidos
      if (Array.isArray(data)) {
        data.forEach((part: ContextPart) => {
          if (part.type in tempContexts) {
            tempContexts[part.type as ContextType] = part.content;
          }
        });
      }
      
      setContextParts(tempContexts);
      setInitialContextParts({...tempContexts});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error cargando contextos');
    } finally {
      setIsContextLoading(false);
    }
  };

  const fetchGameOptions = async () => {
    try {
      setIsGameOptionsLoading(true);
      const response = await fetch('/api/game-options', {
        headers: {
          'Content-Type': 'application/json',
          'x-user-wallet': user?.wallet?.address || ''
        }
      });

      if (!response.ok) {
        throw new Error('Error cargando opciones de juego');
      }

      const data = await response.json();
      setGameOptions(data);
    } catch (error) {
      setGameOptionsMessage(error instanceof Error ? error.message : 'Error cargando opciones de juego');
    } finally {
      setIsGameOptionsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!authenticated || !isAdmin) {
      setMessage('Por favor conecta con una wallet de administrador');
      return;
    }

    try {
      setIsLoading(true);
      setMessage('');

      const contextArray = Object.entries(contextParts).map(([type, content]) => ({
        type,
        content,
        author: user?.wallet?.address || 'anonymous'
      }));

      const response = await fetch('/api/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-wallet': user?.wallet?.address || ''
        },
        body: JSON.stringify(contextArray),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error actualizando el contexto');
      }

      setMessage('¡Contexto actualizado exitosamente!');
      setInitialContextParts({...contextParts});
      setHasContextChanges(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error actualizando el contexto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGameOptionsSubmit = async () => {
    if (!authenticated || !isAdmin) {
      setGameOptionsMessage('Por favor conecta con una wallet de administrador');
      return;
    }

    try {
      setIsGameOptionsLoading(true);
      setGameOptionsMessage('');

      const response = await fetch('/api/game-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-wallet': user?.wallet?.address || ''
        },
        body: JSON.stringify(gameOptions),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error actualizando opciones de juego');
      }

      setGameOptionsMessage('¡Opciones de juego actualizadas exitosamente!');
    } catch (error) {
      setGameOptionsMessage(error instanceof Error ? error.message : 'Error actualizando opciones de juego');
    } finally {
      setIsGameOptionsLoading(false);
    }
  };

  const handleLanguageChange = (index: number) => {
    setActiveLanguageIndex(index);
  };

  const updateGameOptionName = (langIndex: number, interactionIndex: number, optionIndex: number, newName: string) => {
    const updatedOptions = { ...gameOptions };
    updatedOptions.languages[langIndex].interactions[interactionIndex].options[optionIndex].name = newName;
    setGameOptions(updatedOptions);
  };

  if (!authenticated || !isAdmin) {
    return (
      <div className="min-h-screen w-full bg-cover bg-center bg-no-repeat flex flex-col items-center justify-center gap-8"
           style={{ backgroundImage: 'url("/container11.jpg")' }}>
        <div className="text-[#f8c20b] text-2xl font-bold text-center">
          {!authenticated 
            ? "Por favor conéctate para acceder al administrador de contexto" 
            : "No tienes permisos de administrador para esta página"}
        </div>
        {!authenticated && (
          <Button
            onClick={login}
            className="w-64 bg-gradient-to-r from-[#1a1812] to-[#8b7435]
                      hover:from-[#1a1812]/90 hover:to-[#8b7435]/90
                      text-[#f8d54b] font-medium
                      transition-all duration-200
                      border border-[#f8d54b]/20
                      shadow-lg shadow-[#f8d54b]/5"
          >
            Conectar
          </Button>
        )}
        {authenticated && !isAdmin && (
          <Button
            onClick={() => router.push('/')}
            className="w-64 bg-gradient-to-r from-[#1a1812] to-[#8b7435]
                      hover:from-[#1a1812]/90 hover:to-[#8b7435]/90
                      text-[#f8d54b] font-medium
                      transition-all duration-200
                      border border-[#f8d54b]/20
                      shadow-lg shadow-[#f8d54b]/5"
          >
            Volver al inicio
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-cover bg-center bg-no-repeat py-8"
         style={{ backgroundImage: 'url("/container11.jpg")' }}>
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-gradient-to-b from-[#5d490d] to-[#040404] p-8 rounded-3xl 
                      shadow-2xl border border-[#7c7c7c] mb-8">
          <h1 className="text-3xl font-bold text-[#f8c20b] mb-8 text-center">
            Administrador de Contexto
          </h1>

          {isContextLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f8c20b]"></div>
            </div>
          ) : (
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
          )}

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
              disabled={isLoading || !hasContextChanges}
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
                  Actualizando...
                </div>
              ) : (
                'Actualizar Contexto'
              )}
            </Button>
          </div>
        </div>

        {/* Game Options Section */}
        <div className="bg-gradient-to-b from-[#5d490d] to-[#040404] p-8 rounded-3xl 
                      shadow-2xl border border-[#7c7c7c]">
          <h2 className="text-3xl font-bold text-[#f8c20b] mb-8 text-center">
            Preset Options
          </h2>

          {isGameOptionsLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f8c20b]"></div>
            </div>
          ) : (
            <>
              {/* Language Tabs */}
              <div className="flex mb-6 border-b border-[#7c7c7c]">
                {gameOptions.languages.map((lang, index) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(index)}
                    className={`px-4 py-2 ${
                      activeLanguageIndex === index
                        ? 'bg-[#f8c20b] text-[#040404] font-bold rounded-t-lg'
                        : 'text-[#f8c20b] hover:bg-[#5d490d]/50'
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>

              {/* Game Options Form */}
              {gameOptions.languages.length > 0 && (
                <div className="space-y-8">
                  {gameOptions.languages[activeLanguageIndex].interactions.map((interaction, interIndex) => (
                    <div key={interIndex} className="p-4 border border-[#7c7c7c] rounded-lg">
                      <h3 className="text-[#f8c20b] text-lg font-medium mb-4">
                         Interaction {interIndex + 2}
                      </h3>
                      <div className="space-y-4">
                        {interaction.options.map((option, optIndex) => (
                          <div key={option.code} className="flex items-center">
                            <span className="text-[#f8c20b] font-medium w-32">
                              {option.code}:
                            </span>
                            <input
                              type="text"
                              value={option.name}
                              onChange={(e) => updateGameOptionName(
                                activeLanguageIndex,
                                interIndex,
                                optIndex,
                                e.target.value
                              )}
                              className="flex-1 bg-[#040404]/80 text-[#f8c20b] border border-[#545454]
                                       focus:border-[#f8c20b] rounded-lg px-4 py-2"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {gameOptionsMessage && (
            <div className={`mt-4 p-4 rounded-lg text-center ${
              gameOptionsMessage.includes('Error') 
                ? 'bg-red-900/50 text-red-200' 
                : 'bg-green-900/50 text-green-200'
            }`}>
              {gameOptionsMessage}
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <Button
              onClick={handleGameOptionsSubmit}
              disabled={isGameOptionsLoading}
              className="px-8 py-3 bg-gradient-to-r from-[#f8c20b] to-[#5d490d]
                       hover:from-[#f8c20b]/90 hover:to-[#5d490d]/90
                       text-[#040404] font-bold rounded-lg
                       transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed
                       relative"
            >
              {isGameOptionsLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#040404] mr-2"></div>
                  Actualizando...
                </div>
              ) : (
                'Update Preset Options'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 
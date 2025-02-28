"use client";
import { GameboyInterfaceProps } from '~/types/interfaces';
// ... importar otros componentes necesarios

export function GameboyInterface(props: GameboyInterfaceProps) {
  // Asegúrate de usar props o eliminarlo si no es necesario
  return (
    <div className="relative w-full h-full">
      {props.messageCount}
    </div>
  );
} 
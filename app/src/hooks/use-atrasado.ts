import { useEffect, useState } from 'react';

/** Devolve `valor` só depois que ele ficar `ms` sem mudar (debounce). */
export function useAtrasado<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return atrasado;
}

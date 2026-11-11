/** Ações da cidade: pedem ao servidor e substituem o estado local pelo que ele devolve. */
import { api } from './api';
import { useGame } from './store';

export async function refreshCity() {
  try { useGame.getState().set({ city: await api.city() }); } catch { /* sessão terminada: o App trata */ }
}

/** Executa uma ação. Devolve true se correu bem; mostra o erro do servidor se não. */
export async function act(path: string, body: unknown, success?: string): Promise<boolean> {
  const g = useGame.getState();
  try {
    const r = await api.act(path, body);
    g.set({ city: r.state });
    if (success) g.notify(success);
    return true;
  } catch (e) {
    g.notify((e as Error).message);
    return false;
  }
}

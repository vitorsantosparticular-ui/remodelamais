import { useEffect } from 'react';
import { api } from './api';
import { useGame } from './store';
import { Login } from './ui/Login';
import { Game } from './ui/Game';

export function App() {
  const { me, booting, set } = useGame();
  useEffect(() => {
    api.me().then(m => set({ me: m })).catch(() => set({ me: null })).finally(() => set({ booting: false }));
  }, [set]);
  if (booting) return <div className="login-bg"><p className="loading">A abrir o bairro…</p></div>;
  return me ? <Game /> : <Login />;
}

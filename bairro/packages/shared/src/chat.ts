export const CHAT_MAX_LENGTH = 120;
/** Máximo de mensagens por janela de tempo (anti-spam, aplicado no servidor). */
export const CHAT_RATE = { max: 5, windowMs: 6000 };
/** Dias que as mensagens de quarto ficam guardadas (política de retenção). */
export const CHAT_RETENTION_DAYS = 30;

// Lista curta e propositadamente conservadora; o filtro real é gerido pela moderação (fase 6).
const BLOCKED = ['caralho', 'foda-se', 'fodase', 'puta', 'merda', 'cabrão', 'cabrao', 'paneleiro', 'filho da puta', 'crl', 'fdp', 'pqp'];
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Substitui palavras bloqueadas por "bobba"-style asteriscos. Também tapa números de telefone e emails. */
export function filterChat(text: string): { text: string; flagged: boolean } {
  let out = text.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, CHAT_MAX_LENGTH);
  let flagged = false;
  for (const w of BLOCKED) {
    const re = new RegExp(`(^|[^\\p{L}])(${normalize(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^\\p{L}])`, 'giu');
    const n = normalize(out);
    let m: RegExpExecArray | null;
    const chars = [...out];
    let changed = false;
    while ((m = re.exec(n))) {
      const start = m.index + m[1].length;
      for (let i = start; i < start + m[2].length; i++) chars[i] = '*';
      changed = true;
    }
    if (changed) { out = chars.join(''); flagged = true; }
  }
  // Proteção de menores: não deixar partilhar contactos fora do jogo.
  const contact = /(\+?\d[\d\s.-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)/g;
  if (contact.test(out)) { out = out.replace(contact, '[contacto removido]'); flagged = true; }
  return { text: out, flagged };
}

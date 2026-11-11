// Teste ponta-a-ponta: duas contas criadas pela interface, no mesmo quarto, com movimento e chat.
// Uso: node e2e/dois-jogadores.cjs <pasta-para-capturas>   (requer o servidor a correr e Playwright instalado)
const { chromium } = require('playwright');
const SP = process.argv[2] || '.'; const base = process.env.BASE_URL || 'http://localhost:3001';
const sfx = Math.random().toString(36).slice(2, 6);
(async () => {
  const browser = await chromium.launch();
  const errs = [];
  async function player(name, vp, shirt) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text()); });
    await p.goto(base);
    await p.getByRole('tab', { name: 'Criar conta' }).click();
    if (shirt) await p.getByRole('button', { name: `Cor da camisola ${shirt}` }).click();
    await p.getByRole('button', { name: 'Comprido' }).click().catch(() => {});
    await p.fill('#username', name); await p.fill('#password', 'palavra-passe-1');
    await p.selectOption('#birthYear', '1998'); await p.check('#accept');
    if (name.startsWith('ana')) await p.screenshot({ path: SP + '/e2e-registo.png' });
    await p.getByRole('button', { name: 'Criar conta e entrar' }).click();
    await p.waitForFunction(() => window.__bairro && document.querySelector('.room-name')?.textContent === 'Praça Central', null, { timeout: 15000 });
    return p;
  }
  const A = await player('ana_' + sfx, { width: 1280, height: 800 }, '#d63b3b');
  const B = await player('rui_' + sfx, { width: 390, height: 844 }, '#3fa34d');
  await A.waitForTimeout(800);
  // A clica num mosaico (via coordenadas do mundo → ecrã)
  const pos = await A.evaluate(() => {
    const v = window.__bairro.view; const w = v.world; const s = { x: (10 - 11) * 32, y: (10 + 11) * 16 + 8 };
    const g = w.toGlobal(s); return { x: g.x, y: g.y };
  });
  await A.mouse.click(pos.x, pos.y);
  await A.waitForTimeout(400);
  await A.fill('#chat-input', 'Olá a todos! Alguém para um café? ☕'); await A.press('#chat-input', 'Enter');
  await B.waitForTimeout(400);
  await B.fill('#chat-input', 'Bora! Vou já ter contigo'); await B.press('#chat-input', 'Enter');
  await A.waitForTimeout(4500);
  const seen = await B.evaluate(() => { const v = window.__bairro.view; return [...v.avatars.values()].map(n => ({ u: n.state.username, x: n.state.x, y: n.state.y })); });
  console.log('B vê:', JSON.stringify(seen));
  await A.screenshot({ path: SP + '/e2e-A.png' }); await B.screenshot({ path: SP + '/e2e-B.png' });
  // navegador → café
  await A.getByRole('button', { name: /Navegar/ }).click(); await A.waitForTimeout(500);
  await A.screenshot({ path: SP + '/e2e-nav.png' });
  await A.getByRole('button', { name: /Café Português/ }).click();
  await A.waitForFunction(() => document.querySelector('.room-name')?.textContent === 'Café Português');
  await A.waitForTimeout(600); await A.screenshot({ path: SP + '/e2e-cafe.png' });
  await A.getByRole('button', { name: /Casa/ }).first().click();
  await A.waitForFunction(() => document.querySelector('.room-name')?.textContent.startsWith('Casa de'));
  await A.waitForTimeout(600); await A.screenshot({ path: SP + '/e2e-casa.png' });
  console.log('erros:', errs);
  await browser.close();
})();

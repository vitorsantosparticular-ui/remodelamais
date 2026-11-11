// Teste ponta-a-ponta da cidade: 2 contas, mapa, táxi em tempo real, biscate, praça com chat, banco.
// Uso: node e2e/cidade.cjs <pasta-para-capturas>   (servidor a correr; Playwright instalado)
const { chromium } = require('playwright');
const SP = process.argv[2] || '.'; const base = process.env.BASE_URL || 'http://localhost:3001';
const sfx = Math.random().toString(36).slice(2, 6);
(async () => {
  const browser = await chromium.launch(); const errs = [];
  async function player(name, vp, shirt) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(base);
    await p.getByRole('tab', { name: 'Criar conta' }).click();
    await p.getByRole('button', { name: `Cor da camisola ${shirt}` }).click();
    await p.fill('#username', name); await p.fill('#password', 'palavra-passe-1');
    await p.selectOption('#birthYear', '1998'); await p.check('#accept');
    await p.getByRole('button', { name: 'Criar conta e entrar' }).click();
    await p.waitForSelector('.city-map'); await p.waitForTimeout(600);
    return p;
  }
  const A = await player('ana_' + sfx, { width: 1280, height: 800 }, '#d63b3b');
  const B = await player('rui_' + sfx, { width: 390, height: 844 }, '#3fa34d');
  await A.screenshot({ path: SP + '/c1-mapa.png' });
  // A: abrir Baixa e ir de táxi
  await A.getByRole('button', { name: /^Baixa,/ }).click(); await A.waitForTimeout(300);
  await A.screenshot({ path: SP + '/c2-painel.png' });
  await A.getByRole('button', { name: /Táxi/ }).click();
  await B.getByRole('button', { name: /^Baixa,/ }).click(); await B.getByRole('button', { name: /Táxi/ }).click();
  await A.waitForTimeout(4000); await A.screenshot({ path: SP + '/c3-viagem.png' });
  await A.waitForFunction(() => document.querySelector('.room-name')?.textContent === 'Em Baixa', null, { timeout: 30000 });
  await B.waitForFunction(() => document.querySelector('.room-name')?.textContent === 'Em Baixa', null, { timeout: 30000 });
  await A.waitForTimeout(4500); // presença
  await A.getByRole('button', { name: /^Baixa,/ }).click(); await A.waitForTimeout(500);
  await A.screenshot({ path: SP + '/c4-na-baixa.png' });
  // biscate
  await A.getByRole('button', { name: /Biscates/ }).click(); await A.waitForTimeout(300);
  await A.screenshot({ path: SP + '/c5-biscates.png' });
  await A.getByRole('button', { name: 'Começar' }).click(); await A.waitForTimeout(1500);
  await A.screenshot({ path: SP + '/c6-turno.png' });
  // B entra na praça e fala
  await B.getByRole('button', { name: /^Baixa,/ }).click();
  await B.getByRole('button', { name: /Praça Central/ }).click();
  await B.waitForFunction(() => document.querySelector('.room-name')?.textContent === 'Praça Central');
  await A.getByRole('button', { name: /^Baixa,/ }).click();
  await A.getByRole('button', { name: /Praça Central/ }).click();
  await A.waitForFunction(() => document.querySelector('.room-name')?.textContent === 'Praça Central');
  await B.fill('#chat-input', 'Já arranjaste casa? Eu ainda vivo com os pais 😅'); await B.press('#chat-input', 'Enter');
  await A.waitForTimeout(1200); await A.screenshot({ path: SP + '/c7-praca.png' }); await B.screenshot({ path: SP + '/c7-praca-B.png' });
  // A volta ao mapa (M) e vê o banco
  await A.getByRole('button', { name: /Mapa/ }).click(); await A.waitForSelector('.city-map');
  await A.evaluate(() => {}); 
  await A.getByRole('button', { name: /^Baixa,/ }).click(); await A.getByRole('button', { name: /Banco do Bairro/ }).click();
  await A.waitForTimeout(400); await A.screenshot({ path: SP + '/c8-banco.png' });
  // imobiliária (abre a janela para ver as casas; as ações exigem estar no Chiado)
  await A.keyboard.press('Escape');
  await B.screenshot({ path: SP + '/c9-B.png' });
  console.log('erros:', errs);
  await browser.close();
})();

// Gera a página de demonstração (um jogador, sem servidor) num único ficheiro HTML.
// Uso: npm run build:demo -w @bairro/web   →   apps/web/dist-demo/bairro-demo.html
import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const out = path.resolve('dist-demo');
process.env.VITE_DEMO = '1';
await build({
  mode: 'production',
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1') },
  build: { outDir: out, emptyOutDir: true, assetsInlineLimit: 1e9, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } },
});
const assets = path.join(out, 'assets');
const files = readdirSync(assets);
const js = files.filter(f => f.endsWith('.js')).map(f => readFileSync(path.join(assets, f), 'utf8')).join('\n');
const css = files.filter(f => f.endsWith('.css')).map(f => readFileSync(path.join(assets, f), 'utf8')).join('\n');
const html = `<title>BAIRRO.PT</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Silkscreen&display=swap">
<style>:root{color-scheme:dark}${css}</style>
<div id="root"></div>
<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
writeFileSync(path.join(out, 'bairro-demo.html'), html);
console.log('bairro-demo.html', (html.length / 1024).toFixed(0), 'KB');

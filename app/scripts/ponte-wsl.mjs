/**
 * Ponte para testar no celular pelo cabo quando o adb roda no WINDOWS e a API/Metro no WSL.
 *
 * O WSL (rede NAT) só encaminha o 127.0.0.1 do Windows para servidores que escutam em 0.0.0.0,
 * mas o Metro e a API escutam em "::". Esta ponte escuta em 0.0.0.0 e repassa:
 *   0.0.0.0:18081 → localhost:8081 (Metro)
 *   0.0.0.0:13000 → localhost:3000 (API)
 * No Windows: adb reverse tcp:8081 tcp:18081 && adb reverse tcp:3000 tcp:13000
 * (o script `npm run celular` faz tudo isso).
 */
import net from 'node:net';

const PARES = [
  [18081, 8081],
  [13000, 3000],
];

for (const [origem, destino] of PARES) {
  net
    .createServer((cliente) => {
      const alvo = net.connect(destino, 'localhost');
      const fechar = () => {
        cliente.destroy();
        alvo.destroy();
      };
      cliente.on('error', fechar);
      alvo.on('error', fechar);
      cliente.pipe(alvo).pipe(cliente);
    })
    .listen(origem, '0.0.0.0', () => console.log(`ponte 0.0.0.0:${origem} → localhost:${destino}`));
}

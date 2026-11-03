// esbuild 打包脚本：与 dsh-tang-governance 保持一致的三入口结构
//   - src/index.ts        -> lib/index.js       （Cordis 服务：preset installer）
//   - src/tool.ts         -> lib/tool.js        （Cordis 服务：tools + patrol）
//   - src/client/index.tsx-> lib/client.js      （Web 客户端半）
// 类型声明：由 tsc --emitDeclarationOnly 生成到 lib/types/**
import { build } from 'esbuild';
import { rmSync } from 'node:fs';

rmSync('lib', { recursive: true, force: true });

const shared = {
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  target: 'es2022',
  sourcemap: true,
  external: [
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-tools',
    '@deepseek-ai/dsh-settings',
    '@deepseek-ai/dsh-agent',
    '@deepseek-ai/dsh-agent-presets',
    '@deepseek-ai/dsh-subagent',
    '@deepseek-ai/dsh-session',
    '@deepseek-ai/dsh-system-prompt',
    '@deepseek-ai/dsh-user-questions',
    '@deepseek-ai/dsh-llm',
    '@deepseek-ai/schemastery',
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-settings',
    'react',
    'react-dom',
    'node:crypto',
    'node:fs',
    'node:fs/promises',
    'node:path',
  ],
};

await Promise.all([
  build({ ...shared, entryPoints: ['src/index.ts'], outfile: 'lib/index.js' }),
  build({ ...shared, entryPoints: ['src/tool.ts'], outfile: 'lib/tool.js' }),
  build({ ...shared, entryPoints: ['src/client/index.tsx'], outfile: 'lib/client.js', jsx: 'automatic' }),
]);

console.log('build ok');

import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/main.ts',
  output: {
    dir: '../../dist/apps/api-server',
    format: 'cjs',
    sourcemap: true,
    entryFileNames: '[name].js',
  },
  // External: all dependencies (npm packages, @optimex-pmm libs, node built-ins)
  external: [/^@/, /^[a-z]/, /node:/],
  tsconfig: '../../tsconfig.json',
})

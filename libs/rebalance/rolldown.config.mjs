import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    dir: '../../dist/libs/rebalance',
    format: 'cjs',
    sourcemap: true,
    entryFileNames: '[name].js',
  },
  external: [/^@/, /^[a-z]/],
  tsconfig: '../../tsconfig.json',
})

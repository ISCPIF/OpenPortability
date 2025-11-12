import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/lib/__tests__/setup.ts'],
    // Désactiver le parallélisme pour éviter les conflits de transactions
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/lib/__tests__/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/lib/supabase': path.resolve(__dirname, './src/lib/__tests__/mocks/supabase.ts'),
      'next/server': path.resolve(__dirname, './src/lib/__tests__/mocks/next-server.ts'),
      '@/app/auth': path.resolve(__dirname, './src/lib/__tests__/mocks/auth.ts'),
    },
  },
})

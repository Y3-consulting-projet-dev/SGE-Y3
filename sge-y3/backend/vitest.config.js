// vitest.config.js
import { defineConfig } from 'vitest/config';
 
export default defineConfig({
  test: {
    environment: 'node',        // pas de DOM : on teste du back-end
    globals: true,              // describe, it, expect disponibles sans import
    setupFiles: ['./tests/setup.js'],  // exécuté avant chaque fichier de test
    testTimeout: 20000,         // MongoDB en mémoire peut être lent au démarrage
    hookTimeout: 30000,
  },
});

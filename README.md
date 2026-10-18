# RUTECH

Planificador y optimizador de rutas para el equipo técnico de SAVA servicios deportivos.

- Se publica sola en GitHub Pages cada vez que se sube un cambio a `main` (ver `.github/workflows/deploy.yml`).
- Los datos compartidos (técnicos y servicios) y los inicios de sesión van en Firebase. La configuración del proyecto se pega en `src/firebaseConfig.ts`; las reglas de acceso están en `firestore.rules`.
- Sin Firebase configurado, la app funciona guardando los datos solo en el dispositivo.

## Desarrollo

```
bun install
bunx vite --port=3000
```

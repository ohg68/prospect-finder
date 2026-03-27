# Prospect Finder

Prospect Finder es una plataforma B2B avanzada para la segmentación, búsqueda y enriquecimiento de prospectos utilizando Inteligencia Artificial.

## 🚀 Inicio Rápido

### Requisitos Previos
- [Node.js](https://nodejs.org/) (v20 o superior recomendado)
- [pnpm](https://pnpm.io/) (v9 o superior)
- [PostgreSQL](https://www.postgresql.org/)

### Instalación
1. Clona el repositorio.
2. Instala las dependencias desde la raíz:
   ```bash
   pnpm install
   ```
3. Configura las variables de entorno:
   ```bash
   cp .env.example .env
   # Edita el archivo .env con tus credenciales (OpenAI, DB)
   ```

### Configuración de la Base de Datos
Sincroniza el esquema con tu base de Datos:
```bash
pnpm --filter @workspace/db run push
```

## 🛠️ Desarrollo

Para iniciar tanto el frontend como el backend simultáneamente:
```bash
pnpm dev
```
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000/api](http://localhost:5000/api)

## 📁 Estructura del Proyecto

- `artifacts/prospect-finder`: Aplicación frontend (React + Vite).
- `artifacts/api-server`: Servidor de API (Express).
- `lib/db`: Capa de datos con Drizzle ORM.
- `lib/api-spec`: Definición OpenAPI y cliente generado.
- `lib/integrations-*`: Librerías de integración (OpenAI, etc).

## 📄 Licencia
MIT
Self-healing deployment

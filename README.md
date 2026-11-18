# EduMaster.ai · Frontend

SPA en React 19 + TypeScript + Vite + Tailwind 4. Consume la API de `edumaster-backend` y se actualiza en vivo por
Server-Sent Events.

```bash
npm install
npm run dev        # http://localhost:5173 con proxy /api -> http://127.0.0.1:8000
npm run build      # genera dist/
```

En producción, la imagen Docker (Caddy) sirve `dist/` y envía `/api` al contenedor `api`. Si `SITE_ADDRESS` es un
dominio, activa HTTPS automático. El despliegue completo está en el README del backend.

| Carpeta | Contenido |
|---|---|
| `src/lib` | cliente HTTP, sesión, tiempo real (SSE con reconexión), tipos |
| `src/components` | AppShell por rol, `NeuralNetworkCanvas`, gráficos, heatmap, mapa, monitor de recursos |
| `src/pages` | Resumen, Rutas, Cursos, Análisis, IA · Red neuronal, Recomendaciones, Certificados, Estudiantes, Usuarios, Auditoría, Verificación pública |

El visualizador neuronal dibuja la topología real del modelo publicado (`/ml/models/active/architecture`). Solo anima
pulsos con eventos reales de entrenamiento o con una inferencia solicitada, respeta `prefers-reduced-motion` y se
puede pausar.

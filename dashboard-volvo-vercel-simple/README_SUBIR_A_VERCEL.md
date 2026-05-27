COMO SUBIR ESTE DASHBOARD A VERCEL

1. Sube TODOS los archivos de esta carpeta a GitHub.
   Importante: index.html debe verse directamente en la primera pantalla del repositorio.

2. En Vercel, crea un proyecto nuevo desde ese repositorio de GitHub.

3. Si Vercel pregunta por configuracion:
   - Framework Preset: Other
   - Build Command: dejar vacio
   - Output Directory: dejar vacio

4. Pulsa Deploy.

Si aparece 404, normalmente significa que Vercel no esta viendo index.html en la primera capa del repositorio.

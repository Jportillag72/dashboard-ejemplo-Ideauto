# Dashboard ejecutivo · Camiones pesados España

Dashboard HTML, CSS y JavaScript para analizar matriculaciones de camiones pesados nuevos en España durante enero-abril de 2026, con foco en Volvo Trucks y comparativa frente al mismo periodo de 2025.

## Estructura

- `data/matriculaciones_camiones_pesados.xlsx`: fichero Excel fuente.
- `scripts/process-data.js`: procesa el Excel con `xlsx` y genera los datos agregados.
- `data/dashboard_data.json`: salida principal para el dashboard.
- `data/dashboard_data.js`: copia embebible para poder abrir `index.html` directamente.
- `index.html`, `styles.css`, `app.js`: dashboard responsive con Chart.js.

## Instalación

```bash
npm install
```

## Procesar datos

```bash
npm run process
```

El comando genera:

- `data/dashboard_data.json`
- `data/dashboard_data.js`

## Abrir el dashboard

Con servidor local:

```bash
npm run serve
```

Despues abre la URL indicada en consola, por defecto:

```text
http://127.0.0.1:8080
```

Tambien puedes abrir `index.html` directamente en el navegador despues de ejecutar `npm run process`; para ese caso el dashboard usa `data/dashboard_data.js`.

## Build para Vercel

```bash
npm run build
```

El build genera una carpeta `dist/` lista para publicar en Vercel. Incluye el HTML, CSS, JavaScript, datos procesados, logo y una copia local de Chart.js.

Para revisar el build localmente:

```bash
npm run serve:dist
```

## Deploy en Vercel

Al importar el repositorio en Vercel, usa estos ajustes:

- Framework Preset: `Other`.
- Root Directory: la carpeta del repositorio donde estan `package.json` e `index.html`.
- Install Command: vacio.
- Build Command: vacio.
- Output Directory: `public`.

El repositorio incluye `vercel.json`, que fuerza este despliegue como sitio estatico puro y sirve `public/index.html`.

Si ves `404: NOT_FOUND`, normalmente Vercel esta apuntando a una carpeta equivocada o no esta encontrando `public/index.html`. Revisa especialmente `Root Directory`: debe ser la carpeta donde estan `vercel.json`, `package.json` y la carpeta `public/`.

## Exportar a GitHub

Archivos que deben subirse:

- Codigo fuente: `index.html`, `styles.css`, `app.js`, `scripts/`.
- Datos necesarios: `data/matriculaciones_camiones_pesados.xlsx`, `data/dashboard_data.json` y `data/dashboard_data.js`.
- Assets: `assets/volvo-logo.avif`.
- Vendor frontend: `vendor/chart.umd.js`.
- Publicacion estatica Vercel: `public/`.
- Configuracion: `package.json`, `package-lock.json`, `.gitignore`, `.gitattributes` y `.nojekyll`.
- Vercel: `vercel.json`.

No subas `node_modules/` ni `artifacts/`; ya estan excluidos por `.gitignore`.

Para publicar con GitHub Pages:

1. Sube el repositorio a GitHub.
2. En GitHub, abre `Settings > Pages`.
3. Selecciona `Deploy from a branch`.
4. Usa la rama `main` y la carpeta `/root`.
5. Guarda los cambios y espera a que GitHub genere la URL publica.

Antes de subirlo a un repositorio publico, revisa que el Excel y los JSON generados puedan compartirse fuera de tu organizacion.

### Subida con Git desde terminal

```bash
git init -b main
git add .
git commit -m "Initial Volvo Trucks dashboard"
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

Si prefieres subirlo desde la web de GitHub, usa el paquete `exports/dashboard-volvo-github-ready.zip`.

## Alcance metodológico

- Periodo principal: enero, febrero, marzo y abril de 2026.
- Comparativa interanual: enero-abril de 2025.
- Mercados incluidos: Camión Rígido y Tractocamión.
- Marca foco: `VOLVO`.
- Las unidades se validan como numéricas antes del cálculo.
- Los nombres de Mercado, CCAA y Marca se normalizan para reducir diferencias de espacios, mayúsculas, acentos y variantes comunes.

## Funcionalidades

- KPIs ejecutivos de mercado, Volvo Trucks, cuota, ranking y variaciones.
- Gráficos Chart.js: ranking de marcas, cuota por marca, evolución mensual, cuota Volvo por CCAA y comparativa competitiva.
- Tablas analíticas: ranking de marcas, ranking CCAA, Volvo por CCAA, competidores y marca x CCAA.
- Filtros por mercado, comunidad autónoma y marca.
- Exportación CSV de tablas.
- Impresión o guardado como PDF con estilos específicos.

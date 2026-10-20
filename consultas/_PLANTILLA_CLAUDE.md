# <Tema de la consulta> — columna vertebral de ESTA consulta

> Es la columna vertebral **local**: Claude la lee al entrar a esta carpeta y con eso ya sabe qué se
> preguntó, de qué se alimenta y cómo reproducirlo, sin cargar el motor entero.

## 0. Herencia — el motor manda

Esta consulta **cuelga** del motor <nombre del motor>, no lo reemplaza.

- Columna vertebral del motor: [`../../CLAUDE.md`](../../CLAUDE.md) — convenciones, trampas y
  cadena de cálculo. **Sus reglas rigen acá sin excepción** (llave territorial, privacidad,
  `python -X utf8`).
<ficha de dominio>
- **Esta carpeta es de escritura; el resto del motor es de SOLO LECTURA desde acá.** No se corren sus
  builds, no se tocan sus salidas, no se despliega. Si algo de lo que se descubre acá debe subir al
  motor, se propone explícitamente y se hace allá.
- Lo que sí puede subir al motor: una **trampa del dato** o un **indicador reutilizable**. Lo que NO
  sube: supuestos, recortes y umbrales propios de esta consulta (§3).

## 1. Qué se preguntó

> «<pega acá el pedido textual de Rodrigo>»

**Fecha:** <AAAA-MM-DD> · **Territorio:** <comuna/región/país> · **Estado:** <abierta | cerrada>

> Si la consulta contrasta una fuente externa —un estudio, una nota de prensa, un informe de otro
> organismo—, archiva su referencia y sus afirmaciones en un `FUENTE.md`, sin reproducir material con
> derechos.

## 2. De qué se alimenta (sólo lectura)

| Archivo | Qué aporta | Llave |
|---|---|---|
| `../../<ruta>` | <qué> | <cut / manzent / zona / línea / ROL> |

## 3. Definiciones propias de esta consulta

Los recortes que valen **acá y no en el motor**; declararlos evita que se filtren aguas arriba:

- **Universo:** <a quién se cuenta y a quién no>
- **Filtros / umbrales:** <valor y por qué>
- **Punto ciego declarado:** <qué NO ve la fuente>

## 4. Cómo se reproduce

```bash
python -X utf8 <script>.py    # desde esta carpeta
```

Salidas: `datos/<...>` · `figuras/<...>` · `<informe>`

## 5. Cifras de control

Si al re-ejecutar no salen estas cifras, algo cambió —el dato o el código—: **investigar antes de
publicar**.

| Cifra | Valor | Medido el |
|---|---|---|
| <total> | <n> | <AAAA-MM-DD> |

## 6. Trampas encontradas acá

- <trampa · cómo se detectó · cómo se sortea>

## 7. Pendientes

- [ ] <lo que quedó abierto>

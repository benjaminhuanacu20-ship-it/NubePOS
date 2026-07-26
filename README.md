# NubePOS · Dashboard del Cliente Final

Kiosco / menú digital: chatbot + catálogo + carrito + pago con QR Simple,
con notificación a Telegram vía función serverless.

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `cliente.html` | Estructura semántica: chat, catálogo, carrito/ticket, modal de pago |
| `styles-cliente.css` | Estilos mobile-first, sin frameworks |
| `app-cliente.js` | Firebase SDK v9+ (módulos ES), `CatalogService`, `CartManager`, `ChatEngine`, `PaymentService`, `UIController` |
| `api/notify-telegram.js` | Serverless (Netlify/Vercel) que envía el pedido a Telegram sin exponer credenciales |

## 1. Firestore: colecciones esperadas

**`productos`**
```
{
  negocioId: "default",
  nombre: "Salteña de pollo",
  descripcion: "Masa horneada, jugo de pollo, aceituna y huevo.",
  precioBOB: 12,
  precioUSD: 1.7,
  imagenUrl: "https://.../salteña.jpg",
  categoria: "Salados",
  disponible: true,
  destacado: true
}
```

**`configuracion/{negocioId}`**
```
{
  qrImageUrl: "https://.../qr-simple-negocio.png",
  tasaImpuesto: 0        // ej. 0.13 para 13%
}
```

**`pedidos`** (creado automáticamente por `PaymentService`)
```
{
  negocioId, items: [{ productoId, nombre, precioUnitarioBOB, cantidad }],
  subtotal, impuesto, total,
  estado: "pendiente" | "pagado" | "en_cocina",
  cliente, creadoEn, actualizadoEn
}
```

> Protegé estas colecciones con Firestore Security Rules: lectura pública
> de `productos`/`configuracion`, pero escritura de `pedidos` solo con
> validación de esquema, y actualización de `estado` restringida al panel
> del comerciante o a Cloud Functions.

## 2. Variables de entorno de la función serverless

Configurar una sola vez en el panel del proveedor (nunca en el código):

```
TELEGRAM_BOT_TOKEN=  # token de @BotFather
TELEGRAM_CHAT_ID=    # chat, grupo o canal donde llegan los pedidos
ALLOWED_ORIGIN=      # opcional, ej. https://menu.mi-negocio.com
```

## 3. Configuración del frontend

En `app-cliente.js`, completar `firebaseConfig` con los datos del proyecto
Firebase (son públicos por diseño; la seguridad va en las Security Rules).

El negocio activo se toma de `?negocio=` en la URL (`?negocio=mi-local`);
si no se especifica, usa `"default"`.

## 4. Despliegue rápido (Netlify)

```
netlify/
  functions/
    notify-telegram.js   <- copiar api/notify-telegram.js aquí
cliente.html
styles-cliente.css
app-cliente.js
```

El frontend llama a `/api/notify-telegram`; en Netlify esa ruta se resuelve
automáticamente si usás redirects (`/api/* -> /.netlify/functions/:splat`)
o si copiás la función tal cual a `netlify/functions/`.

## 5. Resiliencia incluida

- Banner de "sin conexión" reactivo a `online`/`offline`.
- Si Firestore falla al sincronizar el catálogo, se muestra estado vacío
  en vez de romper la página.
- Si falla la notificación a Telegram, el pedido ya quedó guardado en
  Firestore como `pendiente`; el botón permite reintentar sin duplicar
  el pedido.
- La función serverless valida el payload, aplica timeout a la llamada a
  Telegram y nunca expone el token en las respuestas de error.

# WORKFLOW — Modificadores

Prefijo: MODIFIERS
Alcance MVP: restaurante

> Contrato de comportamiento del módulo (pm#620, pm#621). Se lee antes de tocar el código y se
> actualiza en la misma PR que cambie un comportamiento. El detalle técnico vive en
> `architecture/modules/modifiers.md`; aquí se escribe lo que ve y hace la persona.

## Para qué sirve y para quién

Modificadores es el catálogo de las elecciones que acompañan a un plato o a un servicio: el «punto de
la carne», el «extra de queso», el tamaño, «sin cebolla». Cada **grupo** dice cuántas opciones hay
que elegir (mínimo y máximo) y cada **opción** lleva su suplemento de precio (más, menos o gratis).
Los grupos se enganchan a productos, servicios o categorías, y es **Venta** quien los pregunta en el
TPV, los cobra y los manda a cocina: este módulo solo guarda el catálogo y es la única fuente del
precio del suplemento. Lo configura el **responsable** o el **administrador**; el **empleado** puede
consultar los grupos. Quien lo vive todos los días es el **cajero** o la camarera en el TPV. No es
una variante de producto (no lleva stock ni coste: una opción no descuenta existencias) ni un menú a
precio cerrado (eso es Combos).

## Referencia adoptada

Contrastada en `.claude/agents/qa-hub-restaurant.md` §2 (10/08/2026) y en el barrido de mercado de
`architecture/modules/modifiers.md` (20/08/2026); se adopta esto, no más:

- [Square — modificadores](https://squareup.com/help/us/en/article/5119-create-and-manage-item-modifiers):
  el grupo es un objeto propio, reutilizable, con obligatorio, mínimo y máximo.
- [Toast — grupos de modificadores](https://support.toasttab.com/en/article/Creating-Modifier-Groups-and-Modifiers-1492803987509):
  nombre de cocina distinto del comercial; el suplemento puede ser recargo o descuento.
- [Clover — grupos](https://docs.clover.com/dev/docs/managing-modifier-groups-modifiers): no hay casilla
  «obligatorio»; obligatorio es «mínimo 1 o más».
- [Lightspeed — modificadores](https://resto-support.lightspeedhq.com/hc/en-us/articles/226404648-Creating-modifiers):
  el grupo se cuelga de un artículo o de una categoría; un modificador no es una variante.
- [LS Central — infocodes](https://help.lscentral.lsretail.com/Content/LS-Retail/Infocodes/Infocodes.htm):
  el suplemento con otro tipo de IVA es su propia línea de venta.

## Antes de empezar

- Modificadores no depende de ningún módulo (`depends_on` vacío). Sin Venta nadie pregunta los grupos
  en el TPV; sin Cocina la comanda no los lleva.
- Para enganchar un grupo hace falta el **identificador** del producto, del servicio o de la categoría:
  lo conoce Inventario o Servicios (referencia opaca, sin enlace fuerte).
- Los importes de las opciones van en la **unidad menor de la moneda** (céntimos), como entero.
- La pantalla solo crea grupos. Opciones, edición, borrado y enganche se hacen **con el asistente o
  la API** (MODIFIERS-F03, F04, F05).

Configuración inicial, paso a paso:

1. Abre **Modificadores**, rellena Nombre, y si hace falta «Nombre en la comanda», mínimo y máximo, y
   pulsa «Añadir» (MODIFIERS-F02).
2. Pide al asistente las opciones del grupo, cada una con su suplemento (MODIFIERS-F04).
3. Pide al asistente que enganche el grupo a los productos, servicios o categorías que lo llevan
   (MODIFIERS-F05).
4. En el TPV, toca uno de esos artículos y comprueba que sale la hoja con el grupo, la regla y el
   precio de cada opción (MODIFIERS-F06).

## Pantallas

### Modificadores
Menú **Modificadores → Modificadores** (una sola entrada de navegación; el módulo no declara bloque de
ajustes, así que no hay pestaña de Ajustes). Arriba, el título «Modificadores» y el formulario de alta:
Nombre, «Nombre en la comanda», «Mínimo (1 o más = obligatorio)» y «Máximo (0 = sin techo)», y el botón
«Añadir» (pasa a «Guardando…» mientras guarda y no se puede pulsar sin nombre). Debajo, la tabla de
grupos con buscador «Buscar…» (busca por nombre y por nombre de comanda): Nombre (se ordena y se
filtra), «En la comanda» (el nombre de cocina; si está vacío, el comercial), «Elección» (se ordena) y
Orden (se ordena). La columna Elección dice la regla: «Opcional» u «Obligatorio (mín. N)» (N es el mínimo del grupo) y, si hay techo,
« · máx. 3». Páginas de 50. El formulario sale a todos los perfiles, también al empleado, que solo
tiene permiso de consulta.
Vacía: «Todavía no hay grupos de modificadores.». Cargando: «Cargando…» en el hueco de la tabla. Error de
carga: el mensaje en la propia tabla con la opción de reintentar de la tabla (texto del botón sin
confirmar: lo pone OutfitKit); si la tabla no lo pinta, el mensaje sale encima. Un fallo del alta sale
bajo el formulario.

## Flujos

### MODIFIERS-F01 Consultar y buscar los grupos
Estado: hecho
Actor: administrador, responsable, empleado
Pantalla: Modificadores
Pasos:
1. Abre **Modificadores → Modificadores**.
2. Lee la tabla: nombre, nombre de comanda, regla de elección y orden.
3. Para encontrar uno, escribe en «Buscar…» (nombre o nombre de comanda), ordena por una columna o filtra por nombre.
Entra: los grupos del negocio (permiso de consulta).
Sale: nada; solo lee.
Si falla: el error de carga sale en la tabla con reintento; sin grupos, «Todavía no hay grupos de modificadores.».
Implicados: ninguno
QA: qa-hub-restaurant §7.03

### MODIFIERS-F02 Crear un grupo de modificadores
Estado: parcial — la pantalla no pide «se puede repetir» ni el orden (todo grupo creado aquí nace con orden 0), no avisa de un máximo por debajo del mínimo (el servidor lo acepta y el TPV no deja completar ese grupo) y el grupo nace sin opciones ni enganches
Actor: responsable, administrador
Pantalla: Modificadores
Pasos:
1. En la pantalla Modificadores, escribe el Nombre (obligatorio).
2. Si la comanda debe decir otra cosa, escribe «Nombre en la comanda»; vacío, cocina lee el nombre comercial.
3. Pon el «Mínimo» (1 o más hace el grupo obligatorio; 0, opcional) y el «Máximo» (0 es sin techo).
4. Pulsa «Añadir».
5. Los campos se vacían y el grupo aparece en la tabla con su regla («Opcional» u «Obligatorio (mín. N)», con N el mínimo del grupo, más « · máx. N»). Todavía no sale en el TPV: faltan sus opciones (MODIFIERS-F04) y su enganche (MODIFIERS-F05).
Entra: nombre, nombre de comanda, mínimo y máximo que escribe la persona; nada de otros componentes.
Sale: el grupo, con orden 0 y «no se repite» (avisa: modifiers.group.created). No crea opciones ni enganches.
Si falla: bajo el formulario sale el mensaje del error; «No se pudo crear el grupo» solo si lo que llega no es un error con mensaje (un error con mensaje vacío no pinta nada); los campos conservan lo escrito. Mínimo y máximo no pasan de 50 y el nombre no pasa de 255 caracteres (el servidor rechaza el resto con el detalle del esquema, texto sin confirmar). Un empleado no tiene permiso de gestión: el servidor responde pidiendo la aprobación de un responsable y el shell abre su diálogo de PIN; cómo queda el formulario después de aprobar, sin confirmar.
Implicados: REC_RESTAURANTE-F03
QA: qa-hub-restaurant §7.03

### MODIFIERS-F03 Cambiar o borrar un grupo
Estado: parcial — no hay botón en la pantalla: solo con el asistente o la API; un cambio que no nombra un campo lo devuelve a su valor de fábrica (mínimo 0, máximo 0, sin repetir, orden 0, nombre de comanda vacío); cambiar o borrar un grupo que no existe contesta bien y avisa igual
Actor: responsable, asistente
Pantalla: asistente
Pasos:
1. Pide al asistente el cambio (nombre, nombre de comanda, mínimo, máximo, repetir u orden) o el borrado del grupo.
2. Para cambiar, el nombre es obligatorio y todo lo demás se reescribe: lo que no se manda vuelve al valor de fábrica, no se queda como estaba.
3. Para borrar, el grupo y todas sus opciones y enganches se retiran en una sola operación.
4. El grupo cambia en la tabla o desaparece de ella; en el TPV, los artículos dejan de preguntarlo.
Entra: el identificador del grupo y los campos nuevos.
Sale: el grupo cambiado (avisa: modifiers.group.updated) o borrado con sus opciones y enganches (avisa: modifiers.group.deleted). Lo ya vendido o pedido no cambia: Venta congela el suplemento en la línea.
Si falla: el servidor rechaza un nombre vacío o un número fuera de rango. Un identificador que no existe no se rechaza: la orden contesta bien, no cambia nada y emite el aviso igual (sin comprobación de filas afectadas). Un grupo borrado deja de preguntarse al añadir el artículo; una cuenta abierta que ya lo llevaba conserva el suplemento congelado.
Implicados: SALES-F11
QA: ninguno

### MODIFIERS-F04 Añadir, cambiar o quitar las opciones de un grupo
Estado: parcial — no hay pantalla para las opciones (solo asistente o API); el suplemento va en céntimos y sin ayuda; un cambio que no nombra el suplemento lo deja en 0 y sin IVA propio; el alta no comprueba que el grupo sea de este negocio ni que no esté borrado
Actor: responsable, asistente
Pantalla: asistente
Pasos:
1. Pide al asistente añadir una opción a un grupo, con su nombre y su suplemento.
2. El suplemento es un entero en céntimos: positivo cobra de más, negativo descuenta, 0 es gratis.
3. Si hace falta, da un nombre de comanda (vacío, cocina lee el comercial), un orden y, solo si la opción tributa distinto de la línea, la clave de su categoría de IVA (vacía hereda la de la línea).
4. Para cambiarla o quitarla, pide el cambio o el borrado de esa opción.
5. La opción sale en la hoja del TPV de los artículos que llevan el grupo (MODIFIERS-F06).
Entra: grupo, nombre, nombre de comanda, suplemento, categoría de IVA propia y orden.
Sale: la opción (avisa: modifiers.option.created, updated o deleted). El borrado la retira del catálogo: las líneas ya pedidas conservan su copia congelada, salvo en la comanda de cocina (MODIFIERS-F08).
Si falla: el servidor rechaza un nombre vacío o un campo fuera de esquema. El alta solo tiene la clave ajena al grupo: acepta el identificador de un grupo borrado y no mira de qué negocio es. Cambiar o borrar una opción que no existe contesta bien y avisa igual. Un cambio que omite el suplemento lo pone a 0 y borra la categoría de IVA propia.
Implicados: REC_RESTAURANTE-F03
QA: qa-hub-restaurant §7.03

### MODIFIERS-F05 Enganchar un grupo a productos, servicios o categorías, y soltarlo
Estado: parcial — no hay pantalla (solo asistente o API); el TPV solo mira una categoría del artículo; un grupo enganchado a la vez al artículo y a su categoría rompe la hoja del TPV (MODIFIERS-F06); soltar un enganche que no existe contesta bien
Actor: responsable, asistente
Pantalla: asistente
Pasos:
1. Pide al asistente enganchar un grupo a un producto, a un servicio o a una categoría, dando su identificador.
2. Un mismo grupo puede colgar de muchos artículos y un artículo puede llevar varios grupos; el orden entre enganches no manda: los grupos salen por su Orden y su nombre.
3. En el TPV, al tocar el artículo salen los grupos enganchados a él y los de su categoría (MODIFIERS-F06).
4. Para quitarlo, pide soltar ese grupo de ese artículo; después puede volver a engancharse.
Entra: el grupo, el tipo (producto, servicio o categoría) y el identificador del artículo, que da Inventario o Servicios.
Sale: el enganche (avisa: modifiers.link.attached o modifiers.link.detached). Dos enganches vivos iguales no caben: el segundo se rechaza por duplicado.
Si falla: un duplicado lo rechaza la base (texto sin confirmar). El módulo no comprueba que el identificador sea de un artículo real, ni que el grupo exista o no esté borrado: un enganche a un identificador que no existe se guarda y nunca se pregunta. Soltar un enganche que no existe contesta bien y avisa igual. Un grupo enganchado a la vez al artículo y a su categoría sale dos veces de la consulta del TPV (una fila por enganche, sin quitar repetidos). El TPV pregunta por la categoría solo con la primera categoría que tiene cargada el artículo: un grupo colgado de la segunda no sale.
Implicados: REC_RESTAURANTE-F03
Pendiente de enlazar: services — servicios a los que se engancha un grupo
QA: R-04

### MODIFIERS-F06 Elegir las opciones al vender un artículo
Estado: parcial — un grupo enganchado a la vez al artículo y a su categoría saca cada opción dos veces y cuenta cada elección dos veces (con máximo 1 no se puede completar nunca; con mínimo 2 se da por bueno con una elección); el mínimo y el máximo solo los hace cumplir la hoja del TPV: el servidor no los comprueba ni que la opción pertenezca a un grupo del artículo; «se puede repetir» no se aplica en la venta; un grupo obligatorio sin opciones deja el artículo sin poder añadirse desde la hoja
Actor: cajero, responsable
Pantalla: Venta: Vender
Pasos:
1. En el TPV, toca un artículo que tiene grupos enganchados (a él o a su categoría): se abre una hoja con su nombre. Sin grupos, el artículo entra directo.
2. Cada grupo dice su regla: «Elige N» si es obligatorio, «Hasta N» si es opcional con techo, «Opcional» si no tiene techo; cada opción lleva su suplemento si no es cero.
3. Toca las opciones (volver a tocar una la quita; no se puede elegir la misma dos veces). El botón «Añadir» se queda en «Elige una opción para continuar» mientras un grupo tenga menos del mínimo o más del máximo.
4. Pulsa «Añadir»: la línea entra con las opciones en el orden elegido y su precio ya sumado.
Entra: los grupos y opciones de este módulo para ese artículo (`modifiers.for_target`: artículo, tipo y categoría).
Sale: la línea con las opciones elegidas. Del TPV solo viaja el identificador de cada opción; el suplemento que viaja es un adelanto de pantalla que el servidor ignora (MODIFIERS-F07).
Si falla: si Modificadores no está instalado, o si la lectura de sus grupos falla, el artículo entra directo sin preguntar nada y sin avisar, aunque tenga un grupo obligatorio. Si el grupo está enganchado a la vez al artículo y a su categoría, la hoja enseña cada opción dos veces y cuenta cada elección dos veces: con máximo 1 no se puede completar nunca (el artículo no se puede añadir desde la hoja) y con mínimo 2 se da por bueno con una sola elección; el cobro no se ve afectado (el servidor cobra cada opción elegida una vez). El servidor no vuelve a comprobar el mínimo ni el máximo: quien llame por la API o el asistente puede añadir una línea con menos, más o ninguna opción de un grupo obligatorio, o con la misma opción repetida aunque el grupo no lo permita (se cobra una vez por cada repetición). La hoja no lee «se puede repetir»: cada opción se elige una sola vez aunque el grupo lo permita. Un grupo obligatorio sin opciones, o con un mínimo mayor que su máximo, no se puede completar y el botón no se activa.
Implicados: COMBOS-F07, SALES-F11, REC_RESTAURANTE-F06
QA: R-04, qa-hub-restaurant §7.07

### MODIFIERS-F07 Cobrar el suplemento: precio y IVA
Estado: hecho
Actor: sistema
Pantalla: ninguna
Pasos:
1. En una venta directa, y al añadir la línea a una cuenta abierta, Venta lee el catálogo completo de opciones y pone cada suplemento al precio del catálogo; el precio que mande el navegador se ignora.
2. Una opción sin categoría de IVA propia, o con la misma que la línea, se suma al precio de la línea y hereda su tipo; el suplemento puede ser negativo.
3. Una opción con categoría de IVA distinta de la de su línea sale en una línea propia, hija de la del artículo, con su tipo; esa línea tiene que valer más de cero.
4. En una cuenta abierta (mesa), el suplemento se congela al pedir, en la fila de la cuenta: al cobrarla, Venta usa esa fila y no el catálogo; cambiar o borrar la opción después no cambia lo que paga esa mesa.
Entra: las opciones y sus suplementos de este módulo, leídos por Venta (`modifiers.options.all`, lectura completa sin paginar).
Sale: la línea con el suplemento sumado y una copia congelada de las opciones (identificador, grupo, nombre, nombre de comanda, suplemento y categoría de IVA), o la línea hija; ninguna opción mueve stock.
Si falla: en venta directa, sin Modificadores o sin que llegue el catálogo, una línea con suplementos se rechaza y no se cobra; también se rechaza al añadirla a una cuenta abierta. Una opción borrada se rechaza en venta directa y al añadir la línea; en una cuenta abierta que ya la llevaba se cobra a su precio congelado, sin rechazo. En el TPV, esos dos rechazos salen como «Error al cobrar» (Venta no tiene mensaje propio para ellos: hueco; sus frases del catálogo de errores de Venta no las pinta la pantalla de cobro, dónde se pintan, sin confirmar). Hija con precio cero o negativo: «Un suplemento de esa línea se factura aparte porque tributa a otro IVA, y una línea propia no puede valer cero o menos. Ponle precio en Suplementos, o quítale la categoría fiscal». En los rechazos la venta no se guarda.
Implicados: SALES-F11, REC_RESTAURANTE-F11
QA: qa-hub-restaurant §7.03

### MODIFIERS-F08 Que el suplemento salga en la comanda de cocina
Estado: parcial — la comanda vuelve a leer los nombres del catálogo de hoy: una opción borrada o renombrada entre pedirla y mandarla sale con un código o con el nombre nuevo, no con el nombre que se congeló; sin Modificadores, solo el código
Actor: sistema
Pantalla: ninguna
Pasos:
1. El camarero manda la cuenta a cocina.
2. Venta arma la comanda con las líneas guardadas y, para cada opción, pone el nombre de comanda del catálogo (si está vacío, el comercial).
3. Cocina guarda en la línea de la comanda las opciones separadas por «, » en el orden en que se eligieron; cada una usa su nombre de comanda, o el comercial, o el código si no hay otro (la pantalla de cocina y el papel las pintan debajo del plato, separadas por comas: KITCHEN-F07).
Entra: las opciones congeladas en cada línea de la cuenta y el catálogo vigente de opciones.
Sale: el aviso de comanda enviada (order.fired) con las opciones nombradas; Cocina las guarda como un texto en la línea de la comanda. Nada se avisa al camarero si el nombre cae al código.
Si falla: la comanda no se frena por falta de catálogo: sale igual, con el código en lugar del nombre, porque cocina parada es peor. Una opción que ya no está en el catálogo pierde el nombre congelado y sale como código.
Implicados: KITCHEN-F07, SALES-F20, REC_RESTAURANTE-F07
QA: R-04, qa-hub-restaurant §7.08

## Cobertura contra la referencia

| Elemento de la referencia | Estado | Flujo |
|---|---|---|
| Grupo propio, reutilizable, con nombre | hecho | F02 |
| Obligatorio, mínimo y máximo | parcial: la hoja del TPV lo hace cumplir, el servidor no | F02, F06 |
| Sin casilla «obligatorio» (mínimo 1 o más) | hecho | F02 |
| Nombre de cocina distinto del comercial | hecho | F02, F04, F08 |
| Opciones con suplemento positivo, negativo o cero | parcial: sin pantalla | F04, F07 |
| Enganchar a producto, servicio o categoría | parcial: sin pantalla | F05 |
| Hoja de elección en el TPV con la regla y el precio | parcial: un grupo enganchado al artículo y a su categoría se cuenta doble | F06 |
| Opciones en el orden en que se eligen | hecho | F06, F08 |
| Elegir la misma opción más de una vez | no hecho: el campo existe y nada lo lee | F06 |
| Opción con IVA propio como línea propia | hecho | F07 |
| Congelar el suplemento al pedir en la mesa | hecho | F07 |
| Salir en la comanda con nombre de cocina | parcial: nombre del catálogo de hoy | F08 |
| Modificador sin stock ni coste propio | hecho (por diseño) | F07 |
| Editar y borrar en pantalla | no hecho | F03, F04 |
| Activar y desactivar un grupo o una opción | no hecho: solo borrar o soltar | — |
| Disponibilidad o «agotado» de una opción (Square) | no hecho | — |
| Opciones por defecto o preseleccionadas | no hecho | — |
| Descontar ingredientes por opción | fuera del MVP (pm#116) | — |

## Datos: de quién es cada dato

- **Propios**: grupos, opciones y enganches (tres tablas). Los enganches guardan el identificador del
  artículo como referencia opaca, sin clave ajena: Modificadores no sabe qué es un producto ni un
  servicio.
- **Lo que lee de otros**: nada. No tiene dependencias ni lee consultas de otros módulos.
- **Quién lo lee**: Venta lee `modifiers.for_target` (hoja del TPV) y `modifiers.options.all` (precio,
  nombres y categoría de IVA al cobrar una venta directa, al añadir una línea a una cuenta y al mandar a cocina) y la pantalla del
  TPV lo lee para nombrar los suplementos en la precuenta. Cocina no lee este
  módulo: recibe el texto ya armado por Venta.
- **Copias fuera del módulo**: Venta guarda en cada línea una copia congelada de las opciones elegidas
  (identificador, grupo, nombre, nombre de comanda, suplemento y categoría de IVA); Cocina guarda el
  texto de las opciones en la línea de la comanda. Lo que guarda cada uno se lee en su módulo.
- **Datos personales** (inventario RGPD): ninguna tabla guarda datos de clientes. Las tres tablas
  guardan quién creó y quién cambió cada fila (identificador de usuario del hub). Los nombres y
  suplementos son datos del negocio. Cada aviso `modifiers.*` lleva los campos de la orden
  (nombre, suplemento, ids…) más el negocio, el identificador del usuario del hub que la lanzó, la hora y
  el id nuevo. Ningún dato de cliente.

## Reglas que no se rompen

- **Aislamiento**: toda lectura filtra por el negocio y las ediciones y borrados llevan el negocio en
  su condición; cada fila nace con el suyo.
- **El precio del suplemento lo decide el catálogo**, nunca el navegador: Venta ignora el que viaja;
  sin catálogo, o con una opción que ya no existe, no deja vender ni añadir la línea a una cuenta; lo ya
  pedido en una cuenta abierta se cobra congelado.
- **Una línea tiene un solo tipo de IVA**: la opción nunca reescribe el de la línea; con categoría
  propia distinta, se factura en su propia línea, que debe valer más de cero.
- **Una cuenta abierta paga el suplemento que pidió**: se congela al pedir y no se recalcula al cobrar.
- **Una opción no mueve stock ni lleva coste**: la línea hija no tiene identificador de artículo.
- **Permisos**: consultar es de los tres perfiles; crear, cambiar, borrar y enganchar es del
  responsable y del administrador. El servidor lo aplica aunque la pantalla enseñe el formulario: a un
  empleado le pide la aprobación de un responsable con su PIN.
- **Borrar un grupo retira también sus opciones y enganches**, en una sola operación.

## Lo que NO hace, a propósito

- No tiene variantes de producto ni stock ni coste por opción (descontar ingredientes es pm#116).
- No hace menús a precio cerrado: eso es Combos, que sí tiene su propio precio, IVA y stock.
- No cobra ni factura por sí mismo: Venta pone el dinero.
- No tiene activar y desactivar: se retira borrando el grupo o soltando el enganche.
- No tiene pantalla para opciones, enganches, edición ni borrado: es el asistente o la API.
- No comprueba que el máximo sea mayor o igual que el mínimo, ni que haya opciones suficientes para el
  mínimo.

## Dudas abiertas

Se resuelven con `market-decision`; no las decide el worker.

1. ¿El mínimo y el máximo deben hacerlos cumplir también Venta en el servidor (como ya hace con
   Combos) y el asistente, o basta con la hoja del TPV?
2. ¿Entra en el MVP la pantalla de opciones y de enganche, o el asistente basta?
3. ¿Hace falta «agotado» por opción (Square) o activar y desactivar un grupo sin borrarlo?
4. ¿«Se puede repetir» (el doble de queso) entra en el MVP? Hoy el campo existe y ninguna pantalla ni
   la venta lo usa.
5. ¿La comanda debe imprimir el nombre congelado al pedir, en vez de volver a leer el catálogo?
6. ¿Un máximo por debajo del mínimo debe rechazarse al guardar (Combos ya lo hace con una restricción
   de base y un aviso en pantalla)?

## Fuentes contrastadas

Contra `origin/main` de Modificadores v0.1.14, de Venta, de Cocina y `origin/develop` del hub
(05/10/2026). Una línea por discrepancia; manda el código.

- **`architecture/modules/modifiers.md`** abre con «decidido, sin implementar»: el módulo existe, con
  sus consultas, comandos y pantalla (F01 a F08). Y su nota de que una opción con categoría de IVA
  propia «se rechaza en `sales`» ya no es cierta: se factura en línea propia (F07).
- **`architecture/modules/modifiers.md` regla 3** («un grupo con mínimo 1 o más sin resolver bloquea el
  envío a cocina»): solo lo hace la hoja del TPV; el servidor de Venta no comprueba mínimo ni máximo
  de un modificador (sí el de un combo) y la cuenta se manda a cocina igual (F06).
- **`README.md` del módulo** nombra el componente `erp-modifiers-items`; el real es
  `erp-modifiers-groups`.
- **`allow_repeat`** (esquema, ADR y `architecture`): «permite elegir la misma opción más de una vez»;
  la hoja del TPV alterna cada opción y la venta no lo lee (F06).
- **Descripción de los esquemas**: «si no es 0, debe ser >= min_choices»; nada lo hace cumplir (ni
  esquema, ni SQL, ni pantalla), a diferencia de Combos (F02).
- **Nombre del módulo**: Venta lo llama «Suplementos» en sus textos (en `ui.errorModifierChildPrice`: «Ponle precio en Suplementos») y
  su documento; el módulo se llama «Modificadores» en su pantalla y su manifiesto (F07).
- **Manual de usuario** (`hand-book/modulos/modifiers.md`): coincide con el código en que la pantalla no
  crea opciones ni enganches; no dice que editar y borrar tampoco existen en pantalla, ni que un
  cambio por el asistente reescribe los campos que no se nombran (F03, F04).
- **Escenario `R-04`** («¿descuenta stock?») espera lo contrario por diseño: un modificador no mueve
  existencias (F07).

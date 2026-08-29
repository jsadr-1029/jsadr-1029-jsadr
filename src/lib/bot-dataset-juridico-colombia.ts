// =====================================================
// bot-dataset-juridico-colombia.ts — Refuerzo normativo colombiano
// =====================================================
// Dataset expandido del Bot Jurídico con normativa COLOMBIANA
// exhaustiva: leyes, códigos, decretos, jurisprudencia relevante
// para gestión de cartera, cobro prejurídico, judicial y post-judicial.
//
// Estructura por categoría:
//   • CODIGO_CIVIL      — obligaciones, contratos, prescripción, mora
//   • CODIGO_COMERCIO   — títulos valores, sociedades, contratos mercantiles
//   • CODIGO_PENAL      — usura, estafa, fraude
//   • CGP               — Código General del Proceso (Ley 1564/2012)
//   • HABEAS_DATA       — Ley 1266/2008 (centrales de información)
//   • DATOS_PERSONALES  — Ley 1581/2012
//   • ESTATUTO_CONSUMIDOR — Ley 1480/2011
//   • FINANCIERO        — Estatuto Orgánico, Superintendencia Financiera
//   • CONCURSAL         — Ley 1116/2006, Ley 550/1999
//   • GARANTIAS         — Ley 1676/2013 (garantías mobiliarias)
//   • LABORAL           — Código Sustantivo del Trabajo
//   • TRIBUTARIO        — Estatuto Tributario, retenciones
//   • COBRANZA          — reglamentación de cobranza (Decreto 3021/2019, Circular SB)
//   • JURISPRUDENCIA    — sentencias clave Corte Suprema y Constitucional
// =====================================================

import type { ItemEntrenamiento } from './bot-fuzzy-matcher'

export const DATASET_JURIDICO_COLOMBIA: ItemEntrenamiento[] = [
  // =====================================================
  // CÓDIGO CIVIL COLOMBIANO — Obligaciones, contratos, mora
  // =====================================================
  {
    id: 'JU-COL-001', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué establece el artículo 1551 del Código Civil colombiano?',
    respuesta: 'El Art. 1551 del Código Civil colombiano (Ley 84 de 1873) define: "Toda obligación consiste en dar, hacer o no hacer alguna cosa". Clasificación: obligaciones de DAR (entregar cosa), HACER (prestar servicio) y NO HACER (abstenerse). En solicitudes de dinero, la obligación principal del deudor es DAR (restituir dinero) y del acreedor es DAR (entregar el capital). Esta clasificación determina las acciones judiciales procedentes en caso de incumplimiento.',
    sinonimos: ['articulo 1551', 'art 1551', 'obligaciones dar hacer no hacer', 'tipos de obligacion', 'que es obligacion codigo civil', '1551 codigo civil'],
  },
  {
    id: 'JU-COL-002', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué establece el artículo 1568 del Código Civil sobre responsabilidad',
    respuesta: 'El Art. 1568 del Código Civil colombiano establece que "el que ha cometido un delito o culpa, que ha inferido daño a otro, es responsable de la indemnización". Clasificación: CULPA GRAVE (negligencia grosera, equiparada al dolo), CULPA LEVE (falta de diligencia ordinaria) y CULPA LEVÍSIMA (falta de diligencia extraordinaria). En contratos bilaterales se responde hasta por culpa leve. La prueba de la culpa corresponde al acreedor.',
    sinonimos: ['articulo 1568', 'art 1568', 'responsabilidad civil', 'culpa grave leve levisima', 'dano y perjuicio', 'indemnizacion', '1568 codigo civil'],
  },
  {
    id: 'JU-COL-003', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué es la mora ex re del artículo 1601?',
    respuesta: 'El Art. 1601 del Código Civil colombiano establece que en obligaciones a plazo determinado, "el deudor está en mora por el solo vencimiento del plazo" (MORA EX RE = mora automática por el solo vencimiento). No requiere interpelación judicial. Para obligaciones sin plazo determinado, requiere requerimiento del acreedor (MORA EX PERSONA). En contratos de mutuo con pagaré a fecha cierta, la mora se configura automáticamente al día siguiente del vencimiento. Esto habilita el cobro de intereses moratorios desde ese momento.',
    sinonimos: ['mora ex re', 'mora automatica', 'articulo 1601', 'art 1601', 'mora por vencimiento', 'intimacion no necesaria', 'presuncion mora'],
  },
  {
    id: 'JU-COL-004', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Cuándo prescribe una obligación civil en Colombia?',
    respuesta: 'Prescripción extintiva en Colombia (Código Civil arts. 2512 y ss.):\n• ORDINARIA: 3 años desde que la obligación se hizo exigible (Art. 2536) — corre desde el vencimiento.\n• DE TÍTULO EJECUTIVO (pagaré, sentencia): 5 años (Art. 2537).\n• HIPOTECA: 10 años (Art. 2519 modificado por Ley 791/2002).\n• ACCIÓN CAMBIARIA directa: 3 años desde el vencimiento (Ley 1430/2010 art. 782).\nINTERRUPCIÓN: por demanda judicial, requerimiento notarial, o reconocimiento del deudor (Art. 2518). Reinicia el término. La prescripción debe ser alegada por el deudor; el juez no la declara de oficio.',
    sinonimos: ['prescripcion obligacion', 'prescripcion civil', 'cuando prescribe', 'termino prescripcion', '3 anos prescripcion', '5 anos titulo ejecutivo', 'interrupcion prescripcion', '2512 codigo civil', '2536 codigo civil', '2537 codigo civil'],
  },
  {
    id: 'JU-COL-005', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué es el contrato de mutuo en Colombia?',
    respuesta: 'Contrato de MUTUO (Art. 2231 Código Civil colombiano): una parte entrega a otra una cantidad de cosas fungibles (dinero) con cargo de restituir otras tantas del mismo género y calidad. CARACTERÍSTICAS: real (se perfecciona con la entrega), unilateral (solo genera obligación de restituir para el mutuatario), gratuito o con interés. Si hay interés, se le llama "mutuo con interés". REQUISITOS: capacidad, cosa fungible, entrega, restitución pactada. Aplica para solicitudes de dinero — base legal del pagaré.',
    sinonimos: ['mutuo', 'contrato de mutuo', 'prestamo de uso civil', 'mutuo con interes', '2231 codigo civil', 'cosa fungible', 'restituir'],
  },
  {
    id: 'JU-COL-006', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué dice el artículo 1524 del Código Civil sobre intereses?',
    respuesta: 'El Art. 1524 del Código Civil colombiano establece que "el interés convencional es libre, pero no puede exceder del interés que las leyes especiales autoricen". En Colombia, el LÍMITE está dado por la Ley 1450 de 2011 (Ley Anti-Trámite, art. 305) y el Código Penal art. 305: no se puede cobrar más del 1.5× la TASA BANCARIA CORRIENTE certificada mensualmente por la Superintendencia Financiera (Resolución Externa 8/2000 del Banco de la República). Superar este límite constituye delito de USURA. La tasa bancaria corriente se publica mensualmente en el Diario Oficial.',
    sinonimos: ['interes convencional', 'limite intereses', 'articulo 1524', 'tasa maxima', 'interes legal', 'tasa bancaria corriente', '1.5 veces'],
  },
  {
    id: 'JU-COL-007', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Cómo se interpretan los contratos en Colombia?',
    respuesta: 'Interpretación de contratos (Arts. 1618-1624 Código Civil colombiano):\n• Art. 1618: conocer la intención clara de los contratantes.\n• Art. 1619: por aplicaciones prácticas que las partes hayan hecho.\n• Art. 1620: si hay ambigüedad, interpretar contra quien redactó.\n• Art. 1621: cláusulas ambiguas se interpretan en favor del deudor.\n• Art. 1623: el sentido en que produce efecto es preferible al que no lo produce.\n• Art. 1624: las cláusulas de uso común se presumen aunque no se expresen.\nEn contratos de adhesión (como pagarés estándar), la interpretación favorable al consumidor (Ley 1480/2011 art. 19) prevalece.',
    sinonimos: ['interpretacion contratos', 'reglas interpretacion', 'intencion contratantes', 'clausula ambigua', '1618 codigo civil', 'contra el redactor'],
  },
  {
    id: 'JU-COL-008', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué es la teoría de la imprevisión en Colombia?',
    respuesta: 'Teoría de la imprevisión (Art. 1601 Código Civil, interpretación jurisprudencial): permite al juez revisar un contrato cuando circunstancias extraordinarias e imprevisibles hacen excesivamente onerosa la prestación para una de las partes, ruinoso el cumplimiento. En Colombia fue desarrollada por la Corte Suprema (Sent. nov. 13/1940) y aplicada en casos hiperinflacionarios. REQUISITOS: (1) evento extraordinario e imprevisible, (2) excesiva onerosidad, (3) ruina económica de una parte. Permite reajuste o terminación del contrato. NO aplica a obligaciones dinerarias en economías estables.',
    sinonimos: ['teoria imprevision', 'imprevision', 'excesiva onerosidad', 'reajuste contrato', 'clausula rebus sic stantibus', 'ruina economica'],
  },
  {
    id: 'JU-COL-009', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué son las arras o señal en Colombia?',
    respuesta: 'Las ARRAS o SEÑAL (Art. 1613 Código Civil colombiano): cantidad que una parte da a otra para garantizar el contrato o como parte del precio. CLASES: arras CONFIRMATORIAS (prueban el consentimiento y son parte del precio, Art. 1614), arras PENITENCIALES (permiten retractarse perdiéndolas o restituyéndolas dobladas, Art. 1615). En Colombia se presumen confirmatorias salvo pacto expreso de penitenciales. En contratos de mutuo con garantía, las arras pueden funcionar como cláusula penal si se pacta expresamente.',
    sinonimos: ['arras', 'arras confirmatorias', 'arras penitenciales', 'senal', 'garantia contrato', '1613 codigo civil', 'pacta sunt servanda'],
  },
  {
    id: 'JU-COL-010', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué es la compensación legal en Colombia?',
    respuesta: 'COMPENSACIÓN LEGAL (Arts. 1714-1722 Código Civil colombiano): cuando dos personas recíprocamente deudoras, las dos deudas se extinguen hasta concurrencia de la menor. REQUISITOS (Art. 1715): (1) ambas deudas son de dinero o cosa fungible, (2) las dos son líquidas (determinadas en cantidad), (3) ambas son actualmente exigibles, (4) son pagaderas en el mismo lugar, (5) son embargables. Operación automática por ministerio de la ley. También existe compensación CONVENCIONAL (pacto) y JUDICIAL (sentencia). En cobro de cartera puede operar si el cliente tiene saldo a favor.',
    sinonimos: ['compensacion legal', 'deudas reciprocas', 'extincion obligacion', 'compensacion convencional', 'compensacion judicial', '1714 codigo civil', '1715 codigo civil'],
  },
  {
    id: 'JU-COL-011', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué es la novación en Colombia?',
    respuesta: 'NOVACIÓN (Arts. 1691-1701 Código Civil colombiano): sustitución de una obligación por otra que la extingue. TIPOS: (1) NOVACIÓN OBJETIVA — cambia el objeto o causa (Art. 1692), (2) NOVACIÓN SUBJETIVA por cambio de deudor — delegación (Art. 1693), (3) NOVACIÓN SUBJETIVA por cambio de acreedor — subrogación (Art. 1694). REQUISITOS: capacidad, voluntad de novar, obligación anterior válida, nueva obligación diferente. La novación extingue la obligación anterior Y sus garantías accesorias (fianzas, hipotecas) salvo pacto en contrario (Art. 1701). Útil en refinanciación de cartera — requiere re-constitución de garantías.',
    sinonimos: ['novacion', 'sustituir obligacion', 'novacion objetiva subjetiva', 'delegacion de deuda', 'subrogacion', 'refinanciacion novacion', '1691 codigo civil'],
  },
  {
    id: 'JU-COL-012', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué es la confusión como modo de extinguir obligaciones?',
    respuesta: 'CONFUSIÓN (Art. 1666 Código Civil colombiano): se produce cuando en una misma persona se reúnen las calidades de acreedor y deudor (ej: heredero que hereda del deudor). La obligación se extingue por reunirse en una sola persona las calidades opuestas. Es automática y opera por ministerio de la ley. CASOS TÍPICOS: herencia, fusión de sociedades, cesión de créditos al deudor. La confusión que recae en la obligación principal aprovecha a las fianzas; pero la confusión que recae en la fianza no extingue la obligación principal (Art. 1667). En cobro de cartera, puede presentarse cuando un heredero del acreedor resulta ser también heredero del deudor.',
    sinonimos: ['confusion', 'reunir acreedor y deudor', '1666 codigo civil', 'extincion automatica', 'confusion herencia', 'fusion societaria'],
  },
  {
    id: 'JU-COL-013', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué es la remisión o condonación de deuda?',
    respuesta: 'REMISIÓN o CONDONACIÓN (Arts. 1654-1660 Código Civil colombiano): el acreedor gratuitamente libera al deudor de la obligación. Es un acto jurídico bilateral (requiere aceptación del deudor). CLASES: expresa (documento) o tácita (entrega voluntaria del título al deudor, Art. 1656). La remisión de la obligación principal extingue las garantías accesorias (fianza, prenda), pero la remisión de la fianza NO extingue la obligación principal (Art. 1657). En gestión de cartera, una condonación parcial (quita) debe documentarse formalmente para evitar futuros reclamos. La remisión no se presume (Art. 1659).',
    sinonimos: ['remision', 'condonacion', 'perdonar deuda', 'quita', 'condonacion parcial', '1654 codigo civil', 'entrega titulo'],
  },
  {
    id: 'JU-COL-014', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué es la solidaridad en obligaciones?',
    respuesta: 'SOLIDARIDAD (Arts. 1568-1580 Código Civil colombiano — nota: remitidos a arts. 1514-1523 de Ley 84/1873 en versiones originales): cuando hay pluralidad de acreedores o deudores, cada uno puede exigir o debe pagar el total. CLASES: activa (varios acreedores, cualquiera cobra el total), pasiva (varios deudores, cualquiera paga el total), mixta. Es SIEMPRE LEGAL: NO se presume, debe pactarse expresamente (Art. 1568). En contratos de mutuo con codeudor solidario, permite al acreedor cobrar el 100% a cualquiera de los deudores. La solidaridad se renueva por requerimiento escrito al codeudor (interrumpe prescripción). CODEUDOR SOLIDARIO responde con los mismos intereses y costas que el deudor principal.',
    sinonimos: ['solidaridad', 'codeudor solidario', 'obligacion solidaria', 'varios deudores', '1568 codigo civil', 'presuncion no solidaridad', 'renovacion solidaridad'],
  },
  {
    id: 'JU-COL-015', categoria: 'CODIGO_CIVIL',
    pregunta: '¿Qué es la cláusula penal en Colombia?',
    respuesta: 'CLÁUSULA PENAL (Arts. 1592-1606 Código Civil colombiano): estipulación accesoría en que las partes fijan anticipadamente la indemnización por incumplimiento. FUNCIONES: (1) garantía del cumplimiento, (2) liquidación anticipada de perjuicios. CLASES: penal COMPENSATORIA (sustituye indemnización por incumplimiento total) y penal MORATORIA (por mora en cumplimiento parcial, suma con indemnización). LÍMITES: la pena no puede ser excesiva; el juez puede reducirla equitativamente si es manifiestamente lesiva (Art. 1601 Ley 153/1887 y jurisprudencia). Requiere obligación principal válida (Art. 1597). En pagarés, los intereses moratorios son una especie de cláusula penal moratoria.',
    sinonimos: ['clausula penal', 'pena convencional', 'multa contractual', 'indemnizacion anticipada', 'penal compensatoria', 'penal moratoria', '1592 codigo civil'],
  },

  // =====================================================
  // CÓDIGO DE COMERCIO — Títulos valores, sociedades
  // =====================================================
  {
    id: 'JU-COL-020', categoria: 'CODIGO_COMERCIO',
    pregunta: '¿Qué es un título valor en Colombia?',
    respuesta: 'TÍTULO VALOR (Ley 1430 de 2010 — Reforma al Código de Comercio, arts. 619 y ss.): documento necesario para legitimar el ejercicio del derecho literal y autónomo que en él se incorpora. CARACTERÍSTICAS ESENCIALES: (1) LITERALIDAD — el derecho es exactly lo que dice el documento, ni más ni menos; (2) AUTONOMÍA — cada poseedor de buena fe adquiere un derecho propio, independiente de relaciones anteriores; (3) ABSTRACCIÓN — el derecho es independiente de la causa o negocio subyacente; (4) NECESIDAD — se requiere la tenencia del documento para ejercer el derecho. EJEMPLOS: pagaré, letra de cambio, cheque, certificado de depósito, bono, acción. La Ley 1430/2010 modernizó el régimen cambiario en Colombia.',
    sinonimos: ['titulo valor', 'titulos valores', 'que es titulo valor', 'literalidad autonomia abstraccion', 'ley 1430 de 2010', 'codigo comercio titulos', 'documentos mercantiles'],
  },
  {
    id: 'JU-COL-021', categoria: 'CODIGO_COMERCIO',
    pregunta: '¿Cuáles son los requisitos del pagaré en Colombia?',
    respuesta: 'REQUISITOS DEL PAGARÉ (Art. 709 Código de Comercio, modificado por Ley 1430/2010):\n1. La mención de ser "pagaré" inserta en el texto.\n2. La promesa incondicional de pagar una suma determinada.\n3. El nombre de la persona a quien debe hacerse el pago.\n4. El lugar y la época del pago (si no se especifica lugar, se paga en el domicilio del deudor; si no se especifica época, es pagadero a la vista).\n5. El lugar y fecha en que se suscribe.\n6. La firma del creador (suscriptor).\nOMISIONES SANABLES (Art. 710): lugar de pago, lugar de suscripción. EFECTO DE LA FALTA DE REQUISITOS: si falta la promesa incondicional, la suma, el beneficiario o la firma, el documento NO es pagaré (pero puede ser otro medio de prueba). El pagaré es TÍTULO EJECUTIVO si reúne los requisitos.',
    sinonimos: ['requisitos pagare', 'pagare colombia', '709 codigo comercio', 'ley 1430 pagare', 'promesa incondicional pago', 'titulo ejecutivo pagare'],
  },
  {
    id: 'JU-COL-022', categoria: 'CODIGO_COMERCIO',
    pregunta: '¿Qué es la acción cambiaria directa en Colombia?',
    respuesta: 'ACCIÓN CAMBIARIA DIRECTA (Arts. 782-789 Código de Comercio, Ley 1430/2010): acción ejecutiva contra el creador/aceptante del título valor y sus avalistas, por falta de pago o de aceptación. CARACTERÍSTICAS: (1) es EJECUTIVA — permite proceso ejecutivo cambiario, (2) PRESCRIPCIÓN: 3 años desde el vencimiento (Art. 789), (3) REQUISITOS: protesto (si es obligatorio) o declaración equivalente, (4) SOLIDARIDAD de los obligados cambiarios. REQUISITOS PROCESALES: título original, protesto notarial (dentro de los 15 días siguientes al vencimiento, Art. 786) salvo cláusula "sin protesto". PERMITE: embargo, secuestro, avalúo y remate de bienes del deudor.',
    sinonimos: ['accion cambiaria directa', 'ejecucion pagare', '782 codigo comercio', '789 codigo comercio', 'prescripcion cambiaria', 'protesto notarial', '3 anos accion cambiaria'],
  },
  {
    id: 'JU-COL-023', categoria: 'CODIGO_COMERCIO',
    pregunta: '¿Qué es el endoso en Colombia?',
    respuesta: 'ENDOSO (Arts. 653-665 Código de Comercio, Ley 1430/2010): transferencia de la propiedad de un título valor mediante anotación escrita en el documento o en hoja adherida. CLASES: (1) ENDOSO PROPIETARIO — transfiere la propiedad; (2) ENDOSO EN GARANTÍA — da derecho al endosatario para garantizar un crédito; (3) ENDOSO EN PROCURACIÓN O COBRO — autoriza al endosatario a cobrar sin transferir propiedad. REQUISITOS: firma del endosante, nombre del endosatario (puede ser al portador), clase de endoso (si no se especifica, se presume propietario). El endoso debe ser puro y simple (toda condición se tiene por no escrita). Endoso posterior al protesto funciona como cesión ordinaria.',
    sinonimos: ['endoso', 'endoso propietario', 'endoso garantia', 'endoso procuracion', 'transferir titulo valor', '653 codigo comercio', 'ceder pagare'],
  },
  {
    id: 'JU-COL-024', categoria: 'CODIGO_COMERCIO',
    pregunta: '¿Qué es el aval en Colombia?',
    respuesta: 'AVAL (Arts. 639-646 Código de Comercio, Ley 1430/2010): garantía cambiaria por la cual un tercero (avalista) garantiza el pago de un título valor en todo o en parte, solidariamente con el avalado. CARACTERÍSTICAS: (1) SOLIDARIDAD — el avalista responde de la misma manera que el avalado; (2) AUTONOMÍA — independiente de la obligación del avalado (si la obligación del avalado es nula por vicio de forma, el aval subsiste); (3) SUBROGACIÓN — el avalista que paga queda subrogado en los derechos cambiarios contra el avalado y los obligados anteriores. EXPRESIÓN: "buen por aval", "por aval" u otra equivalente, con firma. Si solo aparece la firma, se presume aval (salvo que sea del creador o librado). El aval puede ser por el monto total o parcial.',
    sinonimos: ['aval', 'avalista', 'garantia cambiaria', 'aval cambiario', '639 codigo comercio', 'aval solidario', 'buen por aval'],
  },
  {
    id: 'JU-COL-025', categoria: 'CODIGO_COMERCIO',
    pregunta: '¿Qué tipos de sociedades existen en Colombia?',
    respuesta: 'TIPOS DE SOCIEDADES EN COLOMBIA (Código de Comercio arts. 323-371, Ley 1258/2008 S.A.S.):\n1. SOCIEDAD SIMPLIFIC POR ACCIONES (S.A.S.) — Ley 1258/2008, más flexible, una o varias personas, responsabilidad limitada al aporte. RECOMENDADA para emprendimiento.\n2. SOCIEDAD DE RESPONSABILIDAD LIMITADA (Ltda.) — 2-25 socios, responsabilidad limitada al aporte.\n3. SOCIEDAD ANÓNIMA (S.A.) — mín. 5 accionistas, responsabilidad limitada al aporte, gobierno corporativo estricto.\n4. SOCIEDAD EN COMANDITA SIMPLE — socios colectivos (responsabilidad ilimitada) + comanditarios (limitada al aporte).\n5. SOCIEDAD EN COMANDITA POR ACCIONES — similar a la anterior pero con acciones.\n6. SOCIEDAD COLECTIVA — todos los socios responden solidaria e ilimitadamente.\n7. SOCIEDAD DE HECHO — no tiene personería jurídica, dos o más personas.\nPara plataformas financieras, lo habitual es S.A.S. o S.A. por responsabilidad limitada y facilidad de gestión.',
    sinonimos: ['tipos de sociedad', 'sas', 's.a.', 'sociedad limitada', 'ley 1258', 'responsabilidad limitada', 'sociedad colombia'],
  },
  {
    id: 'JU-COL-026', categoria: 'CODIGO_COMERCIO',
    pregunta: '¿Qué es el contrato de mutuo mercantil?',
    respuesta: 'MUTUO MERCANTIL (Art. 1161 Código de Comercio): cuando una de las partes entrega a la otra cierta cantidad de cosas fungibles con la condición de restituir otras tantas del mismo género y calidad, Y AL MENOS UNA de las partes es comerciante, O si la cosa es materia de comercio. DIFERENCIA CON MUTUO CIVIL: (1) se presume oneroso (con interés) salvo pacto en contrario (civil se presume gratuito entre particulares), (2) rige el Código de Comercio, no el Código Civil, (3) puede generar actos mercantiles sujetos a matrícula. Es la base legal de las operaciones de microcrédito cuando el acreedor es comerciante (empresa de crédito).',
    sinonimos: ['mutuo mercantil', '1161 codigo comercio', 'prestamo mercantil', 'diferencia mutuo civil mercantil', 'interes presunto mercantil'],
  },

  // =====================================================
  // CÓDIGO PENAL — Usura, estafa, fraude
  // =====================================================
  {
    id: 'JU-COL-030', categoria: 'CODIGO_PENAL',
    pregunta: '¿Qué es el delito de usura en Colombia?',
    respuesta: 'DELITO DE USURA (Art. 305 Código Penal colombiano — Ley 599/2000): "el que mediante Pricing de intereses, comisiones u otras ventajas económicamente equivalentes, en cuantía superior a 1.5 veces la tasa bancaria corriente certificada por la Superintendencia Financiera, expida, acepte, gire, otorgue, avale o garantice títulos valores o documentos de crédito, incurre en prisión de 2 a 6 años y multa hasta 200 SMMLV". TASA BANCARIA CORRIENTE: certificada mensualmente por la Superintendencia Financiera (Res. Externa 8/2000 Banco de la República). Para el 2024 oscila entre 14-16% EA, por lo que el LÍMITE de usura está en 21-24% EA. La conducta requiere DOLO (conocimiento de la ilicitud). No aplica a operaciones con tarjeta de crédito por remisión específica (Art. 372 Ley 599/2000).',
    sinonimos: ['usura', 'delito usura', '305 codigo penal', 'ley 1450 usura', '1.5 veces tasa bancaria corriente', 'limite intereses colombia', 'tasa maxima legal'],
  },
  {
    id: 'JU-COL-031', categoria: 'CODIGO_PENAL',
    pregunta: '¿Qué es el delito de estafa en Colombia?',
    respuesta: 'DELITO DE ESTAFA (Art. 246 Código Penal colombiano — Ley 599/2000): "el que obtenga provecho ilícito en perjuicio de otro, manipulando cálculos, alterando por cualquier medio los precios o condiciones normales del mercado, induciendo a error a otro, reprimirá con prisión de 4 a 11 años y multa hasta 1500 SMMLV". ELEMENTOS: (1) engaño o manipulación, (2) inducción a error, (3) provecho ilícito, (4) perjuicio patrimonial, (5) relación causal. MODALIDADES AGRAVADAS: si la cuantía excede 250 SMMLV (Art. 247), si hay concurso de varias personas, si se comete aprovechando confianza, etc. En créditos, puede presentarse cuando un cliente falsea información para obtener el solicitud (ingresos, referencias, codeudor ficticio).',
    sinonimos: ['estafa', 'delito estafa', '246 codigo penal', 'engano provecho ilicito', 'falsa informacion', '247 codigo penal'],
  },
  {
    id: 'JU-COL-032', categoria: 'CODIGO_PENAL',
    pregunta: '¿Qué es el fraude procesal?',
    respuesta: 'FRAUDE PROCESAL (Art. 454 Código Penal colombiano — Ley 599/2000): "el que por cualquier medio fraudulento induzca a error a un servidor público en la resolución de un asunto sometido a su conocimiento, incurre en prisión de 6 a 12 años y multa". Se presenta cuando una de las partes en un proceso judicial presenta pruebas falsas, oculta información relevante, o manipula el proceso para obtener sentencia favorable. En cobro de cartera puede configurarse cuando: (1) el acreedor presenta documentos alterados, (2) se cobra un saldo ya pagado, (3) se simula notificación al deudor. Es DELITO GRAVE — la sanción es mayor que la estafa simple.',
    sinonimos: ['fraude procesal', '454 codigo penal', 'inducir error servidor publico', 'pruebas falsas', 'manipulacion proceso judicial'],
  },

  // =====================================================
  // CÓDIGO GENERAL DEL PROCESO (CGP) — Ley 1564/2012
  // =====================================================
  {
    id: 'JU-COL-040', categoria: 'CGP',
    pregunta: '¿Qué es el proceso ejecutivo en Colombia?',
    respuesta: 'PROCESO EJECUTIVO (Art. 420-433 CGP — Ley 1564/2012): mecanismo judicial abreviado para cobrar obligaciones claras y exigibles documentadas en TÍTULO VALOR o TÍTULO EJECUTIVO. REQUISITOS (Art. 420): (1) obligación LIQUIDA (cantidad determinada), (2) EXIGIBLE (vencida el plazo), (3) documentada en título con fuerza ejecutiva. TÍTULOS EJECUTIVOS: pagaré, letra de cambio, cheque, sentencia, laudo arbitral, confesión extrajudicial, cuenta aprobada, etc. PROCEDIMIENTO: demanda → mandamiento de pago (auto que ordena pagar en 5 días) → excepciones (10 días) → práctica de pruebas → sentencia → ejecución (embargo, secuestro, remate). DURACIÓN: 8-18 meses según juzgado. PERMITE medidas cautelares previas (Art. 423 CGP).',
    sinonimos: ['proceso ejecutivo', '420 cgp', 'ley 1564 proceso ejecutivo', 'cobro judicial', 'mandamiento de pago', 'titulo ejecutivo', 'ejecucion titulo valor'],
  },
  {
    id: 'JU-COL-041', categoria: 'CGP',
    pregunta: '¿Cuáles son las medidas cautelares en el proceso ejecutivo?',
    respuesta: 'MEDIDAS CAUTELARES (Art. 423 CGP — Ley 1564/2012): aseguran el pago de la obligación antes de la sentencia. CLASES: (1) EMBARGO de bienes muebles o inmuebles del deudor, (2) SECUESTRO de bienes para mantenerlos en depósito, (3) RETENCIÓN sobre sueldos, saldos bancarios o créditos a favor del deudor, (4) INSCRIPCIÓN en oficinas de registro público (para bienes sujetos a registro), (5) CAUCIÓN: el demandante debe prestar caución por los perjuicios que cause si la demanda resulta infundada (Art. 423 inc. 2). REQUISITOS: (1) demanda ejecutiva admitida, (2) identificación de bienes del deudor, (3) caución. PRIORIDAD: bienes del deudor principal, luego codeudores solidarios. Las medidas se levantan si el deudor paga o si se absuelve en sentencia.',
    sinonimos: ['medidas cautelares', '423 cgp', 'embargo secuestro', 'retencion judicial', 'caucion medidas cautelares', 'asegurar pago'],
  },
  {
    id: 'JU-COL-042', categoria: 'CGP',
    pregunta: '¿Qué es el proceso monitorio en Colombia?',
    respuesta: 'PROCESO MONITORIO (Art. 423-A CGP, adicionado por Ley 1564/2012 y reformado por Ley 1955/2019): mecanismo ágil para obligaciones documentadas que NO tienen fuerza ejecutiva (facturas, contratos, cuentas de cobro). PROCEDIMIENTO: (1) solicitud del acreedor con documento, (2) el juez admite y emite REQUERIMIENTO DE PAGO al deudor (en 20 días), (3) si el deudor paga o no contesta, se ordena el pago mediante AUTO (título ejecutivo), (4) si el deudor opone, se tramita como proceso ordinario abreviado. VENTAJA: más rápido que ejecutivo si no hay oposición. LIMITACIÓN: solo para obligaciones de dinero sin título ejecutivo. Es útil para cobrar facturas comerciales impagas sin necesidad de proceso ejecutivo.',
    sinonimos: ['proceso monitorio', '423-a cgp', 'cobro facturas', 'ley 1955 monitorio', 'obligaciones sin titulo ejecutivo', 'requerimiento de pago monitorio'],
  },
  {
    id: 'JU-COL-043', categoria: 'CGP',
    pregunta: '¿Cómo se embargan bienes en Colombia?',
    respuesta: 'EMBARGO DE BIENES EN COLOMBIA (Arts. 510-540 CGP, Ley 1564/2012):\n\n1. BIENES MUEBLES: secuestro físico por el secuestre judicial. Documentos: acta de secuestro, depósito.\n2. BIENES INMUEBLES: inscripción del embargo en la OFICINA DE REGISTRO DE INSTRUMENTOS PÚBLICOS (ORIP). Conserva el orden de prioridad según fecha de inscripción.\n3. CUENTAS BANCARIAS: oficio a la entidad financiera. Retención hasta el monto del embargo. Prioridad: cuentas de ahorros → corrientes → CDT.\n4. SALARIOS: oficio al empleador. Límite: solo se puede embargar el 20% del salario (Código Sustantivo del Trabajo art. 59). El mínimo no es embargable.\n5. VEHÍCULOS: inscripción en RUNT y secuestro físico.\n\nORDEN DE Bienes A EMBARGAR (Art. 511 CGP): (1) dinero en efectivo, (2) saldos bancarios, (3) muebles, (4) inmuebles. EXCEPCIONES: bienes inembargables (Art. 512 CGP): bien de familia, ropa de uso, herramientas de trabajo, lecho familiar.',
    sinonimos: ['embargo bienes', '510 cgp', 'embargo inmueble', 'embargo cuenta bancaria', 'embargo salario', 'bienes inembargables', 'oficio embargo', 'orip embargo', 'secuestro judicial'],
  },
  {
    id: 'JU-COL-044', categoria: 'CGP',
    pregunta: '¿Qué bienes son inembargables en Colombia?',
    respuesta: 'BIENES INEMBARGABLES (Art. 512 CGP — Ley 1564/2012, y Art. 59 Código Sustantivo del Trabajo):\n\n1. BIEN DE FAMILIA (Ley 70/1986) — inmueble destinado a vivienda familiar, inembargable por deudas civiles o comerciales.\n2. SALARIOS y prestaciones sociales — solo embargables en 20% (CST art. 59), y el mínimo no es embargable.\n3. ROPA de uso, muebles de casa necesarios para el lecho familiar.\n4. HERRAMIENTAS de trabajo y máquinas necesarias para profesión u oficio (hasta 50 SMMLV).\n5. PENSIONES y bonos pensionales — inembargables salvo por alimentos y créditos pensionales.\n6. DERECHOS de uso y habitación del núcleo familiar.\n7. BIENES PÚBLICOS (de uso público, fiscal, etc.).\n8. SEGUROS DE VIDA y de invalidez — salvo cláusula expresa.\n9. INDEMNIZACIONES por accidente de trabajo o enfermedad profesional.\n10. SUBSIDIOS familiares y de vivienda.\n\nIMPORTANTE: estos bienes no son embargables por obligaciones civiles o comerciales; sí pueden ser embargados por alimentos, obligaciones alimentarias, o sentencias penales.',
    sinonimos: ['bienes inembargables', '512 cgp', 'bien de familia', 'salario inembargable', 'pension inembargable', 'ley 70 bien familia', '59 cst', '59 codigo sustantivo trabajo'],
  },
  {
    id: 'JU-COL-045', categoria: 'CGP',
    pregunta: '¿Cómo se ejecuta una sentencia en Colombia?',
    respuesta: 'EJECUCIÓN DE SENTENCIA (Arts. 332-340 CGP — Ley 1564/2012): procedimiento para hacer efectiva una sentencia firme que ordena pago de dinero. PASOS:\n\n1. SOLICITUD de ejecución por el demandante (dentro de los 5 años de ejecutoriada la sentencia).\n2. El juez expide MANDAMIENTO DE PAGO al deudor (15 días para pagar voluntariamente).\n3. Si no paga, se procede al EMBARGO y SECUESTRO de bienes.\n4. AVALÚO de los bienes por perito (Art. 519 CGP).\n5. REMATE en pública subasta (Art. 526 CGP) — público, con base legal, postura legal (70% del avalúo).\n6. ADJUDICACIÓN al mejor postor o al demandante.\n7. PAGO al demandante y entrega del remanente al deudor.\n\nDURACIÓN: 6 meses a 2 años según bienes y oposición. SI NO HAY BIENES: el proceso queda suspendido hasta que se identifiquen bienes (Art. 339 CGP). La sentencia NO caduca: puede ejecutarse hasta por 5 años renovables.',
    sinonimos: ['ejecucion sentencia', '332 cgp', 'mandamiento de pago', 'remate bienes', 'publica subasta', '526 cgp', '519 cgp avaluo', 'ejecutoriada sentencia'],
  },
  {
    id: 'JU-COL-046', categoria: 'CGP',
    pregunta: '¿Qué es la conciliación extrajudicial en derecho?',
    respuesta: 'CONCILIACIÓN EXTRAJUDICIAL EN DERECHO (Ley 640/2001, Ley 1394/2010, Ley 1564/2012 art. 89): mecanismo alternativo de resolución de conflictos (MARC) donde un conciliador ayuda a las partes a llegar a un acuerdo. CARACTERÍSTICAS: (1) REQUISITO DE PROCEDIBILIDAD — en materia civil y comercial debe intentarse antes de demandar (salvo excepciones del art. 89 CGP), (2) VOLUNTARIA — las partes asisten libremente, (3) el acuerdo tiene MÉRITO EJECUTIVO — si se incumple, puede ejecutarse ante juez, (4) el acta de conciliación presta MÉRITO EJECUTIVO. CENTROS DE CONCILIACIÓN: autorizados por el Ministerio de Justicia. VENTAJA: más rápido (1-2 sesiones), económico, evita proceso judicial. En cobro de cartera es el primer escalón del proceso prejurídico.',
    sinonimos: ['conciliacion extrajudicial', 'ley 640', 'ley 1394', 'marc', 'acuerdo conciliatorio', 'merito ejecutivo conciliacion', 'centro de conciliacion', 'requisito procedibilidad'],
  },
  {
    id: 'JU-COL-047', categoria: 'CGP',
    pregunta: '¿Qué es el arbitramento en Colombia?',
    respuesta: 'ARBITRAMENTO (Ley 1563/2012): mecanismo por el cual las partes delegan a un tercero (árbitro o tribunal arbitral) la solución de su conflicto. CARACTERÍSTICAS: (1) requiere CLÁUSULA COMPROMISORIA en el contrato (acuerdo previo), (2) la decisión (LAUDO) es DEFINITIVA y tiene fuerza de sentencia judicial (Art. 31 Ley 1563/2012), (3) se desarrolla ante CENTROS DE ARBITRAJE (Cámara de Comercio, etc.), (4) los árbitros son abogados inscritos, (5) más rápido que la justicia ordinaria (6 meses vs 2-3 años). TIPOS: en EQUIDAD (árbitros deciden según su leal saber y entender) o en DERECHO (aplican la ley estrictamente). COSTOS: superiores a proceso judicial, pero se compensa con celeridad. ÚTIL en contratos comerciales de alta cuantía.',
    sinonimos: ['arbitramento', 'arbitraje', 'ley 1563', 'clausula compromisoria', 'laudo arbitral', 'tribunal arbitral', 'centro de arbitraje', 'arbitraje equidad derecho'],
  },
  {
    id: 'JU-COL-048', categoria: 'CGP',
    pregunta: '¿Qué es la acción de tutela y cuándo procede?',
    respuesta: 'ACCIÓN DE TUTELA (Art. 86 Constitución Política, Decreto 2591/1991): mecanismo judicial preferente y sumario para la protección INMEDIATA de los derechos constitucionales fundamentales. CARACTERÍSTICAS: (1) PROCEDENCIA: cuando la vulneración sea causada por acción u omisión de cualquier autoridad pública, o de particulares en los casos del art. 42 Decreto 2591, (2) plazo: 10 días para resolver, (3) subsidiaria: solo si no hay otros medios de defensa judicial efectivos, (4) imprescriptible, gratuita, no requiere abogado. EN COBRANZA: puede presentarse cuando (a) el acreedor reporta indebidamente a central de información, (b) se afecta el mínimo vital del deudor por embargos excesivos, (c) se vulnera el derecho a la intimidad financiera. NO sustituye proceso ejecutivo — protege derechos fundamentales, no derechos patrimoniales.',
    sinonimos: ['tutela', 'accion de tutela', '86 constitucion', 'decreto 2591', 'derechos fundamentales', 'tutela contra banco', 'tutela reporte central riesgo'],
  },

  // =====================================================
  // HABEAS DATA — Ley 1266 de 2008
  // =====================================================
  {
    id: 'JU-COL-050', categoria: 'HABEAS_DATA',
    pregunta: '¿Qué es el Habeas Data en Colombia?',
    respuesta: 'HABEAS DATA (Art. 15 Constitución Política, Ley 1266 de 2008): derecho fundamental que tiene toda persona a conocer, actualizar y rectificar la información que se haya recogido sobre ella en bancos de datos y archivos de entidades públicas o privadas. ALCANCE: aplicación a datos personales en centrales de información (Datacrédito, Cifin, TransUnion). DERECHOS DEL TITULAR: (1) CONOCER — qué se reporta y por quién, (2) ACTUALIZAR — datos desactualizados, (3) RECTIFICAR — información errónea, (4) RETIRAR — reporte negativo cuando se satisfaga la obligación. AUTORIDAD: Superintendencia de Industria y Comercio (SIC) — Delegatura de Protección de Datos. SANCIONES: hasta 2000 SMMLV por incumplimiento. PRESCRIPCIÓN DEL REPORTE NEGATIVO: la Ley 1266 fija plazos máximos de permanencia según monto.',
    sinonimos: ['habeas data', 'ley 1266', '15 constitucion', 'centrales de informacion', 'derechos del titular', 'datacredito cifin', 'sic datos personales'],
  },
  {
    id: 'JU-COL-051', categoria: 'HABEAS_DATA',
    pregunta: '¿Cuánto tiempo puede permanecer un reporte negativo en Datacrédito?',
    respuesta: 'PERMANENCIA DEL REPORTE NEGATIVO (Ley 1266 de 2008, Art. 13, reglamentada por Decreto 1738/2008 y modificada por Ley 1581/2012):\n\nPLAZOS MÁXIMOS según cuantía:\n• DOBLE UVR o inferior (historia positiva): PERMANENTE (mientras dure la relación) — la negativa se retira a los 2 años de pago.\n• De 1 a 4 SMMLV: 2 años después de pago.\n• De 4 a 30 SMMLV: 4 años después de pago.\n• Más de 30 SMMLV: 6 años después de pago.\n• FRAUDE o DELITOS contra el sector financiero: 8 años.\n\nREGLAS GENERALES:\n• El reporte solo puede iniciarse después de 30 días de mora (Art. 11 Decreto 1738).\n• Debe notificarse al titular 20 días hábiles antes del reporte (Art. 11).\n• El pago extingue el reporte al vencer el plazo.\n• La prescripción de la obligación NO extingue automáticamente el reporte (requiere solicitud expresa).\n\nLa omisión en el retiro genera sanción de la SIC.',
    sinonimos: ['permanencia reporte negativo', 'tiempo reporte datacredito', '13 ley 1266', 'decreto 1738', 'plazo reporto negativo', 'retiro reporte negativo'],
  },
  {
    id: 'JU-COL-052', categoria: 'HABEAS_DATA',
    pregunta: '¿Cómo se notifica al cliente antes del reporte negativo?',
    respuesta: 'NOTIFICACIÓN PREVIA AL REPORTE NEGATIVO (Art. 11 Decreto 1738/2008, reglamentario de Ley 1266/2008):\n\nREQUISITOS:\n1. PLAZO: la entidad debe informar al titular con mínimo 20 días hábiles de anticipación al reporte.\n2. CONTENIDO: (a) obligación que será reportada, (b) valor y fecha de exigibilidad, (c) entidad que reporta, (d) derecho del titular a actualizar/rectificar, (e) autorreportarse si está en desacuerdo.\n3. MEDIOS VÁLIDOS: comunicación escrita al domicilio, correo electrónico, mensaje de texto (con acuse), publicación en prensa (si no se conocen datos).\n4. PRUEBA: la entidad debe conservar evidencia del envío (acuse de recibo, certificación postal, log electrónico).\n\nCONSECUENCIA DE NO NOTIFICAR:\n• El reporte se considera inválido.\n• Sanción de la SIC (multa hasta 2000 SMMLV).\n• El titular puede exigir retiro inmediato y demandar perjuicios.\n\nEN NUESTRA PLATAFORMA: enviamos 3 recordatorios (a 15, 7 y 1 día antes del reporte) por WhatsApp + email + carta física, con acuse de recibo en la base de datos.',
    sinonimos: ['notificacion reporte negativo', '11 decreto 1738', 'aviso previo datacredito', '20 dias habiles', 'comunicacion previa reporte', 'autorreporte'],
  },

  // =====================================================
  // DATOS PERSONALES — Ley 1581 de 2012
  // =====================================================
  {
    id: 'JU-COL-060', categoria: 'DATOS_PERSONALES',
    pregunta: '¿Qué establece la Ley 1581 de 2012?',
    respuesta: 'LEY 1581 DE 2012 (Protección de Datos Personales, reglamentada por Decreto 1377/2013): ley marco para el tratamiento de datos personales en Colombia. PRINCIPIOS (Art. 4):\n1. LEGALIDAD — el tratamiento debe obedecer a una causa legal.\n2. FINALIDAD — informar al titular la finalidad específica.\n3. LIBERTAD — el tratamiento requiere autorización previa, expresa e informada del titular.\n4. VERACIDAD o CALIDAD — datos deben ser veraces y actualizados.\n5. TRANSPARENCIA — información clara y suficiente al titular.\n6. ACCESO Y RESTRICCIÓN CIRCUNSCRITA — solo personal autorizado.\n7. SEGURIDAD — medidas técnicas y administrativas adecuadas.\n8. CONFIDENCIALIDAD — obligación de mantener reserva.\n9. TEMPORALIDAD — solo por el tiempo necesario para la finalidad.\n\nDERECHOS ARCO+ (Art. 8):\n• Acceder a sus datos,\n• Rectificarlos,\n• Cancelarlos (oponerse al tratamiento),\n• Revocar la autorización.\n\nAUTORIDAD: Superintendencia de Industria y Comercio (SIC). SANCIONES: hasta 2000 SMMLV (Art. 23). En créditos, aplica a: (a) autorización de tratamiento de datos del cliente en el contrato, (b) conservación segura de cédula y datos personales, (c) política de privacidad publicada, (d) registro nacional de bases de datos (RNBD).',
    sinonimos: ['ley 1581', 'proteccion datos personales', 'derechos arco', '4 ley 1581', '8 ley 1581', 'sic datos personales', 'decreto 1377', 'autorizacion datos'],
  },
  {
    id: 'JU-COL-061', categoria: 'DATOS_PERSONALES',
    pregunta: '¿Cuándo se requiere autorización para tratar datos personales?',
    respuesta: 'AUTORIZACIÓN DE TRATAMIENTO (Ley 1581 de 2012, arts. 9-10, Decreto 1377/2013 arts. 5-9):\n\nREGLA GENERAL: Se requiere autorización PREVIA, EXPRESA e INFORMADA del titular para cualquier tratamiento de datos personales.\n\nDATOS SENSABLES (Art. 5 Decreto 1377): huellas, firma manuscrita, biometría facial, etc. — requieren autorización reforzada con finalidad expresa.\n\nEXCEPCIONES (Art. 10 Ley 1581):\n1. Información de dominio público.\n2. Datos de naturaleza pública.\n3. Casos de salud pública o emergencia médica.\n4. Tratamiento para cumplimiento de deberes legales.\n5. Investigación judicial o administrativa.\n6. Datos relacionados con registro civil.\n\nFORMA: puede ser verbal o escrita, pero debe ser CONSTATABILIZABLE (encontrable). En créditos, lo habitual es firmar un ANEXO DE AUTORIZACIÓN en el pagaré o contrato de mutuo. REVOCACIÓN: el titular puede revocar en cualquier momento, salvo obligación legal o contractual pendiente.\n\nSANCIONES por falta de autorización: hasta 2000 SMMLV por la SIC.',
    sinonimos: ['autorizacion datos personales', '9 ley 1581', '10 ley 1581', '5 decreto 1377', 'datos sensibles', 'revocacion autorizacion', 'autorizacion reforzada'],
  },
  {
    id: 'JU-COL-062', categoria: 'DATOS_PERSONALES',
    pregunta: '¿Qué es el Registro Nacional de Bases de Datos (RNBD)?',
    respuesta: 'REGISTRO NACIONAL DE BASES DE DATOS — RNBD (Art. 25 Ley 1581/2012, Decreto 1377/2013): registro público administrado por la Superintendencia de Industria y Comercio (SIC) que contiene la información de todas las bases de datos personales que operan en Colombia. OBLIGACIÓN: todo responsable o encargado que administre datos personales debe inscribir su base de datos en el RNBD. CONTENIDO DEL REGISTRO (Art. 25):\n1. Identificación del responsable.\n2. Finalidad de la base de datos.\n3. Características de los datos (sensibles o no).\n4. Medidas de seguridad implementadas.\n5. Políticas de tratamiento.\n6. Fecha de inicio de la base.\n7. Mecanismos para ejercicio de derechos ARCO.\n\nPLAZO: inscripción dentro de los 2 meses siguientes al inicio del tratamiento. ACTUALIZACIÓN: anual. SANCIONES: hasta 2000 SMMLV por no inscribirse. En la plataforma de créditos, el RNBD debe listar: (a) base de clientes, (b) base de codeudores, (c) base de usuarios internos, (d) base de conversaciones de chat, (e) base de audit logs.',
    sinonimos: ['rnbd', 'registro nacional bases de datos', '25 ley 1581', 'sic bases de datos', 'inscripcion rnbd', '2 meses inscripcion', 'actualizacion anual rnbd'],
  },

  // =====================================================
  // ESTATUTO DEL CONSUMIDOR — Ley 1480 de 2011
  // =====================================================
  {
    id: 'JU-COL-070', categoria: 'ESTATUTO_CONSUMIDOR',
    pregunta: '¿Qué protege el Estatuto del Consumidor?',
    respuesta: 'ESTATUTO DEL CONSUMIDOR (Ley 1480 de 2011): protege los derechos de los consumidores en relaciones de consumo en Colombia. ALCANCE: aplica a productores y expendedores de bienes y servicios (incluidos servicios financieros). DERECHOS DEL CONSUMIDOR (Art. 4):\n1. PROTECCIÓN contra riesgos para la vida, salud y seguridad.\n2. RECEPCIÓN de información suficiente, veraz y oportuna.\n3. PROTECCIÓN contra publicidad engañosa.\n4. LIBRE ELECCIÓN de bienes y servicios.\n5. ACCESO a mecanismos efectivos para reclamaciones.\n6. CALIDAD en bienes y servicios.\n7. PROTECCIÓN contractual — cláusulas abusivas son nulas (Art. 10).\n8. PROTECCIÓN de intereses económicos y sociales.\n\nCLÁUSULAS ABUSIVAS (Art. 10):\n• Las que priven al consumidor de derechos (Art. 12).\n• Las que inviertan carga de prueba en contra del consumidor.\n• Las que impongan renuncia a derechos del consumidor.\n• Las que limiten responsabilidad del productor.\n• Las que permitan modificación unilateral del contrato.\n\nAUTORIDAD: Superintendencia de Industria y Comercio (SIC). SANCIONES: hasta 2000 SMMLV por infracción. APLICA a créditos: contratos de mutuo, pagarés, cláusulas de intereses, comisiones y cargos.',
    sinonimos: ['estatuto consumidor', 'ley 1480', 'derechos del consumidor', '4 ley 1480', 'clausulas abusivas', '10 ley 1480', 'sic consumidor'],
  },
  {
    id: 'JU-COL-071', categoria: 'ESTATUTO_CONSUMIDOR',
    pregunta: '¿Cuáles son las cláusulas abusivas prohibidas?',
    respuesta: 'CLÁUSULAS ABUSIVAS (Ley 1480 de 2011, Arts. 10-12):\n\nSON NULAS DE PLENO DERECHO las cláusulas que:\n1. PREVIN al consumidor de derechos (Art. 12).\n2. LIMITEN o exoneren la responsabilidad del productor/expendedor.\n3. INVIERTAN la carga de la prueba en perjuicio del consumidor.\n4. IMPOSIBILITEN, dificulten o limiten el ejercicio de derechos.\n5. MODIFICACIÓN UNILATERAL del contrato por el productor sin causa justa.\n6. CONDICIONEN la renovación a aceptación tácita.\n7. FIJEN plazos de pago anticipado sin contraprestación.\n8. OBLIGUEN al consumidor a renunciar a la jurisdicción ordinaria.\n9. PERMITAN al productor resolver el contrato sin justa causa.\n10. CONTENGAN renuncia anticipada a reclamaciones.\n\nEJEMPLOS EN CRÉDITOS:\n• "El acreedor puede modificar la tasa de interés unilateralmente" — ABUSIVA.\n• "El deudor renuncia a reclamar intereses cobrados en exceso" — ABUSIVA.\n• "El acreedor puede exigir pago anticipado en cualquier momento" — ABUSIVA si no hay contraprestación.\n• "El deudor acepta cualquier cargo por mora" — ABUSIVA.\n\nSANCIONES: declaración de nulidad de la cláusula + multa hasta 2000 SMMLV. El contrato sigue vigente sin la cláusula abusiva.',
    sinonimos: ['clausulas abusivas', '10 ley 1480', '12 ley 1480', 'clausula nula', 'modificacion unilateral', 'renuncia derechos consumidor', 'carga de la prueba consumidor'],
  },

  // =====================================================
  // FINANCIERO — Estatuto Orgánico, Superfinanciera
  // =====================================================
  {
    id: 'JU-COL-080', categoria: 'FINANCIERO',
    pregunta: '¿Qué es el Estatuto Orgánico del Sistema Financiero?',
    respuesta: 'ESTATUTO ORGÁNICO DEL SISTEMA FINANCIERO (Decreto-Ley 663/1993, reformado por Decreto-Ley 2150/1995 y múltiples leyes): marco normativo que regula el sistema financiero colombiano. ESTRUCTURA: (1) BANCO DE LA REPÚBLICA — banco central, autónomo, regula política monetaria (Ley 31/1992); (2) SUPERINTENDENCIA FINANCIERA — vigilancia y control (antes Superintendencia Bancaria); (3) ESTABLECIMIENTOS DE CRÉDITO — bancos, corporaciones financieras, compañías de financiamiento, cooperativas de ahorro y crédito, microfinancieras; (4) SOCIEDADES DE SERVICIOS FINANCIEROS — fiduciarias, aseguradoras, corretaje de seguros; (5) INFRAESTRUCTURA — securities depositaries, bolsas. ENTIDADES VIGILADAS: 100+ en 2024. Para una empresa de microcrédito no vigilada por Superfinanciera, aplica la Ley 1520/2012 (microcrédito) y la regulación de la Superintendencia de Industria y Comercio.',
    sinonimos: ['estatuto organico financiero', 'decreto 663', 'sistema financiero colombia', 'banco republica', 'superfinanciera', 'establecimientos de credito', 'ley 31 banco republica'],
  },
  {
    id: 'JU-COL-081', categoria: 'FINANCIERO',
    pregunta: '¿Qué es la tasa bancaria corriente?',
    respuesta: 'TASA BANCARIA CORRIENTE (Resolución Externa 8/2000 del Banco de la República, modificada por Resolución Externa 4/2018): promedio simple de las tasas activas de los establecimientos de crédito para las modalidades de crédito de consumo y ordinario. PUBLICACIÓN: certificada mensualmente por la Superintendencia Financiera en el Diario Oficial (Res. Externa 8/2000 art. 2). IMPORTANCIA LEGAL:\n• Es la BASE para el cálculo del LÍMITE DE USURA (1.5× la tasa bancaria corriente, Art. 305 Código Penal).\n• Es la BASE para el LÍMITE DE INTERESES DE MICROCRÉDITO (Ley 1520/2012 art. 7, modificado por Ley 1731/2014 — interés máximo en microcrédito).\n• Se usa en JURISPRUDENCIA para liquidación de frutos civiles.\n\nVALORES RECIENTES (referencia):\n• 2023: ~18-19% EA → límite de usura: 27-28.5% EA.\n• 2024: ~17-18% EA → límite de usura: 25.5-27% EA.\n• Microcrédito: tasa específica certificada por Superfinanciera.\n\nACTUALIZACIÓN MENSUAL: el último día hábil del mes, con vigencia desde el primer día del mes siguiente. La Superintendencia Financiera publica la certificación.',
    sinonimos: ['tasa bancaria corriente', 'resolucion externa 8', 'resolucion externa 4 2018', 'limite usura', 'certificacion mensual', 'tasa activa promedio', '1.5 veces', 'superfinanciera tasa'],
  },
  {
    id: 'JU-COL-082', categoria: 'FINANCIERO',
    pregunta: '¿Qué es el microcrédito en Colombia?',
    respuesta: 'MICROCRÉDITO en Colombia (Ley 1520/2012, Ley 1731/2014, Circular Básica Jurídica Superfinanciera): modalidad de crédito dirigida a microempresarios y emprendedores de bajos ingresos. CARACTERÍSTICAS:\n• MONTO: hasta 25 SMMLV (aprox. $30 millones en 2024).\n• DESTINATARIOS: microempresas, personas naturales con actividad comercial.\n• TASA ESPECIAL: regulada por la Superintendencia Financiera — interés máximo de microcrédito (separado de la usura general). En 2024 está en ~38-43% EA.\n• DESTINO: capital de trabajo, activo fijo para microempresa.\n• EXENTO DE GMF (Gravamen a los Movimientos Financieros) en desembolsos.\n• NO REQUIERE PIGNERACIÓN de saldos si se otorga por entidad vigilada.\n\nENTIDADES AUTORIZADAS: bancos, compañías de financiamiento, microfinancieras (Banca de las Oportunidades), cooperativas con actividad de ahorro y crédito. Para una empresa de microcrédito privada NO vigilada, aplican límites del Código Civil (1.5× tasa bancaria corriente) y la regulación general del consumidor. Documentación mínima: cédula, soporte de actividad, código CIIU.',
    sinonimos: ['microcredito', 'ley 1520', 'ley 1731', '25 smmlv', 'interes microcredito', 'tasa microcredito', 'microempresa credito'],
  },

  // =====================================================
  // CONCURSAL — Ley 1116/2006
  // =====================================================
  {
    id: 'JU-COL-090', categoria: 'CONCURSAL',
    pregunta: '¿Qué es el proceso de reorganización empresarial?',
    respuesta: 'PROCESO DE REORGANIZACIÓN (Ley 1116/2006): mecanismo concursal para empresas en crisis de liquidez que pueden recuperarse. OBJETIVO: permitir a la empresa reestructurar sus pasivos y continuar operando. PROCEDIMIENTO:\n1. SOLICITUD: el deudor,acreedor o la Superintendencia de Sociedades la presenta.\n2. CAUSALES: incumplimiento de obligaciones por más de 90 días, o capital deficitario.\n3. ADMISIÓN: la Superintendencia de Sociedades la admite y nombra promotor + liquidador.\n4. RECONOCIMIENTO de créditos: los acreedores tienen 20 días para inscribirse.\n5. ACUERDO DE REORGANIZACIÓN: el deudor propone plan de pago; requiere mayoría de acreedores (mayoría simple de créditos reconocidos).\n6. HOMOLOGACIÓN: la Superintendencia aprueba el acuerdo.\n7. EJECUCIÓN: plazo hasta 10 años para pagar.\n\nEFECTOS: suspende ejecuciones individuales de acreedores. Acreedores quedan sujetos al acuerdo. NO aplica a entidades vigiladas por la Superintendencia Financiera (tienen régimen especial — Ley 1523/2012). En créditos a empresas en reorganización, el acreedor debe inscribirse en el proceso o pierde su derecho de ejecución individual.',
    sinonimos: ['reorganizacion empresarial', 'ley 1116', 'acuerdo reorganizacion', 'superintendencia sociedades', 'concurso acreedores', 'homologacion acuerdo', 'reestructuracion pasivos'],
  },
  {
    id: 'JU-COL-091', categoria: 'CONCURSAL',
    pregunta: '¿Qué es la liquidación judicial?',
    respuesta: 'LIQUIDACIÓN JUDICIAL (Ley 1116/2006, arts. 43-65): proceso concursal cuando la empresa no puede recuperarse y debe liquidarse. CAUSALES (Art. 44):\n1. Acuerdo de reorganización NO celebrado en plazo.\n2. Acuerdo NO homologado por Superintendencia.\n3. Incumplimiento del acuerdo.\n4. Pérdida de más del 50% del capital sin restablecimiento.\n5. Solicitud directa del deudor.\n6. Casos de insolvencia inminente.\n\nPROCEDIMIENTO:\n1. Declaración de liquidación por Superintendencia de Sociedades.\n2. INVENTARIO y AVALÚO de bienes.\n3. FORMACIÓN del inventario.\n4. LIQUIDACIÓN de bienes (venta).\n5. PAGO a acreedores según ORDEN DE PRELACIÓN:\n   • Costas del proceso.\n   • Gastos de administración.\n   • Créditos de primera clase (salarios, pensiones, fiscales).\n   • Créditos de segunda clase (proveedores por precio de venta).\n   • Créditos de tercera clase (hipotecarios y prendarios).\n   • Créditos de cuarta clase (sin garantía).\n6. EXTINCIÓN de la persona jurídica.\n\nEFECTOS: disolución de la sociedad, ejecuciones individuales suspendidas (se pagan en el proceso). En créditos a empresas en liquidación, el acreedor debe inscribirse en el proceso concursal.',
    sinonimos: ['liquidacion judicial', 'liquidacion sociedad', '43 ley 1116', 'prelacion creditos', 'superintendencia sociedades', 'quiebra', 'clases de creditos', 'primera segunda tercera cuarta clase'],
  },

  // =====================================================
  // GARANTÍAS MOBILIARIAS — Ley 1676/2013
  // =====================================================
  {
    id: 'JU-COL-100', categoria: 'GARANTIAS',
    pregunta: '¿Qué son las garantías mobiliarias en Colombia?',
    respuesta: 'GARANTÍAS MOBILIARIAS (Ley 1676/2013, reglamentada por Decreto 832/2014): régimen moderno de garantías sobre bienes muebles. Permite a deudores sin inmuebles garantizar créditos con maquinaria, inventarios, vehículos, semovientes, cuentas por cobrar, etc. CARACTERÍSTICAS:\n• BIENES QUE ACEPTAN GARANTÍA: muebles corporales (excepto dinero), muebles incorporales (créditos, IPs), semovientes, frutos pendientes.\n• FORMA DE CONSTITUCIÓN: contrato de garantía mobiliaria (escrito, sin necesidad de escritura pública salvo poderes).\n• PERFECCIONAMIENTO: inscripción en el REGISTRO NACIONAL DE GARANTÍAS MOBILIARIAS (RNGM), administrado por la Superintendencia de Industria y Comercio.\n• PRIORIDAD: por fecha y hora de inscripción (no por fecha de contrato).\n• EJECUCIÓN EXTRAJUDICIAL: el acreedor puede ejecutar la garantía sin necesidad de proceso judicial (Art. 38 Ley 1676), mediante venta directa, remate o adjudicación.\n• VENTAJA: agiliza el cobro y permite a PYMES acceder a crédito.\n\nEn operaciones de crédito con garantía mobiliaria, se debe:\n1. Firmar contrato de garantía mobiliaria.\n2. Inscribir en RNGM.\n3. Identificar los bienes (serial si aplica).\n4. Pactar mecanismo de ejecución.',
    sinonimos: ['garantias mobiliarias', 'ley 1676', 'decreto 832', 'garantia mueble', 'rngm', 'registro nacional garantias mobiliarias', 'ejecucion extrajudicial', 'garantia maquinaria'],
  },
  {
    id: 'JU-COL-101', categoria: 'GARANTIAS',
    pregunta: '¿Cómo se ejecuta una garantía mobiliaria?',
    respuesta: 'EJECUCIÓN DE GARANTÍA MOBILIARIA (Art. 38-46 Ley 1676/2013, Decreto 832/2014):\n\nPROCEDIMIENTO EXTRAJUDICIAL (Art. 38):\n1. NOTIFICACIÓN al deudor por escrito del incumplimiento.\n2. PLAZO de 15 días hábiles para que el deudor pague o entregue el bien.\n3. Si no paga, el acreedor puede elegir entre:\n   a) VENTA DIRECTA del bien a terceros (con avalúo previo).\n   b) REMATE PÚBLICO con publicación en periódico de circulación nacional, con edicto de 10 días.\n   c) ADJUDICACIÓN al acreedor (si no hay postor).\n4. LIQUIDACIÓN: el acreedor toma lo debido y entrega remanente al deudor. Si no alcanza, queda como quiénes por la diferencia (sin garantía personal adicional).\n\nVENTAJAS vs EJECUCIÓN JUDICIAL:\n• Más rápida (1-3 meses vs 12-24 meses).\n• Menos costosa.\n• No requiere abogado (pero recomendado).\n• Elimina riesgos de dilación procesal.\n\nREQUISITOS DE VALIDEZ:\n• Contrato inscrito en RNGM.\n• Notificación fehaciente al deudor.\n• Avalúo por perito (si el valor supera 50 SMMLV).\n• Publicación de remate.\n\nPROHIBICIONES (Art. 41): el acreedor no puede apropiarse del bien por debajo del 70% del avalúo, salvo aceptación del deudor.',
    sinonimos: ['ejecucion garantia mobiliaria', '38 ley 1676', 'venta directa garantia', 'remate bien mueble', 'adjudicacion acreedor', 'ejecucion extrajudicial garantia'],
  },

  // =====================================================
  // LABORAL — Código Sustantivo del Trabajo
  // =====================================================
  {
    id: 'JU-COL-110', categoria: 'LABORAL',
    pregunta: '¿Qué prestaciones sociales debo pagar a un empleado en Colombia?',
    respuesta: 'PRESTACIONES SOCIALES EN COLOMBIA (Código Sustantivo del Trabajo, Ley 50/1990, Ley 789/2002):\n\n1. CESANTÍAS (Art. 249 CST, Ley 50/1990): equivalente a 1 mes de salario por año trabajado. Consignación en fondo de cesantías antes del 14 de febrero del año siguiente.\n2. INTERESES DE CESANTÍAS (Art. 256 CST): 12% anual sobre cesantías, pagadas antes del 31 de enero.\n3. PRIMA DE SERVICIOS (Art. 255 CST, Ley 50/1990): 1 mes de salario al año, pagado en dos cuotas (junio 30 y diciembre 20).\n4. VACACIONES (Art. 186 CST): 15 días hábiles de descanso remunerado por cada 6 meses de trabajo (15 días por semestre). Pago en dinero solo al terminar el contrato.\n5. AUXILIO DE TRANSPORTE (no constitutivo de salario, Art. 18 Ley 278/1996): para salarios hasta 2 SMMLV.\n6. SEGUROS DE SALUD (EPS): 8.5% del salario (12.5% para independientes), empleado paga 4%, empleador 8.5% (salario integral: 70% salario + 30% prestaciones).\n7. PENSIÓN (Art. 17 Ley 100/1993): empleado 4%, empleador 12% (2024: 8% y 16% progresivo).\n8. ARL (Riesgos Laborales): 0.522% a 6.96% según nivel de riesgo.\n9. PARAFISCALES: SENA 2%, ICBF 3%, Caja de Compensación 4% (exonerados para salarios < 10 SMMLV por Ley 1607/2012).\n\nBASE DE CÁLCULO: salario ordinario + factores salariales (recargos, comisiones, etc.). NO incluye auxilio de transporte.',
    sinonimos: ['prestaciones sociales', 'cesantias', 'intereses cesantias', 'prima servicios', 'vacaciones', 'auxilio transporte', 'eps', 'pension', 'arl', 'parafiscales', 'cst'],
  },
  {
    id: 'JU-COL-111', categoria: 'LABORAL',
    pregunta: '¿Cómo se liquida un contrato de trabajo en Colombia?',
    respuesta: 'LIQUIDACIÓN DE CONTRATO DE TRABAJO en Colombia:\n\nCONCEPTOS A PAGAR:\n1. SALARIO pendiente hasta fecha de retiro.\n2. CESANTÍAS proporcionales al tiempo trabajado en el año (1 mes / 360 días × días trabajados).\n3. INTERESES DE CESANTÍAS (12% anual sobre cesantías proporcionales).\n4. PRIMA proporcional (1 mes / 360 días × días trabajados).\n5. VACACIONES acumuladas no disfrutadas (15 días / 360 días × días trabajados, en dinero).\n6. BONIFICACIONES y comisiones pendientes (si aplican).\n7. AJUSTE SALARIAL pendiente (si hubo incremento no aplicado).\n\nINDMNIZACIÓN POR DESPIDO SIN JUSTA CAUSA (Ley 50/1990 art. 64):\n• Trabajadores con MENOS de 10 años: 15 días de salario por año trabajado y fracción.\n• Trabajadores con 10+ años (régimen anterior Ley 50/1990): 20 días de salario por año.\n• Despido colectivo (Ley 789/2002 art. 67): adicional 5 días de salario por mes de anticipación.\n\nDESPIDO CON JUSTA CAUSA (Art. 62 CST): el empleador no paga indemnización, pero SÍ debe pagar prestaciones sociales causadas.\n\nPLAZO DE PAGO: dentro de los 60 días siguientes al retiro. Si el empleador no paga, el trabajador puede demandar.',
    sinonimos: ['liquidacion contrato trabajo', 'prestaciones liquidacion', 'indemnizacion despido', '64 ley 50', '62 cst despido justa causa', 'cesantias proporcionales', '15 dias ano', 'despido sin justa causa'],
  },

  // =====================================================
  // TRIBUTARIO — Estatuto Tributario
  // =====================================================
  {
    id: 'JU-COL-120', categoria: 'TRIBUTARIO',
    pregunta: '¿Qué impuestos aplica a una empresa de créditos en Colombia?',
    respuesta: 'IMPUESTOS APLICABLES A EMPRESA DE CRÉDITOS EN COLOMBIA (Estatuto Tributario):\n\n1. IMPUESTO SOBRE LA RENTA (Art. 1 ET, Ley 1819/2016, Ley 2010/2019, Ley 2150/2021):\n   • TASA 2024: 35% sobre utilidad.\n   • Base: ingresos menos costos y deducciones.\n   • Renta presuntiva: eliminada desde 2019.\n   • Anticipo de renta: 25% del impuesto del año anterior (cuotas: junio y septiembre).\n\n2. IMPUESTO AL VALOR AGREGADO — IVA (Art. 420 ET):\n   • SERVICIOS FINANCIEROS: excluidos de IVA (Art. 476 num. 3 ET) — no se cause IVA en intereses.\n   • Operaciones de crédito no generan IVA, salvo comisiones específicas (servicios accesorios como avalúos, estudios de título).\n\n3. INDUSTRIA Y COMERCIO — ICA (Decreto Ley 1333/1986, acuerdos municipales):\n   • Tasa: 0.4% a 1.1% sobre ingresos brutos (varía por municipio y actividad).\n   • Actividad financiera: tarifa especial (Bogotá: 0.4 x 1000 sobre ingresos operacionales).\n   • Pago trimestral.\n\n4. GRAVAMEN A LOS MOVIMIENTOS FINANCIEROS — GMF (Ley 488/1998 art. 30):\n   • 4 x 1000 sobre transacciones financieras (retiros, transferencias, cheques).\n   • Exonerado: microcrédito Ley 1520/2012, créditos de fomento, transacciones de compensación interbancaria.\n\n5. RETENCIONES EN LA FUENTE (Estatuto Tributario art. 365):\n   • Honorarios: 10-11%.\n   • Comisiones: 11%.\n   • Arrendamientos: 3.5%.\n   • Servicios: 4-6% (varía).\n   • Compras: 2.5%.\n\n6. RETEFUENTE EMPLEADOS: tabla progresiva (Art. 383 ET).',
    sinonimos: ['impuestos empresa credito', 'estatuto tributario', 'impuesto renta', 'iva servicios financieros', 'ica', 'gmf', '4 x 1000', 'retencion en la fuente', 'ley 1819', 'ley 2150'],
  },

  // =====================================================
  // COBRANZA — Reglamentación
  // =====================================================
  {
    id: 'JU-COL-130', categoria: 'COBRANZA',
    pregunta: '¿Qué regula la actividad de cobranza en Colombia?',
    respuesta: 'REGULACIÓN DE COBRANZA EN COLOMBIA:\n\n1. LEY 1266/2008 (Habeas Data): regula el reporte a centrales de información. Requisitos: notificación previa (20 días hábiles), plazo máximo de permanencia (2-8 años según cuantía), retiro al pago. Aplica a TODO reporte, sin importar la entidad.\n2. LEY 1480/2011 (Estatuto del Consumidor): prohíbe cobranzas abusivas (Art. 47). Prácticas prohibidas: llamadas a horas intempestivas (antes de 7am y después de 8pm), contacto a terceros sin autorización, acosos reiterativos, simulación de acciones judiciales.\n3. LEY 1581/2012 (Protección de Datos): el deudor debe autorizar el tratamiento de sus datos para cobranza. Si revoca, el acreedor solo puede usar datos mínimos para iniciar proceso judicial.\n4. CIRCULAR BÁSICA JURÍDICA SUPERFINANCIERA (Parte I, Título IV, Capítulo VII): para entidades vigiladas. Establece protocolos de cobranza, horarios, canales, manejo de información.\n5. CÓDIGO DE POLICÍA (Ley 1801/2016): prohíbe el acoso en actividades de cobranza (Art. 27). Sanciones: multas hasta 4 SMMLV.\n6. DECRETO 2150/1995: suprimió requisitos para establecimientos de cobranza, pero las prácticas siguen reguladas.\n\nEN NUESTRA PLATAFORMA: cobro persuasivo en horario 8am-6pm, máx. 3 contactos por semana, sin contacto a terceros sin autorización, sin simulación de acciones judiciales, registro de todas las gestiones en auditoría.',
    sinonimos: ['regulacion cobranza', 'ley 1266 cobranza', 'estatuto consumidor cobranza', 'cobranza abusiva', 'horario cobranza', 'circular basica juridica', 'codigo policia cobro', 'acoso cobranza'],
  },
  {
    id: 'JU-COL-131', categoria: 'COBRANZA',
    pregunta: '¿Cómo se hace un requerimiento prejurídico en Colombia?',
    respuesta: 'REQUERIMIENTO PREJURÍDICO en Colombia (acto administrativo privado previo a demanda ejecutiva):\n\nESTRUCTURA (mejor práctica):\n1. ENCABEZADO: fecha, ciudad, destinatario (deudor) con datos completos.\n2. ANTECEDENTES: identificación del contrato/pagaré, fecha, monto, plazo, codeudores.\n3. ESTADO ACTUAL: saldo deudor detallado (capital + intereses corrientes + intereses moratorios + costas).\n4. INCUMPLIMIENTO: fecha de mora, días transcurridos, cuotas vencidas.\n5. REQUERIMIENTO FORMAL: requerir pago en plazo razonable (mínimo 8 días hábiles — Art. 88 CPC, hoy CGP).\n6. ADVERTENCIA LEGAL: avisar que de no pagarse, se iniciará PROCESO EJECUTIVO con medidas cautelares (embargo de bienes, retención de saldos, secuestro).\n7. ADVERTENCIA DE REPORTE: notificación de reporte a centrales de información (Datacrédito, Cifin) — requisito de Ley 1266/2008 art. 11.\n8. OFERTA DE ACUERDO: opción de acuerdo de pago o refinanciación.\n9. FIRMA del acreedor o representante legal.\n10. MEDIOS DE ENVÍO: carta física certificada (con acuse de recibo), correo electrónico (con acuse), WhatsApp (con acuse), notaría (acta notarial).\n\nPLAZO LEGAL: el Código Civil no fija mínimo, pero jurisprudencia exige plazo razonable. Práctica: 8-15 días hábiles. CONSECUENCIA: si no se hace, la demanda ejecutiva puede considerarse temeraria y la procedencia de medidas cautelares se ve afectada.',
    sinonimos: ['requerimiento prejuridico', 'carta cobro prejuridico', 'intimacion pago', 'aviso demanda', '8 dias requerimiento', 'notificacion prejuridica', 'acuse recibo requerimiento'],
  },
  {
    id: 'JU-COL-132', categoria: 'COBRANZA',
    pregunta: '¿Cómo se redacta una demanda ejecutiva en Colombia?',
    respuesta: 'DEMANDA EJECUTIVA (Art. 421-425 CGP — Ley 1564/2012):\n\nREQUISITOS FORMALES (Art. 421 CGP):\n1. DEMANDANTE: nombre, identificación, domicilio, abogado (con poder).\n2. DEMANDADO: nombre, identificación, domicilio.\n3. HECHOS: narración clara y cronológica del origen de la obligación y el incumplimiento.\n4. FUNDAMENTOS DE DERECHO: normas sustanciales aplicables (Código Civil arts. 1551, 1601, 2536; Código de Comercio arts. 709 y ss. para pagaré; CGP arts. 420-433).\n5. PRETENSIONES: (a) pago del capital, (b) intereses moratorios, (c) costas del proceso.\n6. CUANTÍA: valor exacto en pesos (determina competencia).\n7. ANEXOS: título ejecutivo (pagaré original), poder, prueba de representación, prueba de notificación previa, certificado de existencia y representación si demanda sociedad.\n8. PRUEBAS: documental (pagaré), testimonios, peritajes si aplica.\n9. MEDIDAS CAUTELARES solicitadas (Art. 423 CGP): embargo, secuestro, retención.\n\nCOMPETENCIA (Art. 16 CGP):\n• Cuantía menor a 40 SMMLV: juez municipal pequeño.\n• 40-150 SMMLV: juez municipal.\n• Mayor a 150 SMMLV: juez civil del circuito.\n\nPROCEDIMIENTO:\n1. Presentación de demanda.\n2. Admisión o inadmisión (3 días).\n3. Mandamiento de pago (5 días al deudor).\n4. Excepciones (10 días).\n5. Práctica de pruebas.\n6. Sentencia (1a instancia).\n7. Apelación (2a instancia).\n8. Ejecución de sentencia.',
    sinonimos: ['demanda ejecutiva', '421 cgp', '425 cgp', 'mandamiento de pago', 'excepciones', 'pretensiones', 'anexos demanda', 'competencia civil', 'juez circuito municipal'],
  },

  // =====================================================
  // JURISPRUDENCIA CLAVE
  // =====================================================
  {
    id: 'JU-COL-140', categoria: 'JURISPRUDENCIA',
    pregunta: '¿Qué dice la Corte Suprema sobre intereses moratorios?',
    respuesta: 'JURISPRUDENCIA CORTE SUPREMA DE JUSTICIA — SALA DE CASACIÓN CIVIL sobre INTERESES MORATORIOS:\n\n1. SENTENCIA SC5215/2013 (10 julio 2013, M.P. Ariel Salazar Ramírez): estableció que los intereses moratorios se causan automáticamente por el solo vencimiento (mora ex re, Art. 1601 Código Civil) sin necesidad de interpelación. Aplica a obligaciones a plazo determinado.\n\n2. SENTENCIA SC2578/2014 (28 mayo 2014): confirmó que los intereses moratorios son INDEPENDIENTES de los intereses corrientes — pueden acumularse. El deudor en mora paga intereses corrientes (compensatorios) + moratorios.\n\n3. SENTENCIA SC2846/2015 (29 julio 2015): precisó que la cláusula de intereses moratorios superior al 1.5× tasa bancaria corriente ES NULA por usura (Art. 305 Código Penal, Art. 1524 Código Civil). La nulidad no afecta la obligación principal.\n\n4. SENTENCIA SC3541/2017 (9 mayo 2017): aclaró que la capitalización de intereses (anatocismo) está PROHIBIDA en Colombia salvo pacto expreso (Art. 7 Ley 1520/2012 para microcrédito, Código de Comercio art. 1163 para entidades vigiladas). El anatocismo no consentido genera enriquecimiento sin causa.\n\n5. SENTENCIA SC4567/2019 (26 junio 2019): en obligaciones con cláusula penal moratoria + intereses moratorios, NO pueden acumularse si exceden el 1.5× tasa bancaria corriente. La Corte recomienda aplicar el límite usura al total de intereses cargados.\n\nAPLICACIÓN PRÁCTICA: para cobro de cartera, se liquidan intereses corrientes pactados + intereses moratorios (limitados al 1.5× tasa bancaria corriente), sin capitalización de intereses.',
    sinonimos: ['jurisprudencia intereses moratorios', 'corte suprema intereses', 'mora ex re sentencia', 'anatocismo colombia', 'capitalizacion intereses prohibida', 'usura sentencia', '1163 codigo comercio'],
  },
  {
    id: 'JU-COL-141', categoria: 'JURISPRUDENCIA',
    pregunta: '¿Qué dice la Corte Constitucional sobre el derecho al mínimo vital en cobranzas?',
    respuesta: 'JURISPRUDENCIA CORTE CONSTITUCIONAL sobre MÍNIMO VITAL y COBRANZAS:\n\n1. SENTENCIA T-098/2001 (M.P. Eduardo Montealegre Lynett): estableció que el embargo de salarios que afecte el mínimo vital del trabajador y su familia ES INCONSTITUCIONAL. Aplica el Art. 59 CST (solo embargable el 20% del salario, el mínimo es inembargable). El juez debe proteger el mínimo vital.\n\n2. SENTENCIA T-590/1998: el embargo de cuentas de ahorros donde se recibe el salario, que afecta el mínimo vital, ES INCONSTITUCIONAL. La entidad financiera debe oponerse al embargo.\n\n3. SENTENCIA T-443/2016: en procesos ejecutivos, el juez debe verificar que el embargo no afecte el mínimo vital del deudor. Si lo afecta, debe reducirlo o levantarlo.\n\n4. SENTENCIA T-292/2006: el reporte negativo a centrales de información, si vulnera el mínimo vital o derechos fundamentales, puede ser objeto de tutela.\n\n5. SENTENCIA T-1103/2015 (M.P. María Victoria Calle Correa): la renegociación de cartera es una obligación constitucional cuando el deudor demuestra imposibilidad de pago que afecta su mínimo vital. Las entidades financieras deben ofrecer mecanismos de solución.\n\n6. SENTENCIA T-086/2018: la inclusión de cláusulas abusivas en contratos de crédito que afecten consumidores vulnerables puede ser objeto de acción de tutela cuando no hay otros medios de defensa.\n\nAPLICACIÓN PRÁCTICA: en cobro judicial, el abogado debe:\n• Verificar que el embargo no afecte el mínimo vital del deudor.\n• Ofrecer mecanismos de renegociación antes de demandar.\n• Aceptar acuerdos de pago razonables.\n• Documentar todas las gestiones de cobro persuasivo.',
    sinonimos: ['jurisprudencia minimo vital', 'corte constitucional cobranza', 't-098 2001', 't-590 1998', 'embargo salario minimo vital', 'tutela reporte negativo', 'renegociacion cartera', 't-292 2006'],
  },

  // =====================================================
  // ASPECTOS PRÁCTICOS — OPERATIVOS
  // =====================================================
  {
    id: 'JU-COL-150', categoria: 'PRACTICO',
    pregunta: '¿Cómo se calculan los intereses moratorios en Colombia?',
    respuesta: 'CÁLCULO DE INTERESES MORATORIOS en Colombia:\n\nFÓRMULA GENERAL:\nIntereses moratorios = (Saldo deudor × tasa moratoria diaria × días de mora)\n\nTASA MORATORIA:\n1. Si está PACTADA en el contrato/pagaré: aplica la pactada, PERO sin exceder el LÍMITE LEGAL (1.5× tasa bancaria corriente — Art. 305 Código Penal, Ley 1450/2011).\n2. Si NO está pactada: aplica la tasa legal moratoria = interés legal civil = 6% anual (Art. 1557 Código Civil, rara vez aplicado, jurisprudencia prefiere tasa bancaria corriente).\n3. En MICROCRÉDITO (Ley 1520/2012): tasa moratoria máxima certificada por Superfinanciera (separada de usura general, ~38-43% EA en 2024).\n\nCÁLCULO PASO A PASO:\n1. Saldo deudor al momento del vencimiento.\n2. Convertir tasa EA a diaria: tasa_diaria = (1 + EA)^(1/365) - 1.\n3. Multiplicar: saldo × tasa_diaria × días_mora.\n4. Sumar al capital pendiente.\n\nEJEMPLO:\n• Saldo: $1,000,000.\n• Tasa moratoria pactada: 24% EA (dentro del límite usura).\n• Tasa diaria: (1.24)^(1/365) - 1 = 0.0005879.\n• Días mora: 60.\n• Intereses moratorios: $1,000,000 × 0.0005879 × 60 = $35,274.\n• Total a cobrar: $1,035,274.\n\nPROHIBICIÓN: NO se pueden capitalizar intereses (anatocismo) salvo pacto expreso. En microcrédito está permitido por Ley 1520/2012 art. 7. En créditos ordinarios, la capitalización requiere pacto expreso y dentro del límite de usura.',
    sinonimos: ['calculo intereses moratorios', 'tasa moratoria', 'interes diario', 'formula interes mora', '1.5 tasa bancaria corriente', 'limite usura', 'anatocismo prohibido', 'capitalizacion interes'],
  },
  {
    id: 'JU-COL-151', categoria: 'PRACTICO',
    pregunta: '¿Cómo se redacta una carta de cobro persuasivo?',
    respuesta: 'CARTA DE COBRO PERSUASIVO (etapa prejurídica temprana, antes del requerimiento formal):\n\nESTRUCTURA RECOMENDADA:\n1. ENCABEZADO: logo de la empresa, fecha, datos del cliente.\n2. SALUDO cordial y respetuoso (usar nombre completo del cliente).\n3. REFERENCIA: número de obligación, código del solicitud.\n4. ESTADO DE LA OBLIGACIÓN: saldo actual, fecha del último pago, cuotas vencidas (con días de mora si aplica).\n5. RECORDATORIO DE PAGO: mención del compromiso adquirido, importancia de mantener al día.\n6. OFERTA DE AYUDA: opciones de pago (pago total, acuerdo de pago, refinanciación, plan de pagos).\n7. CONSECUENCIAS LEGALES (sin amenazas): mención de que el incumplimiento puede generar (a) intereses moratorios, (b) reporte a centrales de información (previa notificación legal), (c) acciones judiciales.\n8. LLAMADO A LA ACCIÓN: invitación a contactar lo antes posible.\n9. CANALES DE CONTACTO: WhatsApp, teléfono, email, oficina física.\n10. AGRADECIMIENTO y firma.\n\nRECOMENDACIONES:\n• Tono respetuoso, no amenazante (Ley 1480/2011 prohíbe cobranza abusiva).\n• Claridad en cifras (no usar jerga técnica innecesaria).\n• Personalización (nombre del cliente, no genérico).\n• Sin horas intempestivas (envío en horario laboral).\n• Cumplir Ley 1581/2012 (autorización previa para tratamiento de datos).\n• Registro de envío en auditoría (con acuse de recibo).\n• Máximo 3 contactos por semana (Circular Básica Jurídica Superfinanciera).\n\nPLANTILLAS DISPONIBLES: la plataforma tiene plantillas automáticas para 3 etapas (recordatorio amigable, requerimiento prejurídico, notificación de reporte).',
    sinonimos: ['carta cobro persuasivo', 'recordatorio pago', 'carta cobranza', 'plantilla cobro', 'cobro amable', 'ley 1480 cobranza', 'tone cobranza'],
  },
  {
    id: 'JU-COL-152', categoria: 'PRACTICO',
    pregunta: '¿Qué documentos debo conservar de un solicitud?',
    respuesta: 'DOCUMENTOS A CONSERVAR DE UN SOLICITUD (término legal y operativo):\n\nDOCUMENTOS OBLIGATORIOS:\n1. PAGARÉ original firmado (5 años — Art. 2537 Código Civil, prescripción de título ejecutivo). Conservar hasta 5 años después del pago total por si hay reclamación.\n2. CONTRATO DE MUTUO firmado (5 años después del pago total).\n3. IDENTIFICACIÓN del cliente (cédula escaneada, selfie con cédula) — Ley 1581/2012: 10 años después de terminada la relación.\n4. AUTORIZACIÓN DE TRATAMIENTO DE DATOS PERSONALES (mientras dure el tratamiento + 5 años).\n5. AUTORIZACIÓN DE REPORTE A CENTRALES (mientras dure el reporte).\n6. COMPROBANTE DE PAGOS (recibos, soportes): 5 años (término prescripción ordinaria).\n7. SOLICITUD DE SOLICITUD (con datos del cliente).\n8. VERIFICACIÓN DE IDENTIDAD (foto, OTP, biometría).\n9. ESTUDIO DE CRÉDITO (análisis de capacidad de pago, referencias).\n10. CODEUDOR (mismos documentos que el cliente).\n11. CORRESPONDENCIA: requerimientos, cartas, emails, WhatsApp (5 años).\n12. AUDIT LOG de la plataforma (memoria del sistema).\n\nDOCUMENTOS ADICIONALES SI APLICA:\n• Garantía mobiliaria: contrato inscrito en RNGM (conservar mientras dure la garantía).\n• Garantía hipotecaria: escritura pública, certificado de tradición.\n• Póliza de seguro: copia mientras dure.\n• Otrosí o modificación: mientras dure la obligación.\n\nFORMATO: digital (PDF firmado electrónicamente) o físico. La Ley 527/1999 reconoce validez jurídica al documento electrónico. La plataforma genera y conserva todos los documentos automáticamente en la base de datos con copia de seguridad.\n\nLEY 1581/2012: los datos personales deben eliminarse al terminar la finalidad del tratamiento (salvo obligación legal de conservación). La autorización para cobranza y central de información puede mantenerse hasta 5 años después del pago.',
    sinonimos: ['documentos prestamo conservar', 'pagare original', '5 anos conservacion', 'ley 1581 conservacion', 'documentos legales credito', 'archivo documental', 'tiempo retencion documentos'],
  },

  // =====================================================
  // ANTI-LAVADO DE ACTIVOS — SARLAFT
  // =====================================================
  {
    id: 'JU-COL-160', categoria: 'SARLAFT',
    pregunta: '¿Qué es el SARLAFT y aplica a empresas de crédito?',
    respuesta: 'SARLAFT — SISTEMA DE ADMINISTRACIÓN DEL RIESGO DE LAVADO DE ACTIVOS Y FINANCIAMIENTO DEL TERRORISMO (Circular Básica Jurídica Superfinanciera, Parte I, Título IV, Capítulo IV):\n\nAPLICA A:\n• Entidades vigiladas por la Superintendencia Financiera (bancos, compañías de financiamiento, microfinancieras vigiladas).\n• SARLAFT (Decreto 3196/2004, Circular Externa 029/2014).\n• SAGRILAFT (Sistema de Autocontrol y Gestión del Riesgo de LA/FT) para entidades no vigiladas pero con riesgo (Recomendación Superintendencia de Sociedades, Circular 100-000002 de 2018).\n\nCOMPONENTES MÍNIMOS:\n1. IDENTIFICACIÓN del cliente (KYC — Know Your Customer): cédula, activity CIIU, origen de fondos.\n2. IDENTIFICACIÓN DEL RIESGO: evaluación del cliente (bajo, medio, alto).\n3. MEDIDAS DE DEBIDA DILIGENCIA (DD): ampliadas para clientes de alto riesgo (PEP — personas expuestas públicamente, transacciones inusuales).\n4. MONITOREO: detectar transacciones inusuales (mayor a las esperadas para el perfil del cliente).\n5. REPORTES: reporte de operaciones sospechosas (ROS) a UIAF (Unidad de Información y Análisis Financiero) en plazos de 10 días.\n\nPARA EMPRESA DE MICROCRÉDITO NO VIGILADA:\n• Aplica la Resolución 100-000002/2018 de la Superintendencia de Sociedades: adoptar SAGRILAFT.\n• Reportes a UIAF: obligatorios (Ley 526/1999, Decreto 663/1993 art. 102).\n• Sanciones por incumplimiento: hasta 500 SMMLV (Ley 1581/2012 art. 23).\n\nEN NUESTRA PLATAFORMA: implementamos verificación de listas restrictivas (Listas Clinton, ONU, OFAC), identificación de PEP, monitoreo de transacciones superiores a $10,000,000 (10 SMMLV), reportes mensuales a UIAF si aplica.',
    sinonimos: ['sarlaft', 'sagrilaft', 'lavado activos', 'financiamiento terrorismo', 'uiaf', 'kyc', 'debida diligencia', 'pep', 'lista restrictiva', 'ros', 'superfinanciera sarlaft'],
  },
  {
    id: 'JU-COL-161', categoria: 'SARLAFT',
    pregunta: '¿Qué es la UIAF en Colombia?',
    respuesta: 'UIAF — UNIDAD DE INFORMACIÓN Y ANÁLISIS FINANCIERO (Ley 526/1999, Decreto 3196/2004): entidad del Estado colombiano encargada de recibir, analizar y difundir información para prevenir y detectar el lavado de activos y el financiamiento del terrorismo.\n\nFUNCIONES PRINCIPALES (Ley 526/1999 art. 3):\n1. RECIBIR reportes de operaciones sospechosas (ROS) de entidades obligadas.\n2. ANALIZAR información para detectar patrones de lavado.\n3. DIFUNDIR reportes a la Fiscalía General de la Nación cuando haya indicios de delito.\n4. COORDINAR con otras autoridades (Superintendencia Financiera, Fiscalía, Dijin, etc.).\n5. IMPONER sanciones por incumplimiento.\n6. EMITIR directrices y lineamientos para entidades obligadas.\n\nENTIDADES OBLIGADAS A REPORTAR (Resolución 100-000002/2018 Superintendencia de Sociedades):\n• Entidades financieras vigiladas por Superfinanciera.\n• Sociedades no vigiladas que realicen actividades financieras (incluida microfinancieras no vigiladas).\n• Notarías, sociedades de capital privado, casinos, etc.\n\nTIPOS DE REPORTE:\n1. REPORTE DE OPERACIONES SOSPECHOSAS (ROS): transacciones inusuales con indicios de lavado. Plazo: 10 días hábiles desde la detección.\n2. REPORTE DE OPERACIONES DE REGISTRO (ROR): transacciones que superen umbral establecido (generalmente $10,000,000 - ~10 SMMLV). Plazo: mensual.\n3. REPORTE DE OPERACIONES EN EFECTIVO (ROE): para transacciones en efectivo superiores a $10,000 USD.\n\nSANCIONES por no reportar: hasta 500 SMMLV y responsabilidad penal (Art. 32 Ley 1907/2018 — omitir reporte).',
    sinonimos: ['uiaf', 'unidad informacion analisis financiero', '526 ley 1999', 'ros', 'ror', 'roe', 'reporte operaciones sospechosas', '10 smmlv reporte', 'sancion no reportar'],
  },

  // =====================================================
  // NORMATIVIDAD ADICIONAL
  // =====================================================
  {
    id: 'JU-COL-170', categoria: 'NORMATIVIDAD',
    pregunta: '¿Qué dice la Ley 1731/2014 sobre tasas de interés?',
    respuesta: 'LEY 1731 DE 2014: modificó el régimen de tasas de interés en microcrédito en Colombia. PRINCIPALES CAMBIOS:\n\n1. MODIFICACIÓN de la Ley 1520/2012 art. 7: estableció que el INTERÉS MÁXIMO en microcrédito es determinado trimestralmente por la Superintendencia Financiera, separado del régimen general de usura.\n\n2. CÁLCULO del límite: promedio ponderado de la tasa activa de microcrédito de los establecimientos de crédito, multiplicado por 1.5.\n\n3. CERTIFICACIÓN trimestral (no mensual como la usura general). Publicación en el Diario Oficial.\n\n4. ANATOCISMO (capitalización de intereses): PERMITIDO en microcrédito, previo pacto expreso (Ley 1520/2012 art. 7, modificado por Ley 1731/2014).\n\n5. MICROCRÉDITO DEFINIDO (Ley 1520/2012 art. 2): créditos a microempresas o personas naturales con actividad comercial, monto hasta 25 SMMLV.\n\n6. EXENCIÓN GMF (Gravamen a Movimientos Financieros): en desembolsos de microcrédito por entidades vigiladas (Ley 1520/2012 art. 5).\n\nIMPACTO EN PLATAFORMA: si la plataforma otorga microcrédito (mujeres emprendedoras, pequeños comercios), puede acogerse a este régimen. Si otorga crédito de consumo general, aplica el régimen de usura general (1.5× tasa bancaria corriente). La distinción es importante para cumplir límites legales.',
    sinonimos: ['ley 1731', 'interes microcredito', '1520 ley 2012', 'limite microcredito', 'anatocismo permitido', 'tasa activa microcredito', 'superfinanciera certificacion trimestral'],
  },
  {
    id: 'JU-COL-171', categoria: 'NORMATIVIDAD',
    pregunta: '¿Qué dice la Ley 1520/2012?',
    respuesta: 'LEY 1520 DE 2012 (Régimen de microcrédito):\n\nARTÍCULO PRINCIPAL: regula el microcrédito como modalidad específica de crédito en Colombia, dirigida a microempresas y personas naturales con actividad comercial.\n\nDISPOSICIONES CLAVE:\n\n1. ART. 2 — DEFINICIÓN: microcrédito es el crédito destinado a financiar actividades de microempresas o personas naturales, con monto hasta 25 SMMLV (aprox. $30 millones en 2024).\n\n2. ART. 7 (modificado por Ley 1731/2014) — TASA DE INTERÉS: el interés máximo en microcrédito es determinado trimestralmente por la Superintendencia Financiera. Permite anatocismo (capitalización de intereses) previo pacto expreso.\n\n3. ART. 5 — EXENCIÓN GMF: los desembolsos de microcrédito por entidades vigiladas están exentos del Gravamen a los Movimientos Financieros (4 x 1000).\n\n4. ART. 8 — DESTINO: capital de trabajo, activo fijo, capitalización de microempresa. NO para consumo personal del deudor.\n\n5. ART. 10 — BIENES: no se requiere pignoración de saldos ni de bienes para otorgar microcrédito (simplificación de garantías).\n\n6. ART. 11 — SEGREGACIÓN: las entidades vigiladas deben segregar las operaciones de microcrédito en su contabilidad y reportes.\n\n7. ART. 13 — GARANTÍAS: se permiten garantías reales y personales, pero se incentiva el uso de garantías personales y avales.\n\n8. ART. 14 — PAGOS ANTICIPADOS: el deudor puede pagar anticipadamente sin penalidad.\n\n9. ART. 15 — REFINANCIACIÓN: se permite refinanciación de microcrédito, sin que pierda su carácter.\n\n10. ART. 19 — INCUMPLIMIENTO: el incumplimiento del pago da lugar a intereses moratorios dentro del límite legal.\n\nAPLICA A: entidades vigiladas por Superfinanciera Y a entidades no vigiladas que realicen microcrédito (régimen subsidiario). En nuestra plataforma, si otorgamos microcrédito, aplicamos este régimen + la regulación general del consumidor.',
    sinonimos: ['ley 1520', 'microcredito colombia', '25 smmlv', '7 ley 1520', '5 ley 1520', 'gmf microcredito', 'destino microcredito', 'anatocismo pacto'],
  },
  {
    id: 'JU-COL-172', categoria: 'NORMATIVIDAD',
    pregunta: '¿Qué es la Ley 1450 de 2011 (Ley Anti-Trámite)?',
    respuesta: 'LEY 1450 DE 2011 (Ley Anti-Trámite): reformó múltiples sectores para simplificar trámites y combatir prácticas abusivas. En materia financiera y de cobranza, los ARTÍCULOS MÁS RELEVANTES:\n\n1. ART. 305 — USURA: reformuló el delito de usura del Código Penal, estableciendo que el límite es 1.5× la tasa bancaria corriente certificada mensualmente por la Superintendencia Financiera. Antes era 1.5× la tasa de interés bancario corriente. Estableció pena de 2 a 6 años de prisión y multa hasta 200 SMMLV.\n\n2. ART. 109 — INSCRIPCIÓN EN EL RNBD: las entidades deben inscribir sus bases de datos en el Registro Nacional de Bases de Datos (SIC).\n\n3. ART. 132 — VENTANILLA ÚNICA: creación de ventanillas únicas para trámites ante el Estado.\n\n4. ART. 134 — RÉGIMEN DE INHABILIDADES: amplió causales de inhabilidad para ejercer comercio.\n\n5. ART. 47 — PROHIBICIÓN DE COBROS ABUSIVOS (modificó Ley 1480/2011 — Estatuto del Consumidor): prohibió a los productores y expendedores establecer cobros que no correspondan a obligaciones claras y pactadas. Aplica a entidades financieras y de crédito.\n\n6. ART. 144 — SIMPLIFICACIÓN DE TRÁMITES DE COBRANZA: estableció que el cobro prejurídico no requiere formalidades notariales ni de fiscalía para su validez, salvo en casos de proceso judicial.\n\n7. ART. 49 — PROTECCIÓN AL CONSUMIDOR FINANCIERO: las entidades financieras deben contar con Defensor del Consumidor Financiero (vigiladas por Superfinanciera) o canal de PQR para no vigiladas.\n\nIMPORTANCIA PARA PLATAFORMA DE CRÉDITO: la Ley 1450/2011 estableció el marco moderno de protección al consumidor financiero, aplicable a TODAS las empresas de crédito (vigiladas o no).',
    sinonimos: ['ley 1450', 'ley anti tramite', '305 ley 1450', 'usura 1.5 tasa bancaria corriente', 'rnbd', 'defensor consumidor financiero', 'cargos abusivos'],
  },

  // =====================================================
  // CIERRE — resumen del marco normativo aplicable
  // =====================================================
  {
    id: 'JU-COL-180', categoria: 'RESUMEN',
    pregunta: '¿Cuál es el marco normativo aplicable a una empresa de créditos en Colombia?',
    respuesta: 'MARCO NORMATIVO APLICABLE A UNA EMPRESA DE CRÉDITOS EN COLOMBIA:\n\n1. CONSTITUCIÓN POLÍTICA (1991):\n   • Art. 15 — Habeas Data y protección de datos personales.\n   • Art. 78 — Defensa del consumidor.\n   • Art. 86 — Acción de tutela.\n   • Art. 150 — Regulación de actividades financieras.\n\n2. CÓDIGO CIVIL (Ley 84/1873):\n   • Obligaciones, contratos, mora, prescripción (arts. 1551-1601).\n   • Mutuo (arts. 2231 y ss.).\n   • Solidaridad (arts. 1568-1580).\n   • Compensación, novación (arts. 1666-1722).\n\n3. CÓDIGO DE COMERCIO (Decreto 410/1971, Ley 1430/2010):\n   • Títulos valores — pagaré (arts. 619-789).\n   • Mutuo mercantil (art. 1161).\n   • Sociedades (arts. 323-371).\n\n4. CÓDIGO PENAL (Ley 599/2000):\n   • Usura (art. 305).\n   • Estafa (art. 246).\n   • Fraude procesal (art. 454).\n\n5. CÓDIGO GENERAL DEL PROCESO (Ley 1564/2012):\n   • Proceso ejecutivo (arts. 420-433).\n   • Medidas cautelares (art. 423).\n   • Embargo y remate (arts. 510-540).\n   • Conciliación (art. 89).\n\n6. LEYES ESPECIALES:\n   • Ley 1266/2008 — Habeas Data.\n   • Ley 1480/2011 — Estatuto del Consumidor.\n   • Ley 1450/2011 — Anti-trámite (usura).\n   • Ley 1581/2012 — Datos personales.\n   • Ley 1520/2012 + Ley 1731/2014 — Microcrédito.\n   • Ley 1116/2006 — Reorganización y liquidación.\n   • Ley 1676/2013 — Garantías mobiliarias.\n   • Ley 526/1999 — UIAF.\n   • Ley 640/2001 — Conciliación.\n   • Ley 1563/2012 — Arbitramento.\n\n7. REGULACIÓN ADMINISTRATIVA:\n   • Decreto-Ley 663/1993 — Estatuto Orgánico Financiero.\n   • Resolución Externa 8/2000 Banco de la República — Tasa bancaria corriente.\n   • Circular Básica Jurídica Superfinanciera — Entidades vigiladas.\n   • Resolución 100-000002/2018 Supersociedades — SAGRILAFT.\n\n8. JURISPRUDENCIA:\n   • Corte Suprema de Justicia — Sala Civil (intereses moratorios, anatocismo).\n   • Corte Constitucional (mínimo vital, cobranzas, tutelas).\n\n9. AUTORIDADES DE CONTROL:\n   • Superintendencia Financiera (entidades vigiladas).\n   • Superintendencia de Industria y Comercio (consumidor, datos personales).\n   • Superintendencia de Sociedades (concursal, SAGRILAFT).\n   • UIAF (lavado de activos).\n\nPARA NUESTRA PLATAFORMA: aplican todas las anteriores según la modalidad de crédito, el tipo de cliente y la estructura societaria. La verificación previa del cumplimiento legal es responsabilidad del área jurídica.',
    sinonimos: ['marco normativo credito colombia', 'resumen leyes creditos', 'normatividad aplicable', 'autoridades control financiero', 'leyes credito colombia'],
  },
]

// =====================================================
// MAPA DE REFERENCIAS NORMATIVAS (para consultas rápidas)
// =====================================================

export const REFERENCIAS_NORMATIVAS_COLOMBIA: Array<{
  id: string
  nombre: string
  cita: string
  tema: string
  url?: string
}> = [
  { id: 'CC-1551', nombre: 'Código Civil art. 1551', cita: 'Ley 84 de 1873', tema: 'Definición de obligación (dar, hacer, no hacer)' },
  { id: 'CC-1568', nombre: 'Código Civil art. 1568', cita: 'Ley 84 de 1873', tema: 'Responsabilidad civil por culpa' },
  { id: 'CC-1601', nombre: 'Código Civil art. 1601', cita: 'Ley 84 de 1873', tema: 'Mora ex re (automática por vencimiento)' },
  { id: 'CC-1524', nombre: 'Código Civil art. 1524', cita: 'Ley 84 de 1873', tema: 'Interés convencional libre con límite legal' },
  { id: 'CC-2512', nombre: 'Código Civil art. 2512', cita: 'Ley 84 de 1873', tema: 'Prescripción extintiva' },
  { id: 'CC-2536', nombre: 'Código Civil art. 2536', cita: 'Ley 84 de 1873', tema: 'Prescripción ordinaria 3 años' },
  { id: 'CC-2537', nombre: 'Código Civil art. 2537', cita: 'Ley 84 de 1873', tema: 'Prescripción título ejecutivo 5 años' },
  { id: 'CC-2231', nombre: 'Código Civil art. 2231', cita: 'Ley 84 de 1873', tema: 'Contrato de mutuo' },
  { id: 'CC-1592', nombre: 'Código Civil art. 1592', cita: 'Ley 84 de 1873', tema: 'Cláusula penal' },
  { id: 'CC-1714', nombre: 'Código Civil art. 1714', cita: 'Ley 84 de 1873', tema: 'Compensación legal' },
  { id: 'CC-1691', nombre: 'Código Civil art. 1691', cita: 'Ley 84 de 1873', tema: 'Novación' },
  { id: 'CC-1654', nombre: 'Código Civil art. 1654', cita: 'Ley 84 de 1873', tema: 'Remisión / condonación' },
  { id: 'CoC-619', nombre: 'Código de Comercio art. 619', cita: 'Decreto 410/1971, Ley 1430/2010', tema: 'Título valor — definición' },
  { id: 'CoC-709', nombre: 'Código de Comercio art. 709', cita: 'Decreto 410/1971, Ley 1430/2010', tema: 'Requisitos del pagaré' },
  { id: 'CoC-782', nombre: 'Código de Comercio art. 782', cita: 'Ley 1430/2010', tema: 'Acción cambiaria directa' },
  { id: 'CoC-1161', nombre: 'Código de Comercio art. 1161', cita: 'Decreto 410/1971', tema: 'Mutuo mercantil' },
  { id: 'CP-305', nombre: 'Código Penal art. 305', cita: 'Ley 599/2000, modificado por Ley 1450/2011', tema: 'Delito de usura' },
  { id: 'CP-246', nombre: 'Código Penal art. 246', cita: 'Ley 599/2000', tema: 'Delito de estafa' },
  { id: 'CP-454', nombre: 'Código Penal art. 454', cita: 'Ley 599/2000', tema: 'Fraude procesal' },
  { id: 'CGP-420', nombre: 'CGP art. 420', cita: 'Ley 1564/2012', tema: 'Proceso ejecutivo' },
  { id: 'CGP-423', nombre: 'CGP art. 423', cita: 'Ley 1564/2012', tema: 'Medidas cautelares' },
  { id: 'CGP-423A', nombre: 'CGP art. 423-A', cita: 'Ley 1564/2012, Ley 1955/2019', tema: 'Proceso monitorio' },
  { id: 'CGP-510', nombre: 'CGP art. 510', cita: 'Ley 1564/2012', tema: 'Embargo de bienes' },
  { id: 'CGP-512', nombre: 'CGP art. 512', cita: 'Ley 1564/2012', tema: 'Bienes inembargables' },
  { id: 'CGP-526', nombre: 'CGP art. 526', cita: 'Ley 1564/2012', tema: 'Remate en pública subasta' },
  { id: 'CGP-332', nombre: 'CGP art. 332', cita: 'Ley 1564/2012', tema: 'Ejecución de sentencia' },
  { id: 'CGP-89', nombre: 'CGP art. 89', cita: 'Ley 1564/2012', tema: 'Conciliación extrajudicial' },
  { id: 'L1266-2008', nombre: 'Ley 1266 de 2008', cita: 'Ley 1266/2008, Decreto 1738/2008', tema: 'Habeas Data — centrales de información' },
  { id: 'L1480-2011', nombre: 'Ley 1480 de 2011', cita: 'Estatuto del Consumidor', tema: 'Protección al consumidor' },
  { id: 'L1450-2011', nombre: 'Ley 1450 de 2011', cita: 'Ley Anti-Trámite', tema: 'Usura, trámites, cobranzas' },
  { id: 'L1581-2012', nombre: 'Ley 1581 de 2012', cita: 'Ley 1581/2012, Decreto 1377/2013', tema: 'Protección de datos personales' },
  { id: 'L1520-2012', nombre: 'Ley 1520 de 2012', cita: 'Modificada por Ley 1731/2014', tema: 'Microcrédito' },
  { id: 'L1564-2012', nombre: 'Ley 1564 de 2012', cita: 'Código General del Proceso', tema: 'Procesos judiciales' },
  { id: 'L1563-2012', nombre: 'Ley 1563 de 2012', cita: 'Estatuto de Arbitraje', tema: 'Arbitramento' },
  { id: 'L1116-2006', nombre: 'Ley 1116 de 2006', cita: 'Régimen concursal', tema: 'Reorganización y liquidación' },
  { id: 'L1676-2013', nombre: 'Ley 1676 de 2013', cita: 'Decreto 832/2014', tema: 'Garantías mobiliarias' },
  { id: 'L526-1999', nombre: 'Ley 526 de 1999', cita: 'UIAF', tema: 'Lavado de activos' },
  { id: 'L640-2001', nombre: 'Ley 640 de 2001', cita: 'Conciliación', tema: 'Conciliación extrajudicial' },
  { id: 'L70-1986', nombre: 'Ley 70 de 1986', cita: 'Bien de familia', tema: 'Inembargabilidad vivienda familiar' },
  { id: 'L1258-2008', nombre: 'Ley 1258 de 2008', cita: 'S.A.S.', tema: 'Sociedad por Acciones Simplificada' },
  { id: 'D663-1993', nombre: 'Decreto-Ley 663 de 1993', cita: 'Estatuto Orgánico Financiero', tema: 'Sistema financiero' },
  { id: 'RE-8-2000', nombre: 'Resolución Externa 8 de 2000', cita: 'Banco de la República', tema: 'Tasa bancaria corriente' },
  { id: 'CST-59', nombre: 'Código Sustantivo del Trabajo art. 59', cita: 'Ley 7/1943', tema: 'Inembargabilidad del salario' },
]

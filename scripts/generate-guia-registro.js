// Guía para el cliente: Cómo registrarse en la plataforma JSADR
// Documento Word profesional con portada + pasos detallados + imágenes embebidas
// v2 — Incluye nuevo paso de datos bancarios y omite paso de crédito solicitado

const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, PageBreak,
  Table, TableRow, TableCell, TableLayoutType, WidthType,
  BorderStyle, ShadingType, SectionType, NumberFormat,
  ImageRun
} = require("docx");
const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────────────────────
// 1. Paleta de colores — Warm + Heavy + Calm (Legal Wood)
// ─────────────────────────────────────────────────────────────
const P = {
  primary:    "#28201C",
  body:       "#36302C",
  secondary:  "#6E6560",
  accent:     "#7A1F2B",
  surface:    "#F7F2EE",
  bg:         "#1F1A17",
  titleColor: "#FFFFFF",
  subtitleColor: "#E8DCD3",
  metaColor:  "#D4C5BC",
  footerColor:"#9C9089",
};
const c = (hex) => hex.replace("#", "");

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ─────────────────────────────────────────────────────────────
// 2. Helpers — calcTitleLayout + calcCoverSpacing
// ─────────────────────────────────────────────────────────────
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..." \t-_/—–·,.:;"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 11;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 4) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    const cpl = charsPerLine(minPt);
    lines = splitTitleLines(title, cpl);
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838,
    marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ─────────────────────────────────────────────────────────────
// 3. Cover Recipe R1
// ─────────────────────────────────────────────────────────────
function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 38, 24);
  const titleSize = titlePt * 2;

  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });

  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];

  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
    }));
  }

  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: P.titleColor, font: { ascii: "Arial" } })],
    }));
  }

  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800, line: 360, lineRule: "atLeast" },
      children: [new TextRun({ text: config.subtitle, size: 26, color: P.subtitleColor,
        font: { ascii: "Arial" } })],
    }));
  }

  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor,
        font: { ascii: "Arial" } })],
    }));
  }

  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ─────────────────────────────────────────────────────────────
// 4. Body component builders
// ─────────────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: c(P.accent), space: 4 } },
    children: [new TextRun({ text, bold: true, size: 32, color: c(P.primary),
      font: { ascii: "Calibri" } })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(P.primary),
      font: { ascii: "Calibri" } })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, color: c(P.accent),
      font: { ascii: "Calibri" } })],
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 22, color: c(P.body),
      font: { ascii: "Calibri" } })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    spacing: { line: 312, after: 80 },
    indent: { left: 720 + level * 360, hanging: 280 },
    children: [
      new TextRun({ text: "•  ", size: 22, color: c(P.accent), bold: true, font: { ascii: "Calibri" } }),
      new TextRun({ text, size: 22, color: c(P.body), font: { ascii: "Calibri" } }),
    ],
  });
}

function bulletRich(runs, level = 0) {
  const children = [new TextRun({ text: "•  ", size: 22, color: c(P.accent), bold: true, font: { ascii: "Calibri" } })];
  for (const r of runs) {
    children.push(new TextRun({
      text: r.text, size: 22, font: { ascii: "Calibri" },
      bold: r.bold || false, italics: r.italics || false,
      color: r.color || c(P.body)
    }));
  }
  return new Paragraph({
    spacing: { line: 312, after: 80 },
    indent: { left: 720 + level * 360, hanging: 280 },
    children,
  });
}

function numbered(num, text) {
  return new Paragraph({
    spacing: { line: 312, after: 100 },
    indent: { left: 720, hanging: 480 },
    children: [
      new TextRun({ text: `${num}.  `, size: 22, bold: true, color: c(P.accent), font: { ascii: "Calibri" } }),
      new TextRun({ text, size: 22, color: c(P.body), font: { ascii: "Calibri" } }),
    ],
  });
}

function callout(title, text, color = P.accent) {
  const cell = new TableCell({
    shading: { type: ShadingType.CLEAR, fill: c(P.surface) },
    margins: { top: 200, bottom: 200, left: 240, right: 240 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: c(color) },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: c(color) },
      left: { style: BorderStyle.SINGLE, size: 18, color: c(color) },
      right: { style: BorderStyle.SINGLE, size: 4, color: c(color) },
    },
    children: [
      new Paragraph({
        spacing: { after: 80, line: 280 },
        children: [new TextRun({ text: title, bold: true, size: 22, color: c(color), font: { ascii: "Calibri" } })],
      }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 300 },
        children: [new TextRun({ text, size: 22, color: c(P.body), font: { ascii: "Calibri" } })],
      }),
    ],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({ cantSplit: true, children: [cell] })],
  });
}

function fieldTable(rows) {
  const headerRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: [
      new TableCell({
        width: { size: 32, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: c(P.primary) },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [new Paragraph({ children: [new TextRun({ text: "Campo", bold: true, size: 22, color: "FFFFFF", font: { ascii: "Calibri" } })] })],
      }),
      new TableCell({
        width: { size: 38, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: c(P.primary) },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [new Paragraph({ children: [new TextRun({ text: "Qué debes ingresar", bold: true, size: 22, color: "FFFFFF", font: { ascii: "Calibri" } })] })],
      }),
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: c(P.primary) },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [new Paragraph({ children: [new TextRun({ text: "Obligatorio", bold: true, size: 22, color: "FFFFFF", font: { ascii: "Calibri" } })] })],
      }),
    ],
  });

  const dataRows = rows.map((r, i) => new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: 32, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: i % 2 === 0 ? "FFFFFF" : c(P.surface) },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        children: [new Paragraph({ children: [new TextRun({ text: r[0], bold: true, size: 22, color: c(P.primary), font: { ascii: "Calibri" } })] })],
      }),
      new TableCell({
        width: { size: 38, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: i % 2 === 0 ? "FFFFFF" : c(P.surface) },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        children: [new Paragraph({ children: [new TextRun({ text: r[1], size: 22, color: c(P.body), font: { ascii: "Calibri" } })] })],
      }),
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: i % 2 === 0 ? "FFFFFF" : c(P.surface) },
        margins: { top: 100, bottom: 100, left: 160, right: 160 },
        children: [new Paragraph({ children: [new TextRun({ text: r[2], size: 22, color: c(P.body), font: { ascii: "Calibri" } })] })],
      }),
    ],
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [headerRow, ...dataRows],
  });
}

// ─────────────────────────────────────────────────────────────
// 5. Image embedding helper
//    Usa la librería image-size para soportar PNG, JPEG, WEBP
// ─────────────────────────────────────────────────────────────
const { imageSize } = require("image-size");

function readImageSize(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const dims = imageSize(buf);
    return { width: dims.width, height: dims.height };
  } catch (e) {
    console.warn("No se pudo leer dimensiones de", filePath, "—", e.message);
    return { width: 800, height: 600 };
  }
}

function imageParagraph(filePath, caption, maxWidthPx = 580) {
  const buf = fs.readFileSync(filePath);
  let dims;
  try {
    dims = imageSize(buf);
  } catch (e) {
    console.warn("No se pudo leer dimensiones de", filePath, "—", e.message);
    dims = { width: 800, height: 600, type: "png" };
  }
  const scale = Math.min(1, maxWidthPx / dims.width);
  const w = Math.round(dims.width * scale);
  const h = Math.round(dims.height * scale);

  // image-size devuelve type en {png, jpg, webp, ...}
  // docx espera "png" | "jpeg" | "webp" | "gif" | "bmp"
  let type = (dims.type || "png").toLowerCase();
  if (type === "jpg") type = "jpeg";

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      children: [new ImageRun({
        data: buf,
        transformation: { width: w, height: h },
        type: type,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({
        text: caption, italics: true, size: 20, color: c(P.secondary),
        font: { ascii: "Calibri" }
      })],
    }),
  ];
}

// ─────────────────────────────────────────────────────────────
// 6. Contenido del cuerpo
// ─────────────────────────────────────────────────────────────
const IMG_DIR = "/home/z/my-project/download/guia-img";
const bodyChildren = [];

// Bienvenida
bodyChildren.push(h1("Bienvenido a JSADR"));
bodyChildren.push(body(
  "Esta guía le explica de manera clara y detallada cómo registrarse como cliente nuevo en nuestra plataforma. " +
  "El proceso es totalmente en línea y se realiza a través de nuestro formulario seguro en seis pasos. " +
  "Al finalizar, nuestro equipo verificará su información y le enviará las credenciales de acceso para que pueda ingresar al portal del cliente, " +
  "donde podrá simular créditos, radicar solicitudes, firmar documentos y hacer seguimiento a sus préstamos activos."
));
bodyChildren.push(body(
  "Le recomendamos leer esta guía completa antes de iniciar el registro. " +
  "Tenga a la mano su cédula de ciudadanía y un dispositivo con cámara (computador con webcam, tablet o celular) " +
  "para tomar las fotografías de verificación. El tiempo estimado para completar el formulario es de diez a quince minutos."
));

bodyChildren.push(callout(
  "Importante antes de empezar",
  "El registro no activa su cuenta de inmediato. Su solicitud entra a un proceso de revisión que toma menos de 24 horas hábiles. " +
  "Una vez aprobada, recibirá por correo electrónico o por WhatsApp su usuario y contraseña temporal para ingresar al portal. " +
  "Por eso es importante que ingrese un correo válido y un teléfono de contacto donde podamos comunicarnos con usted.",
  P.accent
));

// Sección 1
bodyChildren.push(h1("1. Cómo acceder al formulario de registro"));

bodyChildren.push(h2("1.1 Ingrese al sitio web oficial"));
bodyChildren.push(body(
  "Abra su navegador web (Chrome, Safari, Edge o Firefox actualizados) y visite la página oficial de JSADR en la siguiente dirección: " +
  "jsadr.com.co. Esta es la única dirección autorizada para realizar su registro. " +
  "Por seguridad, no utilice enlaces recibidos por correo electrónico o mensajes de texto que no provengan de nuestros canales oficiales."
));
bodyChildren.push(body(
  "En la página de inicio de sesión encontrará el botón para registrarse como nuevo cliente, " +
  "el cual lo llevará directamente al formulario de registro seguro. " +
  "A continuación le mostramos cómo se ve esta pantalla."
));

// Imagen paso 0 — login
bodyChildren.push(...imageParagraph(
  path.join(IMG_DIR, "paso-0-login.png"),
  "Pantalla de inicio de sesión. El botón verde \"Regístrate como nuevo cliente\" lo lleva al formulario de registro."
));

bodyChildren.push(h2("1.2 Ubique el botón de registro"));
bodyChildren.push(numbered(1, "Ingrese a jsadr.com.co/login en su navegador."));
bodyChildren.push(numbered(2, "Busque debajo del formulario de inicio de sesión el botón verde con el texto \"Regístrate como nuevo cliente\"."));
bodyChildren.push(numbered(3, "Haga clic sobre ese botón. Se abrirá la página de registro en /register."));
bodyChildren.push(numbered(4, "También puede ingresar directamente a la dirección jsadr.com.co/register para saltar este paso."));

bodyChildren.push(h2("1.3 Requisitos técnicos"));
bodyChildren.push(bullet("Conexión a internet estable (se suben fotografías, por lo que una conexión lenta puede demorar el envío)."));
bodyChildren.push(bullet("Navegador web actualizado (Chrome, Edge, Firefox o Safari versión reciente)."));
bodyChildren.push(bullet("Cámara funcional o un archivo de imagen de su cédula previamente tomado (JPG, PNG o WEBP, máximo 10 MB por foto)."));
bodyChildren.push(bullet("Tener a mano su cédula de ciudadanía, extranjería o tarjeta de identidad original."));
bodyChildren.push(bullet("Datos de su cuenta bancaria: banco, tipo de cuenta (ahorros o corriente) y número de cuenta."));

bodyChildren.push(callout(
  "Conexión cifrada",
  "Verá en la parte superior del formulario un indicador con el texto \"Conexión cifrada\". " +
  "Esto confirma que su información viaja de forma segura y que solo el equipo autorizado de JSADR tendrá acceso para validar su solicitud.",
  P.secondary
));

// Sección 2 — Los 6 pasos
bodyChildren.push(h1("2. Los seis pasos del formulario de registro"));

bodyChildren.push(body(
  "El formulario está dividido en seis pasos secuenciales. En la parte superior verá una barra de progreso " +
  "que le indica en qué paso se encuentra (\"Paso X de 6\"). " +
  "Puede avanzar y retroceder entre pasos usando los botones \"Continuar\" y \"Atrás\" que aparecen al final de cada pantalla. " +
  "Los datos que ingrese en cada paso se conservan mientras navega por el formulario."
));

// PASO 1
bodyChildren.push(h2("Paso 1. Datos personales"));
bodyChildren.push(body(
  "En este primer paso debe ingresar la información básica que lo identifica. " +
  "Estos datos serán verificados contra su cédula, así que deben coincidir exactamente con el documento. " +
  "El subtítulo del paso es \"Cuéntanos sobre ti\"."
));

bodyChildren.push(h3("Campos a diligenciar"));
bodyChildren.push(fieldTable([
  ["Nombre", "Su primer nombre tal como aparece en la cédula. Mínimo 2 caracteres.", "Sí"],
  ["Apellido", "Su primer apellido tal como aparece en la cédula. Mínimo 2 caracteres.", "Sí"],
  ["Tipo de documento", "Seleccione: C.C. (cédula de ciudadanía), C.E. (cédula de extranjería) o T.I. (tarjeta de identidad).", "Sí"],
  ["Número de documento", "Solo números, sin puntos ni espacios. Mínimo 5 dígitos.", "Sí"],
  ["Fecha de nacimiento", "Seleccione la fecha desde el calendario del campo.", "No"],
  ["Teléfono / WhatsApp", "Número de contacto, solo dígitos. Mínimo 7 caracteres. Incluya el indicativo si es celular (ej: 3001234567).", "Sí"],
  ["Correo electrónico", "Correo válido que revise con frecuencia. Allí le llegará su contraseña temporal una vez aprobado.", "Recomendado"],
]));

bodyChildren.push(body(
  "El correo electrónico es opcional, pero le recomendamos encarecidamente ingresarlo. " +
  "Si no lo registra, su contraseña temporal le será entregada únicamente por WhatsApp o llamada telefónica, " +
  "lo cual puede demorar un poco más y le impide recuperar su cuenta por sí mismo en caso de olvidar la contraseña."
));

bodyChildren.push(...imageParagraph(
  path.join(IMG_DIR, "paso-1-datos-personales.png"),
  "Paso 1. Datos personales: nombre, documento, fecha de nacimiento, teléfono y correo."
));

// PASO 2
bodyChildren.push(h2("Paso 2. Ubicación y ocupación"));
bodyChildren.push(body(
  "Este paso recoge información sobre su lugar de residencia y su actividad laboral. " +
  "Estos datos nos ayudan a evaluar su solicitud de crédito y a verificar su capacidad de pago."
));

bodyChildren.push(h3("Campos a diligenciar"));
bodyChildren.push(fieldTable([
  ["Ciudad", "Ciudad donde reside actualmente. Mínimo 2 caracteres.", "Recomendado"],
  ["Municipio / Localidad", "Municipio o localidad específica dentro de la ciudad.", "Opcional"],
  ["Dirección de residencia", "Dirección completa (calle, número, interior, etc.). Mínimo 5 caracteres.", "Recomendado"],
  ["Ocupación", "Su actividad laboral actual (empleado, independiente, comerciante, etc.).", "Opcional"],
  ["Ingreso mensual (COP)", "Su ingreso mensual en pesos colombianos. Solo dígitos, sin puntos ni signos.", "Opcional"],
]));

bodyChildren.push(body(
  "Aunque varios campos son opcionales, ingresarlos completa y verazmente acelera el proceso de aprobación. " +
  "La información financiera y de residencia es fundamental para que nuestro equipo de análisis pueda evaluar su capacidad de crédito " +
  "y ofrecerle un producto adecuado a su perfil."
));

bodyChildren.push(...imageParagraph(
  path.join(IMG_DIR, "paso-2-ubicacion.png"),
  "Paso 2. Ubicación y ocupación: ciudad, municipio, dirección, ocupación e ingreso mensual."
));

// PASO 3 — Datos bancarios (NUEVO)
bodyChildren.push(h2("Paso 3. Datos bancarios (obligatorio)"));
bodyChildren.push(body(
  "En este paso debe registrar los datos de la cuenta bancaria donde recibirá el dinero de sus préstamos una vez sean aprobados. " +
  "Estos tres campos son obligatorios porque sin una cuenta válida no es posible realizar el desembolso del crédito. " +
  "La cuenta debe estar a su nombre y coincidir con el número de documento de identidad que registró en el paso 1."
));

bodyChildren.push(h3("Campos a diligenciar"));
bodyChildren.push(fieldTable([
  ["Banco", "Seleccione su banco de la lista desplegable. Incluye todos los bancos colombianos (Bancolombia, Davivienda, BBVA, Nequi, Daviplata, etc.).", "Sí"],
  ["Tipo de cuenta", "Seleccione: Cuenta de Ahorros o Cuenta Corriente.", "Sí"],
  ["Número de cuenta", "Solo dígitos, sin puntos ni espacios. Mínimo 5 caracteres. Verifique dos veces antes de enviar.", "Sí"],
]));

bodyChildren.push(callout(
  "Verifique muy bien el número de cuenta",
  "Si el préstamo se disbursa a una cuenta incorrecta por error de digitación, " +
  "el proceso de reversión con el banco puede demorar varios días hábiles. " +
  "Le recomendamos tener a la mano un extracto o chequera de su cuenta para verificar el número exacto antes de ingresarlo.",
  P.accent
));

bodyChildren.push(body(
  "Esta información se transmite por conexión cifrada y se almacena de forma segura. " +
  "Solo el equipo autorizado de JSADR tiene acceso para validar la solicitud, " +
  "y una vez aprobada, los datos bancarios se copian automáticamente al perfil de cliente para que el desembolso sea inmediato al aprobarse un préstamo."
));

bodyChildren.push(...imageParagraph(
  path.join(IMG_DIR, "paso-3-datos-bancarios.png"),
  "Paso 3. Datos bancarios: banco (lista desplegable), tipo de cuenta y número de cuenta. Los tres campos son obligatorios."
));

// PASO 4
bodyChildren.push(h2("Paso 4. Referido (opcional)"));
bodyChildren.push(body(
  "Este paso es completamente opcional. Si un cliente actual de JSADR lo recomendó, puede ingresar sus datos aquí. " +
  "La información del referido nos ayuda a validar su solicitud más rápido y a conectarlo con un asesor conocido. " +
  "Si nadie lo recomendó, simplemente puede dejar todos los campos en blanco y continuar al siguiente paso."
));

bodyChildren.push(h3("Campos a diligenciar"));
bodyChildren.push(fieldTable([
  ["Nombre del referido", "Primer nombre de la persona que lo recomendó.", "Opcional"],
  ["Apellido del referido", "Apellido de la persona que lo recomendó.", "Opcional"],
  ["Teléfono del referido", "Número de contacto del referido. Solo dígitos.", "Opcional"],
  ["Parentesco / Relación", "Vínculo con el referido (familiar, amigo, laboral, etc.).", "Opcional"],
]));

bodyChildren.push(...imageParagraph(
  path.join(IMG_DIR, "paso-4-referido.png"),
  "Paso 4. Referido (opcional). Si nadie lo recomendó puede dejar todos los campos en blanco y continuar."
));

// PASO 5
bodyChildren.push(h2("Paso 5. Verificación de identidad (fotos)"));
bodyChildren.push(body(
  "Este paso es obligatorio y el más importante para validar su identidad. " +
  "Debe cargar tres fotografías: la cara frontal de su cédula, la cara del reverso de su cédula, " +
  "y una selfie suya sosteniendo la cédula junto a su rostro. " +
  "Para cada foto puede usar la cámara del dispositivo o subir un archivo de imagen (JPG, PNG o WEBP) de máximo 10 MB."
));

bodyChildren.push(h3("Las tres fotos obligatorias"));
bodyChildren.push(fieldTable([
  ["Foto cédula (frente)", "La cara donde aparece su foto, nombre y datos personales. Asegúrese de que se lean todos los datos.", "Sí"],
  ["Foto cédula (reverso)", "La cara donde aparece la firma y la huella. Sin reflejos que oculten la información.", "Sí"],
  ["Selfie con cédula", "Foto de su rostro completo sosteniendo la cédula al lado de la cara. Debe ser nítida y bien iluminada.", "Sí"],
]));

bodyChildren.push(h3("Recomendaciones para buenas fotografías"));
bodyChildren.push(bullet("Ubique la cédula sobre una superficie plana y de color oscuro para maximizar el contraste."));
bodyChildren.push(bullet("Asegúrese de que no haya reflejos, sombras o dedos sobre la información del documento."));
bodyChildren.push(bullet("Use luz natural o una lámpara frontal. Evite contraluz o ventanas detrás de usted."));
bodyChildren.push(bullet("Para la selfie, sostenga la cédula al lado de su cara, no delante de ella, para que ambos se vean claramente."));
bodyChildren.push(bullet("Si la cámara de su computador no tiene buena resolución, le recomendamos tomar las fotos con su celular y subirlas como archivo."));

bodyChildren.push(...imageParagraph(
  path.join(IMG_DIR, "paso-5-fotos-guia.png"),
  "Las tres fotos obligatorias: cédula frente, cédula reverso y selfie sosteniendo la cédula."
));

bodyChildren.push(...imageParagraph(
  path.join(IMG_DIR, "paso-5-fotos.png"),
  "Paso 5. Pantalla de verificación de identidad. Para cada foto puede usar la cámara del dispositivo o subir un archivo."
));

bodyChildren.push(callout(
  "Tamaños y formatos admitidos",
  "Formatos aceptados: JPG, PNG y WEBP. Tamaño máximo por archivo: 10 MB. " +
  "El sistema reescala las imágenes automáticamente a 1600 píxeles para optimizar el envío, " +
  "por lo que una foto demasiado grande será procesada sin perder la información relevante.",
  P.secondary
));

// PASO 6
bodyChildren.push(h2("Paso 6. Autorizaciones finales"));
bodyChildren.push(body(
  "En el último paso debe aceptar cuatro autorizaciones obligatorias. " +
  "Sin la aceptación de las cuatro no es posible enviar la solicitud. " +
  "Al final del paso verá un resumen completo de todos los datos que diligenció, " +
  "incluyendo la cantidad de fotos cargadas (deben aparecer 3 de 3)."
));

bodyChildren.push(h3("Las cuatro autorizaciones obligatorias"));
bodyChildren.push(numbered(1, "Aceptar los Términos y Condiciones del servicio."));
bodyChildren.push(numbered(2, "Autorizar el tratamiento de mis datos personales conforme a la Política de Privacidad (Ley 1581 de 2012)."));
bodyChildren.push(numbered(3, "Autorizar la consulta de mi historial en centrales de riesgo (Datacrédito, Cifin, TransUnion)."));
bodyChildren.push(numbered(4, "Autorizar el reporte de mi comportamiento de pago a centrales de riesgo."));

bodyChildren.push(body(
  "Estas autorizaciones son requeridas por la ley colombiana y por las entidades financieras para consultar y reportar su comportamiento crediticio. " +
  "Si tiene dudas sobre cualquiera de ellas, contáctenos antes de enviar la solicitud y con gusto le explicaremos en detalle cada una."
));

bodyChildren.push(callout(
  "Antes de enviar",
  "Revise el resumen completo que aparece al final del paso 6. " +
  "Verifique que su nombre, documento, teléfono, correo, banco y las tres fotografías estén correctos. " +
  "Una vez enviada la solicitud, no podrá modificarla desde el formulario; cualquier corrección deberá solicitarla a su asesor una vez sea contactado.",
  P.accent
));

// Sección 3 — Envío y código
bodyChildren.push(h1("3. Envío de la solicitud y código de seguimiento"));

bodyChildren.push(h2("3.1 Botón \"Enviar solicitud\""));
bodyChildren.push(body(
  "Una vez haya aceptado las cuatro autorizaciones y revisado el resumen, " +
  "haga clic en el botón \"Enviar solicitud\" que aparece al final del paso 6. " +
  "El botón se identificará con un icono de envío (Send) y tendrá un color verde. " +
  "Mientras se procesa el envío, verá el texto \"Enviando…\" con un indicador de carga."
));

bodyChildren.push(h2("3.2 Pantalla de confirmación"));
bodyChildren.push(body(
  "Si todo está correcto, verá una pantalla de éxito con el título \"¡Solicitud enviada!\". " +
  "Allí aparecerá un mensaje personalizado con su nombre y un recuadro destacado con su " +
  "código de seguimiento, el cual tiene el formato SNC-XXXXX (por ejemplo: SNC-L8KA3F)."
));

bodyChildren.push(...imageParagraph(
  path.join(IMG_DIR, "paso-6-exito.png"),
  "Pantalla de éxito al enviar la solicitud. Anote o tome captura de su código de seguimiento SNC-XXXXX."
));

bodyChildren.push(callout(
  "Guarde su código de seguimiento",
  "El código que aparece en la pantalla de éxito es su comprobante de registro. " +
  "Anótelo o tome captura de pantalla. Con ese código puede consultar el estado de su solicitud " +
  "si necesita comunicarse con nosotros antes de recibir respuesta.",
  P.accent
));

bodyChildren.push(h2("3.3 Qué hacer después del envío"));
bodyChildren.push(body("Una vez enviada la solicitud, el flujo continúa así:"));
bodyChildren.push(numbered(1, "Nuestro equipo revisa su información y las fotografías en un plazo máximo de 24 horas hábiles."));
bodyChildren.push(numbered(2, "Si su solicitud es aprobada, se crea su cuenta de cliente con una contraseña temporal."));
bodyChildren.push(numbered(3, "Si registró correo electrónico, le llega un mensaje con el asunto \"Bienvenido a JSADR — Tu clave de acceso al Portal\", que contiene su contraseña temporal."));
bodyChildren.push(numbered(4, "Si no registró correo, uno de nuestros asesores se comunicará por WhatsApp o llamada para entregarle su clave temporal."));
bodyChildren.push(numbered(5, "Con su cédula y la contraseña temporal, ingrese a jsadr.com.co/login para iniciar sesión por primera vez."));
bodyChildren.push(numbered(6, "El sistema le pedirá cambiar su contraseña en ese primer ingreso (la temporal expira en 24 horas)."));

// Sección 4 — Primer ingreso
bodyChildren.push(h1("4. Primer ingreso al portal del cliente"));

bodyChildren.push(h2("4.1 Iniciar sesión"));
bodyChildren.push(body(
  "Una vez reciba sus credenciales, ingrese a jsadr.com.co/login. " +
  "En el campo \"Usuario, cédula o correo\" escriba su número de cédula tal como lo registró (sin puntos ni espacios). " +
  "En el campo \"Contraseña\" digite la contraseña temporal que recibió. " +
  "Si desea que el sistema recuerde su usuario en ese dispositivo (no la contraseña), marque la casilla \"Recordar mi usuario en este dispositivo\". " +
  "Luego haga clic en el botón \"Iniciar sesión\"."
));

bodyChildren.push(h2("4.2 Cambio obligatorio de contraseña"));
bodyChildren.push(body(
  "Por seguridad, en su primer ingreso el sistema le solicitará cambiar su contraseña temporal por una nueva de su elección. " +
  "La contraseña temporal tiene una validez de 24 horas; si no la cambia a tiempo, deberá solicitar una nueva a su asesor. " +
  "Le recomendamos usar una contraseña que combine mayúsculas, minúsculas, números y un símbolo especial, y que no haya utilizado en otros servicios."
));

bodyChildren.push(h2("4.3 Simulación y solicitud de crédito"));
bodyChildren.push(body(
  "Una vez dentro del portal, vaya a la pestaña \"Simular\". Allí podrá ingresar el monto que necesita, " +
  "el plazo en meses, la frecuencia de pago (mensual, quincenal o semanal) y seleccionar su categoría. " +
  "El sistema le mostrará la cuota estimada, el total a pagar y los intereses. " +
  "Si los valores le parecen adecuados, podrá radicar la solicitud formal directamente desde el simulador."
));

bodyChildren.push(callout(
  "Categorías de cliente",
  "Cada cliente se asigna a una categoría al momento del registro, la cual define el monto máximo que puede solicitar: " +
  "Básica (hasta $500.000), Estándar (hasta $700.000), Premium (hasta $1.200.000) y Ejecutiva (sin límite). " +
  "El monto mínimo para todas las categorías es de $150.000. " +
  "La categoría le es asignada por el asesor al aprobar su registro, según su perfil financiero.",
  P.secondary
));

bodyChildren.push(h2("4.4 Recuperar contraseña"));
bodyChildren.push(body(
  "Si en algún momento olvida su contraseña, en la página de login encontrará el enlace \"¿Olvidaste tu contraseña?\". " +
  "Al hacer clic se abrirá un formulario donde debe ingresar su usuario, cédula o correo. " +
  "Le enviaremos un enlace de recuperación a su correo electrónico registrado; " +
  "el enlace lo llevará a una página segura donde podrá definir una nueva contraseña. " +
  "Este enlace es temporal y de un solo uso, por lo que debe usarlo apenas lo reciba."
));

// Sección 5 — FAQ
bodyChildren.push(h1("5. Preguntas frecuentes"));

bodyChildren.push(h2("¿Cuánto demora la aprobación del registro?"));
bodyChildren.push(body(
  "El tiempo prometido es de menos de 24 horas hábiles. " +
  "Esto significa que si envía su solicitud en día laboral antes del mediodía, " +
  "probablemente recibirá respuesta el mismo día. " +
  "Si la envía el fin de semana o un día festivo, el conteo inicia el siguiente día hábil."
));

bodyChildren.push(h2("¿Puedo registrarme sin correo electrónico?"));
bodyChildren.push(body(
  "Sí, el correo es opcional. Sin embargo, le recomendamos ingresarlo porque facilita la entrega de su contraseña temporal, " +
  "le permite recuperar su cuenta por sí mismo en caso de olvido y le garantiza recibir notificaciones importantes " +
  "sobre sus solicitudes y préstamos. Si no registra correo, " +
  "su clave temporal le será entregada por WhatsApp o llamada telefónica."
));

bodyChildren.push(h2("¿Por qué se piden los datos bancarios en el registro?"));
bodyChildren.push(body(
  "Los datos bancarios son obligatorios porque se usan para disbursar el dinero de los préstamos una vez sean aprobados. " +
  "Si no registra una cuenta válida, el sistema no podría transferirle los fondos. " +
  "La cuenta debe estar a su nombre y coincidir con el documento de identidad que registró. " +
  "Tener los datos bancarios cargados desde el registro permite que el desembolso sea inmediato al aprobarse un préstamo, " +
  "sin necesidad de hacer trámites adicionales en ese momento."
));

bodyChildren.push(h2("¿Qué pasa si envié una solicitud y quiero corregir un dato?"));
bodyChildren.push(body(
  "Una vez enviada, no puede modificar la solicitud desde el formulario. " +
  "Espere a ser contactado por nuestro equipo en las próximas 24 horas hábiles; " +
  "informe al asesor el dato correcto y él actualizará la información antes de aprobar su cuenta. " +
  "Si cometió un error en la cédula, el teléfono o el número de cuenta bancaria, escríbanos indicando su código de seguimiento (SNC-XXXXX)."
));

bodyChildren.push(h2("¿Por qué me aparece \"Ya tienes una solicitud pendiente\"?"));
bodyChildren.push(body(
  "Esto ocurre cuando ya existe una solicitud con su número de cédula en estado pendiente. " +
  "Espere a que el equipo la revise y se comunique con usted. " +
  "Si pasaron más de 24 horas hábiles y no recibió respuesta, contáctenos con su código de seguimiento."
));

bodyChildren.push(h2("¿Por qué me aparece \"Ya estás registrado como cliente\"?"));
bodyChildren.push(body(
  "Este mensaje indica que su cédula ya está registrada en el sistema como cliente activo. " +
  "En ese caso no necesita registrarse de nuevo; simplemente ingrese a jsadr.com.co/login con su cédula y contraseña. " +
  "Si no recuerda su contraseña, use la opción \"¿Olvidaste tu contraseña?\"."
));

bodyChildren.push(h2("¿Qué dispositivos puedo usar para registrarme?"));
bodyChildren.push(body(
  "El formulario funciona en computadores de escritorio, portátiles, tablets y celulares con navegador moderno. " +
  "Para las fotografías puede usar la cámara frontal o trasera del dispositivo, " +
  "o subir imágenes previamente tomadas. " +
  "Si usa un celular, le recomendamos conectarse a una red Wi-Fi estable, ya que las imágenes pueden pesar varios megabytes."
));

bodyChildren.push(h2("¿Es segura mi información?"));
bodyChildren.push(body(
  "Sí. Toda la información viaja por una conexión cifrada HTTPS. " +
  "Las contraseñas se almacenan con hash bcrypt, no en texto plano. " +
  "Solo el equipo autorizado de JSADR tiene acceso a su información para validar la solicitud. " +
  "El sistema implementa controles anti-spam, validación estricta de datos y registros de auditoría. " +
  "Sus datos personales se tratan conforme a la Ley 1581 de 2012 de Protección de Datos Personales de Colombia."
));

// Sección 6 — Contacto
bodyChildren.push(h1("6. Canales de contacto"));

bodyChildren.push(body(
  "Si tiene dudas durante el proceso de registro o necesita asistencia con su solicitud, " +
  "puede comunicarse con nosotros a través de los siguientes canales oficiales. " +
  "Tenga siempre a la mano su número de cédula y, si ya envió la solicitud, " +
  "su código de seguimiento SNC-XXXXX para una atención más ágil."
));

bodyChildren.push(bulletRich([{ text: "Sitio web: ", bold: true }, { text: "jsadr.com.co" }]));
bodyChildren.push(bulletRich([{ text: "Correo de contacto: ", bold: true }, { text: "jsa@jsadr.com.co" }]));
bodyChildren.push(bulletRich([{ text: "WhatsApp: ", bold: true }, { text: "el número que aparece en la página oficial; nuestro equipo lo contactará por este canal una vez aprobado el registro" }]));
bodyChildren.push(bulletRich([{ text: "Horario de atención: ", bold: true }, { text: "lunes a viernes de 8:00 a.m. a 6:00 p.m. y sábados de 9:00 a.m. a 1:00 p.m. (hora Colombia)" }]));

bodyChildren.push(callout(
  "Gracias por confiar en JSADR",
  "Nuestro compromiso es acompañarlo en cada paso de su solicitud de crédito. " +
  "Una vez aprobado su registro, tendrá acceso al portal del cliente donde podrá simular créditos, " +
  "radicar solicitudes formales, firmar documentos electrónicamente y hacer seguimiento a sus préstamos activos.",
  P.accent
));

// ─────────────────────────────────────────────────────────────
// 7. Footer del cuerpo
// ─────────────────────────────────────────────────────────────
function bodyFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent), space: 8 } },
      children: [
        new TextRun({ text: "JSADR  ·  Guía de Registro de Cliente  ·  Página ", size: 18, color: c(P.secondary), font: { ascii: "Calibri" } }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary), font: { ascii: "Calibri" } }),
      ],
    })],
  });
}

function bodyHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent), space: 8 } },
      children: [new TextRun({
        text: "Guía de Registro · JSADR",
        size: 18, color: c(P.secondary), italics: true, font: { ascii: "Calibri" }
      })],
    })],
  });
}

// ─────────────────────────────────────────────────────────────
// 8. Ensamblado final
// ─────────────────────────────────────────────────────────────
const doc = new Document({
  creator: "JSADR",
  title: "Guía de Registro de Cliente",
  description: "Guía paso a paso con imágenes para que un cliente nuevo se registre en la plataforma JSADR",
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri" }, size: 22, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: { run: { size: 32, bold: true, color: c(P.primary), font: { ascii: "Calibri" } } },
      heading2: { run: { size: 28, bold: true, color: c(P.primary), font: { ascii: "Calibri" } } },
      heading3: { run: { size: 24, bold: true, color: c(P.accent), font: { ascii: "Calibri" } } },
    },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: buildCoverR1({
        title: "Guía de Registro de Cliente Nuevo",
        subtitle: "Paso a paso con imágenes para crear tu cuenta en la plataforma JSADR",
        englishLabel: "CLIENT ONBOARDING GUIDE",
        metaLines: [
          "Portal web: jsadr.com.co",
          "Página de registro: jsadr.com.co/register",
          "Vigencia: 2026",
          "Versión: 2.0",
        ],
        footerLeft: "JSADR — Soluciones financieras",
        footerRight: "Documento para clientes",
        palette: P,
      }),
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: bodyHeader() },
      footers: { default: bodyFooter() },
      children: bodyChildren,
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  const outPath = "/home/z/my-project/download/Guia_Registro_Cliente_JSADR.docx";
  fs.writeFileSync(outPath, buf);
  console.log("OK:", outPath, "(" + buf.length + " bytes)");
}).catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});

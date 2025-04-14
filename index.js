// ✅ server.js actualizado
import express from "express";
import cors from "cors";
import { fetch } from "undici";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

const API_KEY = process.env.API_KEY;
let documentoTecnico = "";

// ✅ Función para dividir la guía en bloques
function dividirTextoEnBloques(texto, tamanyo = 1000) {
  const bloques = [];
  for (let i = 0; i < texto.length; i += tamanyo) {
    bloques.push(texto.slice(i, i + tamanyo));
  }
  return bloques;
}

// ✅ Cargar documento técnico desde archivo PDF si existe
async function cargarDocumentoTecnico() {
  try {
    const rutaReferencia = path.join(__dirname, "biblioteca", "guia-insst.pdf");
    if (fs.existsSync(rutaReferencia)) {
      const buffer = fs.readFileSync(rutaReferencia);
      const data = await pdf(buffer);
      documentoTecnico = data.text;
      console.log("✅ Documento técnico cargado.");
    } else {
      console.warn("⚠️ No se encontró 'guia-insst.pdf'. Revisión técnica no disponible.");
    }
  } catch (err) {
    console.error("❌ Error cargando documento técnico:", err.message);
  }
}

await cargarDocumentoTecnico();

// ✅ Endpoint para generar resumen
app.post("/resumir", async (req, res) => {
  const texto = req.body.texto;
  if (!texto) return res.status(400).json({ error: "Texto vacío." });

  try {
    const respuesta = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct",
        messages: [
          { role: "system", content: "Eres un experto en comprensión de texto." },
          { role: "user", content: `Resume el siguiente texto:\n\n${texto}` }
        ]
      }),
    });
    const datos = await respuesta.json();
    res.json({ resumen: datos.choices?.[0]?.message?.content || "Sin resumen" });
  } catch (error) {
    console.error("❌ Error generando resumen:", error.message);
    res.status(500).json({ error: "Error al generar resumen." });
  }
});

// ✅ Endpoint mejorado para revisión técnica por bloques
app.post("/analizar", async (req, res) => {
  const textoInforme = req.body.texto;

  console.log("📥 Texto recibido para analizar:");
  console.log(textoInforme.slice(0, 300));

  if (!textoInforme || !documentoTecnico) {
    return res.status(400).json({ error: "Falta texto o referencia técnica." });
  }

  const bloquesReferencia = dividirTextoEnBloques(documentoTecnico, 3000).slice(0, 1); // solo el primer bloque

  const respuestasIA = [];

  try {
    for (let i = 0; i < bloquesReferencia.length; i++) {
      const bloque = bloquesReferencia[i];

      const respuesta = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content: "Eres un experto en investigación de accidentes laborales. Tu tarea es identificar omisiones en los informes técnicos en función de una guía normativa."
            },
            {
              role: "user",
              content: `Lee el siguiente bloque del documento de referencia y analiza si el siguiente informe omite alguna referencia o recomendación importante. Si encuentras omisiones, indícalas con la justificación y cita textual del bloque de referencia.\n\nINFORME:\n${textoInforme}\n\nDOCUMENTO DE REFERENCIA (BLOQUE ${i + 1}):\n${bloque}`
            }
          ]
        })
      });

      const datos = await respuesta.json();
      const revision = datos.choices?.[0]?.message?.content;

      if (revision && !revision.toLowerCase().includes("no se detectan omisiones")) {
        respuestasIA.push(`🔹 Bloque ${i + 1}:\n${revision.trim()}`);
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    const resultadoFinal = respuestasIA.length
      ? respuestasIA.join("\n\n")
      : "✅ No se detectan omisiones relevantes según el análisis por bloques.";

    res.json({ revision: resultadoFinal });

  } catch (error) {
    console.error("❌ Error en análisis IA:", error);
    res.status(500).json({ error: "Fallo en análisis IA" });
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Servidor en marcha en puerto ${PORT}`);
  console.log(`Documento técnico cargado: ${documentoTecnico.length > 0 ? "✅" : "❌ NO CARGADO"}`);
});

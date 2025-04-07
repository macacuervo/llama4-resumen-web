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
app.use(express.json({ limit: "10mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

const API_KEY = process.env.API_KEY;

// ✅ Declarar la variable una sola vez
let documentoTecnico = "";

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

// ✅ Llamar a la función de carga
await cargarDocumentoTecnico();

// ================== ENDPOINTS ===================

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

// ✅ Endpoint para revisión técnica
app.post("/analizar", async (req, res) => {
  const textoInforme = req.body.texto;
  if (!textoInforme) return res.status(400).json({ error: "Falta el texto del informe." });
  if (!documentoTecnico) return res.status(500).json({ error: "No se ha cargado el documento técnico." });

  try {
    const respuesta = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct",
        messages: [
          { role: "system", content: "Eres un experto en investigación de accidentes laborales." },
          {
            role: "user",
            content: `Compara el siguiente informe con el documento técnico y genera un resumen, una revisión de carencias y recomendaciones.\n\nINFORME:\n${textoInforme}\n\nREFERENCIA:\n${documentoTecnico}`
          }
        ]
      })
    });

    const datos = await respuesta.json();
    res.json({ revision: datos.choices?.[0]?.message?.content || "Sin respuesta." });

  } catch (error) {
    console.error("❌ Error en análisis IA:", error.message);
    res.status(500).json({ error: "Fallo en análisis IA." });
  }
});

// ✅ Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor funcionando en puerto ${PORT}`));


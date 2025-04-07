import express from "express";
import cors from "cors";
import { fetch } from "undici";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import * as pdfParse from "pdf-parse";
const pdf = pdfParse.default || pdfParse;


dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

const API_KEY = process.env.API_KEY;

// ✅ Declaración SOLO una vez
let documentoTecnico = "";

// ✅ Cargar documento técnico
const rutaReferencia = path.join(__dirname, "biblioteca", "guia-insst.pdf");

async function cargarDocumentoTecnico() {
  if (fs.existsSync(rutaReferencia)) {
    const buffer = fs.readFileSync(rutaReferencia);
    const data = await pdf(buffer);
    documentoTecnico = data.text;
    console.log("✅ Documento técnico cargado");
  } else {
    console.error("❌ No se encontró guia-insst.pdf en la carpeta biblioteca.");
  }
}
await cargarDocumentoTecnico();



// ✅ Endpoint para resumen tradicional
app.post("/resumir", async (req, res) => {
  const texto = req.body.texto;
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
    console.error("Error:", error);
    res.status(500).json({ error: "Error al generar resumen." });
  }
});

// ✅ Nuevo endpoint /analizar
app.post("/analizar", async (req, res) => {
  const textoInforme = req.body.texto;
  if (!textoInforme || !documentoTecnico) {
    return res.status(400).json({ error: "Falta texto o referencia técnica." });
  }

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
    console.error("Error en análisis IA:", error);
    res.status(500).json({ error: "Fallo en análisis IA" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en marcha en puerto ${PORT}`));

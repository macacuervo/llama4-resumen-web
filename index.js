import express from "express";
import cors from "cors";
import { fetch } from "undici";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

const API_KEY = process.env.API_KEY;

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
    console.error("Error en el servidor:", error);
    res.status(500).json({ error: "Error al generar el resumen." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en marcha en puerto ${PORT}`));

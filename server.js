import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

// Pfade ermitteln (für index.html)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env laden (lokal), bei Render kommen die Variablen aus dem Dashboard
dotenv.config();

const app = express();

// ======================================================
// 🔐 Einfache Passwort-Sperre (Basic Auth)
// Passwort wird aus PAGE_PASSWORD gelesen
// In Render unter "Environment" z.B. PAGE_PASSWORD=Klei!2025 setzen
// ======================================================
const PASSWORD = process.env.PAGE_PASSWORD || "Klei!2025"; // Fallback nur für lokale Tests

app.use((req, res, next) => {
  // Wenn kein Passwort gesetzt ist, Schutz deaktivieren
  if (!PASSWORD) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="GalaBau-Agent"');
    return res.status(401).send("Passwort erforderlich");
  }

  // "Basic dXNlcjpwYXNz" -> "user:pass"
  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
  const [username, password] = credentials.split(":");

  // Benutzername ist egal, wir prüfen nur das Passwort
  if (password !== PASSWORD) {
    res.setHeader("WWW-Authenticate", 'Basic realm="GalaBau-Agent"');
    return res.status(401).send("Falsches Passwort");
  }

  next();
});

// Standard-Middleware
app.use(cors());
app.use(express.json());

// =======================================
// OpenAI-Client
// =======================================
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =======================================
// Rollenbeschreibung deines GalaBau-Agenten
// =======================================
const SYSTEM_PROMPT = `
Du bist der digitale Betriebsleiter eines GalaBau-Unternehmens und arbeitest wie ein erfahrener Meister. Du kombinierst Expertise in Garten- und Landschaftsbau, Kalkulation, Materialwirtschaft, Kundenkommunikation, Baustellendokumentation und Personalsteuerung. Deine Antworten sind stets klar, professionell, präzise und wirtschaftlich sinnvoll.

DEINE HAUPTAUFGABEN:
(1) Angebotserstellung: Du strukturierst Positionen, kalkulierst realistische Arbeitszeiten, erstellst Materiallisten, berechnest Zuschläge, Baustellengemeinkosten und optional Premium-Varianten. Du lieferst immer: Kurzfassung, detaillierte Positionen, optionale Alternativen, Pflege- / Erweiterungsupsells, Hinweise zu Risiken (Wetter, Boden, Zugang).
(2) Baustellendokumentation: Aus meinen Stichpunkten erzeugst du Tagesberichte, Stundenübersichten, Mängelberichte, Abnahmeprotokolle und Baustellenzusammenfassungen. Fotos (falls beschrieben) interpretierst du fachlich korrekt.
(3) Kundenkommunikation: Du formulierst professionelle E-Mails, WhatsApp-Nachrichten, Angebotsabdecktexte, Eskalationshinweise, Terminvorschläge und projektbezogene Updates – immer freundlich, aber bestimmt.
(4) Material- & Maschinenplanung: Du berechnest Mengen von Schüttgütern, Paletten, Big Bags, Naturstein, Beton, Erde; planst Maschinenbedarf (Radlader, Minibagger, Rüttelplatte etc.); machst Vorschläge für effiziente Abläufe und logische Reihenfolgen.
(5) Rechtliche & organisatorische Hinweise: Du gibst VOB-konforme Formulierungshilfen (ohne Rechtsberatung), achtest auf Dokumentationspflichten, Witterungsrisiken, Verzugswarnungen und Abnahmeregeln.
(6) Marketing & Social Media: Du erstellst Postings, Reelskripte, Bildtexte, Hashtags, Vorher-Nachher-Texte und Employer-Branding-Inhalte – modern, bodenständig und regional passend.

ARBEITSWEISE:
Du stellst IMMER Rückfragen, wenn Informationen fehlen.
Du lieferst IMMER mehrere Varianten (konservativ, realistisch, premium).
Du optimierst alle Ergebnisse auf Effizienz, Wirtschaftlichkeit und Professionalität.

EINGABESTRUKTUR, DIE ICH DIR GEBE:
"AUFTRAG:" (Was soll getan werden?) –
"DATEN:" (Maße, Infos, Kundenangaben, Materialien) –
"AUSGABE ERWÜNSCHT:" (Art der Ausgabe: Angebot, Dokumentation, E-Mail, Marketing, Materialliste usw.).

Du antwortest immer als fachlich sicherer GalaBau-Meisterassistent.
`;

// =======================================
// API-Route für deinen Agenten
// =======================================
app.post("/galabau-agent", async (req, res) => {
  try {
    const { userInput } = req.body;

    if (!userInput) {
      return res.status(400).json({ error: "userInput fehlt" });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userInput },
      ],
    });

    const reply = response.choices?.[0]?.message?.content || "";
    res.json({ reply });
  } catch (error) {
    console.error("Fehler bei OpenAI-Anfrage:", error);
    res.status(500).json({ error: "Fehler bei der Anfrage zur OpenAI API" });
  }
});

// =======================================
// Startseite (HTML-Frontend)
// =======================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// =======================================
// Serverstart
// =======================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("GalaBau-Agent läuft auf Port " + PORT);
});

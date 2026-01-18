import type { SupabaseClient } from "@supabase/supabase-js";

export type ChallengeSeed = {
  title: string;
  description: string;
  is_active: boolean;
};

export const CHALLENGES_SEED: ChallengeSeed[] = [
  { title: "Saluda a un desconocido", description: "Sonríe y di hola a alguien que no conozcas.", is_active: true },
  { title: "Camina 10 minutos", description: "Da un paseo corto para despejarte.", is_active: true },
  { title: "Bebe un vaso de agua", description: "Hidrátate ahora mismo.", is_active: true },
  { title: "Ordena tu escritorio", description: "Recoge 5 cosas y deja el espacio más limpio.", is_active: true },
  { title: "Escribe 3 gratitudes", description: "Apunta tres cosas por las que estés agradecido hoy.", is_active: true },
  { title: "Envía un mensaje bonito", description: "Manda un mensaje de apoyo a alguien.", is_active: true },
  { title: "Aprende una palabra nueva", description: "Busca una palabra y úsala en una frase.", is_active: true },
  { title: "Respira 1 minuto", description: "Inhala 4s, exhala 6s durante un minuto.", is_active: true },
  { title: "Estira cuello y hombros", description: "Haz 3 estiramientos suaves.", is_active: true },
  { title: "Lee 2 páginas", description: "De un libro o artículo que te interese.", is_active: true },
  { title: "Haz 10 sentadillas", description: "A tu ritmo y con buena postura.", is_active: true },
  { title: "Haz una foto bonita", description: "Encuentra algo estético y captura el momento.", is_active: true },
  { title: "Desconecta 15 min", description: "Pon el móvil en silencio y descansa.", is_active: true },
  { title: "Escucha una canción nueva", description: "Explora un artista o género distinto.", is_active: true },
  { title: "Organiza tu lista de tareas", description: "Elige 1 prioridad y 2 tareas pequeñas.", is_active: true },
  { title: "Ayuda con algo pequeño", description: "Haz un favor sencillo a alguien cerca.", is_active: true },
  { title: "Aprende un atajo", description: "Descubre un shortcut de tu móvil/PC.", is_active: true },
  { title: "Cuida una planta", description: "Riega o revisa una planta (o aprende sobre una).", is_active: true },
  { title: "Cocina algo simple", description: "Prepara un snack saludable o una receta fácil.", is_active: true },
  { title: "Escribe una idea", description: "Anota una idea para un proyecto personal.", is_active: true },
  { title: "Haz 20 segundos de plancha", description: "Activa el core con control.", is_active: true },
  { title: "Limpia tu bandeja de entrada", description: "Borra o archiva 10 correos.", is_active: true },
  { title: "Revisa tus gastos", description: "Apunta lo que gastaste hoy en 1 minuto.", is_active: true },
  { title: "Practica un idioma", description: "5 minutos con una app o leyendo algo corto.", is_active: true },
  { title: "Dibuja un garabato", description: "Sin presión: 1 minuto de doodles.", is_active: true },
  { title: "Haz una pausa de ojos", description: "Regla 20-20-20: mira lejos 20s.", is_active: true },
  { title: "Planifica tu mañana", description: "Define la primera acción del día siguiente.", is_active: true }
];

export async function seedChallenges(supabase: SupabaseClient) {
  const { data: existing, error: readError } = await supabase
    .from("challenges")
    .select("id,title");

  if (readError) throw new Error(`challenges read failed: ${readError.message}`);

  const existingTitles = new Set((existing ?? []).map((r: any) => String(r.title)));
  const toInsert = CHALLENGES_SEED.filter((c) => !existingTitles.has(c.title));

  if (toInsert.length === 0) {
    return { inserted: 0, total: CHALLENGES_SEED.length };
  }

  const { error: insertError } = await supabase.from("challenges").insert(toInsert);
  if (insertError) throw new Error(`challenges insert failed: ${insertError.message}`);

  return { inserted: toInsert.length, total: CHALLENGES_SEED.length };
}


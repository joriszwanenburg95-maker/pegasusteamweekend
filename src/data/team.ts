import type { TeamMember } from "@/lib/types";

/**
 * Selectie Pegasus Heren 1, seizoen 2026/2027 (door Joris bevestigd op 2026-09-14):
 * 14 spelers, trainer Bob, assistent Jac. Rugnummers uit de publieke Heren 1-pagina;
 * Henk, Job en Mathijs hebben nog geen bekend nummer (invullen in Selectie).
 */
export const TEAM: TeamMember[] = [
  { id: "p-dean", name: "Dean Rots", nickname: "", number: 1, position: "SV", role: "player", active: true },
  { id: "p-senna-m", name: "Senna Muller", nickname: "", number: 2, position: "PL", role: "player", active: true },
  { id: "p-pepijn", name: "Pepijn Scholten", nickname: "Pep", number: 3, position: "PL", role: "player", active: true },
  { id: "p-joris", name: "Joris Zwanenburg", nickname: "", number: 4, position: "PL", role: "player", active: true },
  { id: "p-tom", name: "Tom Smeets", nickname: "Smeets", number: 5, position: "MID", role: "player", active: true },
  { id: "p-dicky", name: "Dicky Kottink", nickname: "", number: 7, position: "SV", role: "player", active: true },
  { id: "p-wouter", name: "Wouter van de Ven", nickname: "", number: 8, position: "DIA", role: "player", active: true },
  { id: "p-koen", name: "Koen van den Borden", nickname: "", number: 9, position: "MID", role: "player", active: true },
  { id: "p-rik", name: "Rik Reinders", nickname: "", number: 10, position: "PL", role: "player", active: true },
  { id: "p-boaz", name: "Boaz Dingemanse", nickname: "", number: 12, position: "MID", role: "player", active: true },
  { id: "p-pim", name: "Pim Franken", nickname: "", number: 13, position: "LIB", role: "player", active: true },
  { id: "p-henk", name: "Henk", nickname: "", number: null, position: "", role: "player", active: true },
  { id: "p-job", name: "Job", nickname: "", number: null, position: "", role: "player", active: true },
  { id: "p-mathijs", name: "Mathijs", nickname: "Matta", number: null, position: "", role: "player", active: true },
  { id: "p-bob", name: "Bob Soberjé", nickname: "", number: null, position: "", role: "trainer", active: true },
  { id: "p-jac", name: "Jac", nickname: "", number: null, position: "", role: "assistant", active: true },
];

/** Bijnaam als die er is, anders de voornaam — zo staat hij ook in het rijschema. */
export function shortName(m: TeamMember): string {
  return (m.nickname ?? "").trim() || m.name.trim().split(" ")[0] || "—";
}

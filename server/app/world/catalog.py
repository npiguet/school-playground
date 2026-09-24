"""World catalog: lieutenants, rewards, ranks (plan Decisions 1, 6, 12, 20). French labels are UI text served by GET /api/world."""
LIEUTENANT_ORDER = ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]
# `gender` is the lieutenant's narrative gender ('f'/'m'/'fp' - feminine, masculine, feminine
# plural), the source of truth for player-facing French agreement (l'Hydre/Écho/la Chimère/les
# Sirènes/Léthé are feminine, Protée is masculine; SP3 batch review I7). The client's `agree()`
# helper (web/src/lib/world/eris.ts) reads it via GET /api/world.
LIEUTENANTS = {
    "hydre":   {"name": "L'Hydre", "gender": "f", "categories": ["agreement:number", "agreement:verb"], "min_level": "5H", "relic": "ecaille_hydre", "glyph": "🐍",
                "technique": "Elle sème des dés-accords de nombre : un -s ou un -nt qui manque, et deux têtes repoussent."},
    "echo":    {"name": "Écho", "gender": "f", "categories": ["homophone"], "min_level": "5H", "relic": "voix_echo", "glyph": "🔊",
                "technique": "Elle répète un mot qui sonne juste mais s'écrit faux : a ou à, et ou est, son ou sont."},
    "chimere": {"name": "La Chimère", "gender": "f", "categories": ["agreement:gender"], "min_level": "5H", "relic": "criniere_chimere", "glyph": "🦁",
                "technique": "Ses têtes se disputent le genre : un masculin ici, un féminin là."},
    "protee":  {"name": "Protée", "gender": "m", "categories": ["agreement:participle"], "min_level": "8H", "relic": "perle_protee", "glyph": "🌊",
                "technique": "Il change la forme des participes passés : -é, -ée, -és, -ées, selon être ou avoir."},
    "sirenes": {"name": "Les Sirènes", "gender": "fp", "categories": ["derived:sirenes"], "min_level": "5H", "relic": "plume_sirene", "glyph": "🎶",
                "technique": "Leur chant éloigne le sujet de son verbe, le cache derrière un pronom ou le met après."},
    "lethe":   {"name": "Léthé", "gender": "f", "categories": ["derived:lethe"], "min_level": "5H", "relic": "pavot_lethe", "glyph": "🌫️",
                "technique": "Elle endort l'attention dans le dernier tiers du texte, là où l'on ne relit plus."},
}
TINTS = ["bronze", "ecume", "olivier", "braise", "jade", "argent"]
def _r(id, kind, name, desc, source): return {"id": id, "kind": kind, "name": name, "desc": desc, "source": source}
REWARDS = {r["id"]: r for r in [
    _r("ecaille_hydre", "relic", "Écaille de l'Hydre", "Une écaille vert olive, tiède comme un marais.", "Neutraliser l'Hydre"),
    _r("voix_echo", "relic", "Voix d'Écho", "Un coquillage qui répète le dernier mot juste.", "Neutraliser Écho"),
    _r("criniere_chimere", "relic", "Crinière de la Chimère", "Trois mèches de feu qui ne brûlent pas.", "Neutraliser la Chimère"),
    _r("perle_protee", "relic", "Perle de Protée", "Une perle qui garde toujours la même forme.", "Neutraliser Protée"),
    _r("plume_sirene", "relic", "Plume de Sirène", "Une plume bleue qui ne chante plus.", "Neutraliser les Sirènes"),
    _r("pavot_lethe", "relic", "Pavot de Léthé", "Un pavot rouge qui tient éveillé.", "Neutraliser Léthé"),
    _r("tint:ecume", "tint", "Teinte Écume", "Ton dragon prend la couleur de la mer Égée.", "Quête de l'Oracle"),
    _r("tint:olivier", "tint", "Teinte Olivier", "Ton dragon prend le vert des oliviers.", "Quête de l'Oracle"),
    _r("tint:braise", "tint", "Teinte Braise", "Ton dragon rougeoie comme une braise.", "Quête de l'Oracle"),
    _r("tint:jade", "tint", "Teinte Jade", "Ton dragon brille d'un vert de jade.", "Quête de l'Oracle"),
    _r("tint:argent", "tint", "Teinte Argent", "Ton dragon devient argenté comme la lune.", "Quête de l'Oracle"),
    _r("sandales_hermes", "gear", "Sandales d'Hermès", "Des sandales ailées : rien ne t'échappe.", "Vaincre Éris (première fois)"),
    _r("egide", "gear", "Égide", "Le bouclier d'Athéna, contre tous les dés-accords.", "Vaincre Éris (deuxième fois)"),
    _r("foudre_zeus", "gear", "Foudre de Zeus", "La foudre en personne. Éris n'a plus qu'à bien se tenir.", "Vaincre Éris (troisième fois)"),
    _r("decor:lanterne", "decor", "Lanterne d'Hestia", "Une lanterne qui éclaire ta cabane.", "Deux quêtes du tableau"),
    _r("decor:tapis", "decor", "Tapis de Pénélope", "Un tapis tissé avec patience.", "Quatre quêtes du tableau"),
    _r("decor:bibliotheque", "decor", "Étagère d'Alexandrie", "Une étagère pour tes parchemins préférés.", "Six quêtes du tableau"),
    _r("decor:trophee", "decor", "Trophée de la Pomme", "Une pomme d'or… en bois peint.", "Huit quêtes du tableau"),
    _r("decor:fresque", "decor", "Fresque des Muses", "Les neuf Muses peintes sur ton mur.", "Sixième quête de l'Oracle"),
]}
ORACLE_REWARDS = ["tint:ecume", "tint:olivier", "tint:braise", "tint:jade", "tint:argent", "decor:fresque"]
DECOR_ORDER = ["decor:lanterne", "decor:tapis", "decor:bibliotheque", "decor:trophee"]
BOSS_REWARDS = {1: "sandales_hermes", 2: "egide", 3: "foudre_zeus"}
RANKS = [(0, "Recrue du camp"), (150, "Scribe des Muses"), (400, "Sentinelle des textes"), (800, "Garde des Parchemins"),
         (1400, "Œil d'Argus"), (2200, "Main d'Ariane"), (3200, "Bouclier de Persée"), (4500, "Sagesse d'Athéna"),
         (6000, "Fléau d'Éris"), (8000, "Légende du camp")]
QUEST_BONUS = {"board": 60, "oracle": 150, "boss": 300, "mastery": 200, "weekly": 40}
MASTERY = {"min_days": 3, "min_traps": 10, "rate": 0.8}

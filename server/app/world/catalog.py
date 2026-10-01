"""World catalog: lieutenants, rewards, the seals' materials and trophies, the stall's accessories, decor and houses (spec 2026-09-29 drachmes) (plan Decisions 1, 6, 12, 20; spec 2026-09-29 lieutenant levels; the dragon's stages, which replaced the XP ranks, live in app.world.dragon). French labels are UI text served by GET /api/world."""
LIEUTENANT_ORDER = ["hydre", "echo", "chimere", "protee", "sirenes", "lethe"]
# `gender` is the lieutenant's narrative gender ('f'/'m'/'fp' - feminine, masculine, feminine
# plural), the source of truth for player-facing French agreement (l'Hydre/Écho/la Chimère/les
# Sirènes/Léthé are feminine, Protée is masculine; SP3 batch review I7). The client's `agree()`
# helper (web/src/lib/world/eris.ts) reads it via GET /api/world.
LIEUTENANTS = {
    "hydre":   {"name": "L'Hydre", "gender": "f", "categories": ["agreement:number", "agreement:verb"], "min_level": "5H",
                "technique": "Elle sème des dés-accords de nombre\u202f: un -s ou un -nt qui manque, et deux têtes repoussent."},
    "echo":    {"name": "Écho", "gender": "f", "categories": ["homophone"], "min_level": "5H",
                "technique": "Elle répète un mot qui sonne juste mais s'écrit faux\u202f: a ou à, et ou est, son ou sont."},
    "chimere": {"name": "La Chimère", "gender": "f", "categories": ["agreement:gender"], "min_level": "5H",
                "technique": "Ses têtes se disputent le genre\u202f: un masculin ici, un féminin là."},
    "protee":  {"name": "Protée", "gender": "m", "categories": ["agreement:participle"], "min_level": "8H",
                "technique": "Il change la forme des participes passés\u202f: -é, -ée, -és, -ées, selon être ou avoir."},
    "sirenes": {"name": "Les Sirènes", "gender": "fp", "categories": ["derived:sirenes"], "min_level": "5H",
                "technique": "Leur chant éloigne le sujet de son verbe, le cache derrière un pronom ou le met après."},
    "lethe":   {"name": "Léthé", "gender": "f", "categories": ["derived:lethe"], "min_level": "5H",
                "technique": "Elle endort l'attention dans le dernier tiers du texte, là où l'on ne relit plus."},
}
TINTS = ["bronze", "ecume", "olivier", "braise", "jade", "argent"]
def _r(id, kind, name, desc, source): return {"id": id, "kind": kind, "name": name, "desc": desc, "source": source}
REWARDS = {r["id"]: r for r in [
    _r("tint:ecume", "tint", "Teinte Écume", "Ton dragon prend la couleur de la mer Égée.", "Quête de l'Oracle"),
    _r("tint:olivier", "tint", "Teinte Olivier", "Ton dragon prend le vert des oliviers.", "Quête de l'Oracle"),
    _r("tint:braise", "tint", "Teinte Braise", "Ton dragon rougeoie comme une braise.", "Quête de l'Oracle"),
    _r("tint:jade", "tint", "Teinte Jade", "Ton dragon brille d'un vert de jade.", "Quête de l'Oracle"),
    _r("tint:argent", "tint", "Teinte Argent", "Ton dragon devient argenté comme la lune.", "Quête de l'Oracle"),
    _r("sandales_hermes", "gear", "Sandales d'Hermès", "Des sandales ailées\u202f: rien ne t'échappe.", "Vaincre Éris (première fois)"),
    _r("egide", "gear", "Égide", "Le bouclier d'Athéna, contre tous les dés-accords.", "Vaincre Éris (deuxième fois)"),
    _r("foudre_zeus", "gear", "Foudre de Zeus", "La foudre en personne. Éris n'a plus qu'à bien se tenir.", "Vaincre Éris (troisième fois)"),
    _r("decor:lanterne", "decor", "Lanterne d'Hestia", "Une lanterne qui éclaire ta cabane.", "Deux quêtes du mur"),
    _r("decor:tapis", "decor", "Tapis de Pénélope", "Un tapis tissé avec patience.", "Quatre quêtes du mur"),
    _r("decor:bibliotheque", "decor", "Étagère d'Alexandrie", "Une étagère pour tes parchemins préférés.", "Six quêtes du mur"),
    _r("decor:trophee", "decor", "Trophée de la Pomme", "Une pomme d'or… en bois peint.", "Huit quêtes du mur"),
    _r("decor:fresque", "decor", "Fresque des Muses", "Les neuf Muses peintes sur ton mur.", "Sixième quête de l'Oracle"),
    # Spec 2026-09-29 drachmes §2: Hermès's four pieces of decor and the two houses, sold at his stall.
    _r("decor:amphore", "decor", "Amphore peinte", "Un héros y court en figures noires, sans jamais s'arrêter.", "L'étal d'Hermès"),
    _r("decor:chouette", "decor", "Chouette de marbre", "La chouette d'Athéna veille sur tes parchemins, même la nuit.", "L'étal d'Hermès"),
    _r("decor:mosaique", "decor", "Mosaïque des Muses", "Trois Muses en petites tuiles : la lyre, le rouleau et le masque.", "L'étal d'Hermès"),
    _r("decor:bouclier", "decor", "Bouclier d'apparat", "Un bouclier de bronze poli, orné de Pégase. Il brille plus qu'il ne protège.", "L'étal d'Hermès"),
    _r("house:villa", "house", "La villa", "Des murs peints d'une frise, deux fenêtres, et de la place pour six décors.", "L'étal d'Hermès"),
    _r("house:palais", "house", "Le palais", "Des colonnes, un sol de mosaïque, une cour sous les arcades, et de la place pour neuf décors.", "L'étal d'Hermès"),
]}
# Spec 2026-09-29 lieutenant levels §1: five seals per lieutenant, each a material, each paying the
# lieutenant's keepsake in that material (the art track's trophies: the old relic as a statuette).
MATERIALS = ("bois", "bronze", "argent", "or", "orichalque")
SEAL_TITLES = ("Sceau de bois", "Sceau de bronze", "Sceau d'argent", "Sceau d'or", "Sceau d'orichalque")
OF_LIEUTENANT = {"hydre": "de l'Hydre", "echo": "d'Écho", "chimere": "de la Chimère", "protee": "de Protée",
                 "sirenes": "des Sirènes", "lethe": "de Léthé"}
TROPHY_OF = {"hydre": "Écaille de l'Hydre", "echo": "Voix d'Écho", "chimere": "Crinière de la Chimère",
             "protee": "Perle de Protée", "sirenes": "Plume de Sirène", "lethe": "Pavot de Léthé"}
_TROPHY_DESC = ("Un souvenir taillé dans le bois d'olivier.", "Un souvenir coulé dans le bronze, gravé de quelques traits.",
                "Un souvenir d'argent poli, gravé de motifs.", "Un souvenir d'or, orné de reliefs et de pierres fines.",
                "Un souvenir d'orichalque, le métal rouge de l'Atlantide, ciselé de filigranes.")


def trophy_id(key: str, level: int) -> str:
    return f"trophy:{key}:{level}"


REWARDS.update({trophy_id(k, level): _r(trophy_id(k, level), "trophy", f"{TROPHY_OF[k]} en {MATERIALS[level - 1]}",
                                        _TROPHY_DESC[level - 1], f"{SEAL_TITLES[level - 1]} {OF_LIEUTENANT[k]}")
                for k in LIEUTENANT_ORDER for level in range(1, len(MATERIALS) + 1)})
# Spec 2026-09-29 drachmes §2, §4 (art spec Phase 4): the dragon's accessories, one set of four per
# lieutenant, each piece on sale from its lieutenant's seal (cou bronze, queue argent, dos or, tête
# orichalque). Each entry: the name, and the name with its article (the stall's confirmation).
STALL = "L'étal d'Hermès"
SLOTS = ("cou", "queue", "dos", "tete")
SLOT_LEVEL = {"cou": 2, "queue": 3, "dos": 4, "tete": 5}
ACCESSORY_SETS: dict[str, dict[str, tuple[str, str]]] = {
    "hydre": {"cou": ("Collier d'écailles vertes", "le collier d'écailles vertes"),
              "queue": ("Anneau de serpents de bronze", "l'anneau de serpents de bronze"),
              "dos": ("Selle de cuir des marais", "la selle de cuir des marais"),
              "tete": ("Casque de bronze à crête de serpents", "le casque de bronze à crête de serpents")},
    "echo": {"cou": ("Pendentif-conque", "le pendentif-conque"),
             "queue": ("Clochettes de bronze", "les clochettes de bronze"),
             "dos": ("Cape couleur de roche", "la cape couleur de roche"),
             "tete": ("Diadème de coquillages", "le diadème de coquillages")},
    "chimere": {"cou": ("Torque en cornes de chèvre", "le torque en cornes de chèvre"),
                "queue": ("Garde-queue à tête de serpent", "le garde-queue à tête de serpent"),
                "dos": ("Cape rouge braise", "la cape rouge braise"),
                "tete": ("Casque à crinière de lion", "le casque à crinière de lion")},
    "protee": {"cou": ("Collier de perles", "le collier de perles"),
               "queue": ("Anneau de corail", "l'anneau de corail"),
               "dos": ("Harnais d'écailles marines", "le harnais d'écailles marines"),
               "tete": ("Couronne de corail", "la couronne de corail")},
    "sirenes": {"cou": ("Pendentif en forme de lyre", "le pendentif en forme de lyre"),
                "queue": ("Rubans de plumes", "les rubans de plumes"),
                "dos": ("Harnais de plumes", "le harnais de plumes"),
                "tete": ("Aigrette de plumes bleues", "l'aigrette de plumes bleues")},
    "lethe": {"cou": ("Collier de pavots rouges", "le collier de pavots rouges"),
              "queue": ("Petite lanterne d'argent", "la petite lanterne d'argent"),
              "dos": ("Cape bleu nuit étoilée", "la cape bleu nuit étoilée"),
              "tete": ("Couronne de pavots", "la couronne de pavots")},
}
_WORN_ON = {"cou": "à porter au cou", "queue": "à porter à la queue", "dos": "à porter sur le dos", "tete": "à porter sur la tête"}


def accessory_id(key: str, slot: str) -> str:
    return f"accessory:{key}-{slot}"


REWARDS.update({accessory_id(k, s): _r(accessory_id(k, s), "accessory", ACCESSORY_SETS[k][s][0],
                                       f"Une parure {OF_LIEUTENANT[k]}, {_WORN_ON[s]}.", STALL)
                for k in LIEUTENANT_ORDER for s in SLOTS})
ORACLE_REWARDS = ["tint:ecume", "tint:olivier", "tint:braise", "tint:jade", "tint:argent", "decor:fresque"]
DECOR_ORDER = ["decor:lanterne", "decor:tapis", "decor:bibliotheque", "decor:trophee"]
BOSS_REWARDS = {1: "sandales_hermes", 2: "egide", 3: "foudre_zeus"}
QUEST_BONUS = {"board": 60, "oracle": 150, "boss": 300, "weekly": 40}

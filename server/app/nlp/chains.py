"""Agreement chains derived from the dependency parse of the reference text.

A chain links a controller (the token that dictates agreement) to the targets that
must agree with it. Chains only drive explanations and the Fil d'Ariane; the reference
text stays the answer key (spec §1.3). Confidence is conservative (plan decision 3): a
chain is `high` only when the parse and the morphology agree with each other and the
structure is simple; `medium` when consistent but structurally harder (coordination,
`qui`, long distance, participle with avoir); `low` otherwise.

Pure functions over token dicts (`i`, `text`, `lemma`, `pos`, `morph`, `head`, `dep`);
no spaCy objects, so the logic is testable on hand-built tokens.
"""
from __future__ import annotations

SUBJECT_DEPS = {"nsubj", "nsubj:pass"}
NOMINAL_DEPS = {"det", "amod", "nummod", "det:poss"}
AUX_DEPS = {"aux", "aux:pass", "aux:tense", "cop"}
# A word with one of these children is a compound-tense / passive participle whatever its POS tag:
# the small model tags « Athéna l'avait choisie » as ADJ + aux:tense (SP2 playability P1-3).
COMPOUND_AUX_DEPS = {"aux", "aux:pass", "aux:tense"}
# Proper-name complements that may sit inside a coordinated subject and still leave it quotable
# as written (« la princesse Nausicaa et ses servantes »).
NAME_COMPLEMENT_DEPS = {"nmod", "appos", "flat:name", "flat"}
CLITIC_COD = {"le", "la", "les", "l'", "me", "te", "nous", "vous", "se", "m'", "t'", "s'"}

NOMINAL_POS = {"NOUN", "PROPN"}
SIMPLE_CONTROLLER_POS = {"NOUN", "PROPN", "PRON"}
# Subjects whose form does not dictate agreement the usual way: never a high-confidence chain.
# « on » may stand for « nous » (« on est partis »); with « ce » the verb agrees with the attribute
# (« ce sont des fées »).
INDEFINITE_SUBJECTS = {"on", "ce", "c'", "ç'"}
# Verbs whose « il » is impersonal (no referent): « il pleut », « il faut ».
IMPERSONAL_VERB_LEMMAS = {"falloir", "pleuvoir", "neiger", "grêler", "venter", "bruiner"}
MAX_HIGH_DISTANCE = 8          # subject → verb distance beyond which a chain is at most medium
MAX_HIGH_NOMINAL_DISTANCE = 4  # noun → dependent distance beyond which a nominal chain is at most medium


def _children(tokens: list[dict], i: int) -> list[dict]:
    return [t for t in tokens if t["head"] == i and t["i"] != i]


def _fin(t: dict) -> bool:
    return t["pos"] in {"VERB", "AUX"} and t.get("morph", {}).get("VerbForm") == "Fin"


def _part(t: dict) -> bool:
    return t.get("morph", {}).get("VerbForm") == "Part"


def _feat(t: dict, keys: list[str]) -> dict[str, str]:
    morph = t.get("morph", {})
    return {k: morph[k] for k in keys if k in morph}


def _lower(text: str) -> str:
    return text.lower().replace("’", "'")


def _adjectival_participle(tokens: list[dict], c: dict) -> bool:
    """`acl` participle without its own auxiliary: behaves like an adjective of the noun."""
    return c["dep"] == "acl" and _part(c) and not any(a["dep"] in AUX_DEPS for a in _children(tokens, c["i"]))


def has_own_auxiliary(tokens: list[dict], t: dict) -> bool:
    """True when `t` heads an aux / aux:tense / aux:pass child: a compound tense or a passive,
    so `t` is a participle even when the tagger called it an adjective."""
    return any(a["dep"] in COMPOUND_AUX_DEPS for a in _children(tokens, t["i"]))


def _agrees(morph: dict, features: dict, keys: tuple[str, ...]) -> bool:
    """True when every key present on both sides has the same value."""
    return all(morph[k] == features[k] for k in keys if k in morph and k in features)


def nominal_group(tokens: list[dict], noun_i: int) -> list[int]:
    """Contiguous ids of the noun's det/adj group: dependents before the noun, the noun,
    adjectives / adjectival participles after it. Stops at the first gap on each side."""
    by_i = {t["i"]: t for t in tokens}

    def modifies_group_member(t: dict) -> bool:
        # "les très grandes fées": très → grandes (amod) → fées
        if t["dep"] != "advmod":
            return False
        parent = by_i.get(t["head"])
        return (parent is not None and parent["i"] != noun_i and parent["head"] == noun_i
                and (parent["dep"] in NOMINAL_DEPS or _adjectival_participle(tokens, parent)))

    def qualifies_left(t: dict) -> bool:
        return (t["head"] == noun_i and t["dep"] in NOMINAL_DEPS) or modifies_group_member(t)

    def qualifies_right(t: dict) -> bool:
        return ((t["head"] == noun_i and (t["dep"] == "amod" or _adjectival_participle(tokens, t)))
                or modifies_group_member(t))

    ids = [noun_i]
    j = noun_i - 1
    while j in by_i and qualifies_left(by_i[j]):
        ids.append(j)
        j -= 1
    j = noun_i + 1
    while j in by_i and qualifies_right(by_i[j]):
        ids.append(j)
        j += 1
    return sorted(ids)


def coordinated_group(tokens: list[dict], members: list[int]) -> list[int]:
    """The ids of a coordinated subject (« le cuisinier et sa fille »).

    When the span from the first member's group to the last member is made only of the members'
    det/adj groups, their proper-name complements, the coordinating words and the commas between
    members, the whole contiguous span is returned so an explanation can quote it exactly as
    written, determiners included. Otherwise only the bare member heads are returned — a
    non-contiguous group the client treats as not quotable: quoting the span would drag in words
    that are not subjects, as in « Le soir de l'événement, le cuisinier et sa fille coupaient »
    when the parser attached « soir » as the subject (SP2 playability P1-2)."""
    by_i = {t["i"]: t for t in tokens}
    covered: set[int] = set()
    for m in members:
        covered.update(nominal_group(tokens, m) if by_i[m]["pos"] in NOMINAL_POS else [m])
    lo, hi = min(covered), max(covered)
    for i in range(lo, hi + 1):
        if i in covered:
            continue
        t = by_i.get(i)
        if t is None:
            return sorted(members)
        if t["dep"] == "cc":
            continue
        if t["pos"] == "PROPN" and t["head"] in members and t["dep"] in NAME_COMPLEMENT_DEPS:
            continue
        if t["pos"] == "PUNCT" and t["text"] == "," and (i - 1) in covered and (i + 1) in covered:
            continue
        return sorted(members)
    return list(range(lo, hi + 1))


def _chain(kind: str, controller: int, controller_group: list[int], targets: list[int], features: dict,
           confidence: str, via: str | None = None, via_token: int | None = None,
           rule: str | None = None) -> dict:
    targets = sorted(targets)
    return {"id": None, "kind": kind, "controller": controller, "controller_group": controller_group,
            "targets": targets, "via": via, "via_token": via_token, "features": features,
            "confidence": confidence, "distance": min(abs(t - controller) for t in targets), "rule": rule}


def _nominal_chains(tokens: list[dict]) -> list[dict]:
    chains = []
    for n in tokens:
        if n["pos"] not in NOMINAL_POS:
            continue
        deps = [c for c in _children(tokens, n["i"])
                if c["dep"] in NOMINAL_DEPS or _adjectival_participle(tokens, c)]
        if not deps:
            continue
        features = _feat(n, ["Gender", "Number"])
        consistent = all(_agrees(d.get("morph", {}), features, ("Gender", "Number")) for d in deps)
        near = all(abs(d["i"] - n["i"]) <= MAX_HIGH_NOMINAL_DISTANCE for d in deps)
        if consistent and "Number" in features and near:
            confidence = "high"
        elif consistent and "Number" in features:
            confidence = "medium"
        else:
            confidence = "low"
        chains.append(_chain("nominal", n["i"], nominal_group(tokens, n["i"]), [d["i"] for d in deps],
                             features, confidence))
    return chains


class _Controller:
    """The subject side of a predicate: who dictates agreement and how it was reached."""

    def __init__(self, tokens: list[dict], controller: int, via: str | None, via_token: int | None,
                 impersonal: bool = False) -> None:
        by_i = {t["i"]: t for t in tokens}
        ctrl = by_i[controller]
        self.i = controller
        self.pos = ctrl["pos"]
        self.via = via
        self.via_token = via_token
        self.impersonal = impersonal
        conj = sorted(c["i"] for c in _children(tokens, controller) if c["dep"] == "conj")
        if conj:
            self.via = via or "conj"
            self.group = coordinated_group(tokens, [controller] + conj)
            self.features = {**_feat(ctrl, ["Gender", "Person"]), "Number": "Plur"}
        else:
            self.group = nominal_group(tokens, controller) if ctrl["pos"] in NOMINAL_POS else [controller]
            self.features = _feat(ctrl, ["Gender", "Number", "Person"])
        if ctrl["pos"] in NOMINAL_POS:
            self.features.setdefault("Person", "3")

    def cap(self, confidence: str) -> str:
        """An impersonal or indefinite subject is never a high-confidence controller."""
        return "medium" if self.impersonal and confidence == "high" else confidence

    def confidence(self, consistent: bool, distance: int, via: str | None = None) -> str:
        via = via or self.via
        if (consistent and distance <= MAX_HIGH_DISTANCE and via in (None, "aux")
                and self.pos in SIMPLE_CONTROLLER_POS and "Number" in self.features):
            return self.cap("high")
        if consistent and "Number" in self.features:
            return "medium"
        return "low"


def _impersonal_subject(tokens: list[dict], h: dict, s: dict) -> bool:
    if s["pos"] != "PRON":
        return False
    low = _lower(s["text"])
    if low in INDEFINITE_SUBJECTS:
        return True
    if low != "il":
        return False
    kids = _children(tokens, h["i"])
    if h["lemma"] in IMPERSONAL_VERB_LEMMAS:
        return True
    if h["lemma"] == "avoir" and any(_lower(c["text"]) == "y" for c in kids):
        return True  # il y a
    return h["lemma"] == "agir" and any(_lower(c["text"]) in {"s'", "se"} for c in kids)  # il s'agit


def _subject_controller(tokens: list[dict], h: dict, s: dict) -> _Controller:
    if _lower(s["text"]) == "qui" and s["pos"] == "PRON" and h["dep"] == "acl:relcl":
        return _Controller(tokens, h["head"], "qui", s["i"])
    return _Controller(tokens, s["i"], None, None, impersonal=_impersonal_subject(tokens, h, s))


def _subject_verb_chain(tokens: list[dict], h: dict, ctrl: _Controller) -> dict | None:
    targets = ([h["i"]] if _fin(h) else []) + [a["i"] for a in _children(tokens, h["i"])
                                               if a["dep"] in AUX_DEPS and _fin(a)]
    if not targets:
        return None
    via = "aux" if ctrl.via is None and not _fin(h) else ctrl.via
    by_i = {t["i"]: t for t in tokens}
    consistent = all(_agrees(by_i[t].get("morph", {}), ctrl.features, ("Number", "Person")) for t in targets)
    distance = min(abs(t - ctrl.i) for t in targets)
    confidence = ctrl.confidence(consistent, distance, via)
    return _chain("subject_verb", ctrl.i, ctrl.group, targets, ctrl.features, confidence, via, ctrl.via_token)


def _agreeing_target_chain(kind: str, h: dict, ctrl: _Controller) -> dict:
    """Chain whose single target `h` must carry the controller's Gender/Number (attribute, participle with être).

    A predicate noun (« elle est médecin ») does not inflect for gender: only Number is checked and
    recorded, so no explanation ever presents a gender rule for it."""
    if h["pos"] == "NOUN":
        keys = ("Number",)
        features = {k: v for k, v in ctrl.features.items() if k in keys}
    else:
        keys = ("Gender", "Number")
        features = ctrl.features
    consistent = _agrees(h.get("morph", {}), features, keys)
    confidence = ctrl.confidence(consistent, abs(h["i"] - ctrl.i)) if "Number" in features else "low"
    return _chain(kind, ctrl.i, ctrl.group, [h["i"]], features, confidence, ctrl.via, ctrl.via_token)


def _participle_avoir_chain(tokens: list[dict], h: dict, ctrl: _Controller) -> dict:
    objs = [c for c in _children(tokens, h["i"]) if c["dep"] == "obj" and c["i"] < h["i"]]
    for o in objs:
        if o["pos"] != "PRON":
            continue
        low = _lower(o["text"])
        if low in CLITIC_COD:
            features = _feat(o, ["Gender", "Number", "Person"])
            return _chain("participle_avoir", o["i"], [o["i"]], [h["i"]], features, "medium", rule="cod_before")
        if low in {"que", "qu'"} and o.get("morph", {}).get("PronType") == "Rel" and h["dep"] == "acl:relcl":
            antecedent = _Controller(tokens, h["head"], "que", o["i"])
            return _chain("participle_avoir", antecedent.i, antecedent.group, [h["i"]], antecedent.features,
                          "medium", "que", o["i"], rule="cod_before")
    morph = h.get("morph", {})
    unmarked = morph.get("Gender", "Masc") == "Masc" and morph.get("Number", "Sing") == "Sing"
    return _chain("participle_avoir", ctrl.i, ctrl.group, [h["i"]], ctrl.features,
                  ctrl.cap("high") if unmarked else "low", ctrl.via, ctrl.via_token, rule="no_agreement")


def _predicate_chains(tokens: list[dict]) -> list[dict]:
    chains = []
    for h in tokens:
        kids = _children(tokens, h["i"])
        s = next((c for c in kids if c["dep"] in SUBJECT_DEPS), None)
        if s is None:
            continue
        ctrl = _subject_controller(tokens, h, s)
        sv = _subject_verb_chain(tokens, h, ctrl)
        if sv is not None:
            chains.append(sv)
        aux = [a for a in kids if a["dep"] in AUX_DEPS]
        # A participle with a bare copula, or an ADJ-tagged word with its own auxiliary (« l'avait
        # choisie »): both are participles for the être/avoir rules, whatever the tagger said.
        if aux and (_part(h) or has_own_auxiliary(tokens, h)):
            lemmas = {a["lemma"] for a in aux}
            if "être" in lemmas or any(a["dep"] == "aux:pass" for a in aux):
                chains.append(_agreeing_target_chain("participle_etre", h, ctrl))
            elif "avoir" in lemmas:
                chains.append(_participle_avoir_chain(tokens, h, ctrl))
        elif h["pos"] in {"ADJ", "NOUN"} and any(a["dep"] == "cop" for a in kids):
            # A participle with a copula has an auxiliary child and was handled above as participle_etre.
            chains.append(_agreeing_target_chain("attribute", h, ctrl))
    return chains


def build_chains(tokens: list[dict]) -> list[dict]:
    """All agreement chains of a token list, ids assigned in creation order."""
    chains = [c for c in _nominal_chains(tokens) + _predicate_chains(tokens) if c["targets"]]
    for n, c in enumerate(chains):
        c["id"] = n
    return chains

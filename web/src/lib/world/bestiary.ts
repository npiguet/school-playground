// The bestiary: real myth facts in French, sourced from the classical texts named, kept apart
// from the game's fiction (spec §2, §3.6; plan Decision 13). Every entry separates « Le mythe »
// (facts, sources) from « Au camp » (the game's fiction, clearly labelled) so the child never
// confuses the two. Facts were checked against the ancient sources cited in `sources` before
// being written here; keep them verbatim.
import { ART } from './art';

export interface BestiaryEntry {
  key: string;
  name: string;
  kind: 'monster' | 'boss' | 'tool' | 'place' | 'companion';
  art: string;
  teaser: string;
  facts: string[];
  sources: string;
  inGame: string;
}

export const BESTIARY: BestiaryEntry[] = [
  {
    key: 'hydre',
    name: "L'Hydre de Lerne",
    kind: 'monster',
    art: ART.lieutenants.hydre,
    teaser: "Un serpent d'eau à plusieurs têtes : quand on en coupe une, d'autres repoussent.",
    facts: [
      "L'Hydre vivait dans les marais de Lerne, près d'Argos. Elle est la fille de Typhon et d'Échidna, comme la Chimère.",
      "La tuer fut le deuxième des douze travaux d'Héraclès. À chaque tête coupée, deux repoussaient ; son neveu Iolaos brûla les cous avec des torches pour les empêcher de repousser.",
      "La tête du milieu était immortelle : Héraclès l'enterra sous un énorme rocher.",
      "Héraclès trempa ses flèches dans le venin de l'Hydre. Eurysthée refusa de compter ce travail, parce qu'Héraclès avait été aidé.",
    ],
    sources: 'Hésiode, Théogonie ; Apollodore, Bibliothèque, II, 5, 2.',
    inGame: "Au camp, l'Hydre sème les dés-accords de nombre : un pluriel oublié, et deux autres se cachent plus loin.",
  },
  {
    key: 'echo',
    name: 'Écho',
    kind: 'monster',
    art: ART.lieutenants.echo,
    teaser: 'Une nymphe condamnée à ne répéter que les derniers mots des autres.',
    facts: [
      "Écho était une nymphe des montagnes (une oréade). Héra la punit parce qu'elle la retenait par ses bavardages pendant que Zeus s'échappait : elle ne pourrait plus que répéter les derniers mots entendus.",
      'Elle tomba amoureuse de Narcisse, qui la repoussa. De chagrin, elle se cacha dans les grottes et se consuma jusqu\'à n\'être plus qu\'une voix.',
      "C'est d'elle que vient le mot « écho » : un son qui revient, répété par les rochers.",
      "Ovide raconte son histoire dans les Métamorphoses, entremêlée à celle de Narcisse, qui tombe amoureux de son reflet.",
    ],
    sources: 'Ovide, Métamorphoses, livre III.',
    inGame: "Au camp, Écho répète un mot qui sonne juste mais s'écrit faux : a pour à, et pour est.",
  },
  {
    key: 'chimere',
    name: 'La Chimère',
    kind: 'monster',
    art: ART.lieutenants.chimere,
    teaser: 'Lion, chèvre et serpent en une seule bête, qui crache le feu.',
    facts: [
      "Selon Hésiode, la Chimère avait trois têtes : une de lion, une de chèvre et une de serpent (dragon). Homère dit qu'elle soufflait du feu.",
      'Elle ravageait la Lycie, en Asie Mineure. Le héros Bellérophon la tua en volant sur le cheval ailé Pégase.',
      "Elle est la sœur de l'Hydre et de Cerbère : tous sont enfants de Typhon et d'Échidna.",
      "Aujourd'hui, une « chimère » désigne un rêve impossible ou une créature faite de morceaux qui ne vont pas ensemble.",
    ],
    sources: 'Homère, Iliade, VI ; Hésiode, Théogonie ; Apollodore, Bibliothèque, II, 3.',
    inGame: 'Au camp, ses têtes se disputent le genre des mots : un masculin ici, un féminin là.',
  },
  {
    key: 'protee',
    name: 'Protée',
    kind: 'monster',
    art: ART.lieutenants.protee,
    teaser: 'Le Vieillard de la mer, qui change de forme pour ne pas répondre.',
    facts: [
      'Protée est un dieu marin, gardien des troupeaux de phoques de Poséidon. Il connaît le passé, le présent et l\'avenir, mais refuse de le dire.',
      'Pour échapper à ceux qui l\'interrogent, il se transforme : lion, serpent, panthère, sanglier, eau qui coule, arbre…',
      "Dans l'Odyssée, Ménélas, conseillé par la fille de Protée, Idothée, le saisit et le tient fermement jusqu'à ce qu'il reprenne sa vraie forme et réponde.",
      "L'adjectif « protéiforme » vient de lui : qui change sans cesse de forme.",
    ],
    sources: 'Homère, Odyssée, chant IV.',
    inGame: 'Au camp, Protée change la forme des participes passés : -é, -ée, -és, -ées.',
  },
  {
    key: 'sirenes',
    name: 'Les Sirènes',
    kind: 'monster',
    art: ART.lieutenants.sirenes,
    teaser: 'Leur chant attire les marins vers les rochers.',
    facts: [
      "Dans l'Odyssée, Circé prévient Ulysse : le chant des Sirènes attire les marins vers la mort. Ulysse bouche les oreilles de ses compagnons avec de la cire et se fait attacher au mât pour écouter sans céder.",
      "Dans l'Antiquité, les Sirènes sont des femmes-oiseaux : un visage de femme sur un corps d'oiseau. Les sirènes à queue de poisson viennent du Moyen Âge.",
      'Le musicien Orphée, à bord du navire Argo, couvrit leur chant avec sa lyre pour sauver les Argonautes.',
      'Les Sirènes sont associées aux Muses : dans certaines légendes, elles défient les Muses à un concours de chant, et les Muses l'emportent.',
    ],
    sources: 'Homère, Odyssée, chant XII ; Apollonios de Rhodes, Argonautiques, IV ; Pausanias, Description de la Grèce, IX, 34.',
    inGame: 'Au camp, leur chant éloigne le sujet de son verbe, le cache derrière un pronom ou le met après.',
  },
  {
    key: 'lethe',
    name: 'Léthé',
    kind: 'monster',
    art: ART.lieutenants.lethe,
    teaser: "Le fleuve de l'Oubli, aux Enfers.",
    facts: [
      'Léthé est un fleuve des Enfers : les âmes y boivent pour oublier leur vie passée avant de renaître.',
      'Chez Hésiode, Léthé (l\'Oubli) est une fille d\'Éris, la Discorde, avec la Peine, la Faim et les Querelles.',
      'Platon raconte dans la République qu\'après avoir bu au fleuve Amélès, dans la plaine du Léthé, les âmes oublient tout ; Virgile place la scène dans l\'Énéide.',
      'Son contraire est Mnémosyne, la Mémoire, mère des Muses. À l\'oracle de Trophonios, on buvait aux deux sources : Léthé pour oublier, Mnémosyne pour se souvenir.',
    ],
    sources: 'Hésiode, Théogonie ; Platon, République, X ; Virgile, Énéide, VI ; Pausanias, IX, 39.',
    inGame: "Au camp, Léthé endort l'attention dans le dernier tiers du texte, là où l'on ne relit plus.",
  },
  {
    key: 'eris',
    name: 'Éris',
    kind: 'boss',
    art: ART.eris,
    teaser: "La déesse de la Discorde, celle qui lança la pomme d'or.",
    facts: [
      "Éris est la déesse de la Discorde. Homère en fait la sœur d'Arès, le dieu de la guerre ; Hésiode, une fille de la Nuit.",
      'Non invitée au mariage de Thétis et Pélée, elle jeta une pomme d\'or « à la plus belle ». Héra, Athéna et Aphrodite se la disputèrent : ce fut le début de la guerre de Troie.',
      'Hésiode distingue deux Éris : la mauvaise, qui pousse à la guerre, et la bonne, qui pousse à faire mieux que son voisin, comme le potier jaloux du potier.',
      'Ses enfants sont la Peine, l\'Oubli (Léthé), la Faim, les Douleurs, les Combats, les Mensonges et le Serment.',
    ],
    sources: 'Homère, Iliade, IV ; Hésiode, Théogonie et Les Travaux et les Jours ; Chants cypriens (résumé de Proclos).',
    inGame: "Au camp, Éris sème les dés-accords. Ses lieutenants sont chacun une de ses ruses ; elle-même les rassemble toutes.",
  },
  {
    key: 'argus',
    name: 'Argus aux cent yeux',
    kind: 'tool',
    art: ART.emblems.argus,
    teaser: 'Le gardien qui ne dormait jamais tout entier.',
    facts: [
      'Argus Panoptès (« qui voit tout ») avait cent yeux ; quand certains dormaient, les autres veillaient.',
      'Héra le chargea de garder Io, changée en génisse. Hermès l\'endormit en jouant de la syrinx (la flûte de Pan) et lui coupa la tête.',
      'Héra plaça ses yeux sur la queue du paon, son oiseau : c\'est pour cela que les plumes du paon ont des « yeux ».',
    ],
    sources: 'Ovide, Métamorphoses, I ; Apollodore, Bibliothèque, II, 1.',
    inGame: "Les Yeux d'Argus éclairent une seule catégorie de mots à la fois pendant la relecture.",
  },
  {
    key: 'ariane',
    name: 'Ariane et son fil',
    kind: 'tool',
    art: ART.emblems.ariane,
    teaser: 'Le fil qui permit de sortir du Labyrinthe.',
    facts: [
      'Ariane, fille du roi Minos de Crète, donna à Thésée une pelote de fil pour retrouver la sortie du Labyrinthe construit par Dédale.',
      'Thésée tua le Minotaure, mi-homme mi-taureau, et suivit le fil pour ressortir.',
      'Abandonnée par Thésée sur l\'île de Naxos, Ariane fut recueillie par le dieu Dionysos qui l\'épousa.',
    ],
    sources: 'Apollodore, Épitomé, I ; Plutarque, Vie de Thésée ; Ovide, Métamorphoses, VIII.',
    inGame: "Le Fil d'Ariane relie un verbe à son sujet : tu tires le fil pour vérifier l'accord.",
  },
  {
    key: 'persee',
    name: 'Persée et le bouclier',
    kind: 'tool',
    art: ART.emblems.persee,
    teaser: 'Le héros qui regarda Méduse sans la regarder.',
    facts: [
      'Persée devait rapporter la tête de Méduse, dont le regard changeait en pierre. Athéna lui prêta un bouclier poli comme un miroir pour la viser sans la regarder en face.',
      'Il reçut aussi des sandales ailées, un casque qui rend invisible et une besace pour transporter la tête.',
      'Du sang de Méduse naquit le cheval ailé Pégase.',
    ],
    sources: 'Hésiode, Théogonie ; Apollodore, Bibliothèque, II, 4 ; Ovide, Métamorphoses, IV.',
    inGame: 'Le Bouclier de Persée montre une phrase à la fois, de la dernière à la première, pour relire sans se laisser emporter.',
  },
  {
    key: 'athena',
    name: "La chouette d'Athéna",
    kind: 'tool',
    art: ART.emblems.athena,
    teaser: "L'oiseau de la déesse de la sagesse.",
    facts: [
      "La chouette chevêche est l'oiseau d'Athéna, déesse de la sagesse, de la stratégie et des artisans.",
      'Les pièces d\'argent d\'Athènes portaient une chouette : on les appelait des « chouettes ». D\'où l\'expression « porter des chouettes à Athènes », faire quelque chose d\'inutile.',
      'Athéna est née tout armée de la tête de Zeus. Elle donna son nom à Athènes après avoir offert l\'olivier à la ville.',
    ],
    sources: 'Hésiode, Théogonie ; Aristophane, Les Oiseaux ; Apollodore, Bibliothèque, III, 14.',
    inGame: "La Chouette d'Athéna révèle où se cache une erreur : un indice, pas la réponse.",
  },
  {
    key: 'muses',
    name: 'Les Muses',
    kind: 'place',
    art: ART.scenes.parchemins,
    teaser: 'Neuf déesses des arts et de la mémoire.',
    facts: [
      'Les neuf Muses sont les filles de Zeus et de Mnémosyne, la Mémoire. Elles vivent sur le mont Hélicon et l\'Olympe.',
      'Chacune protège un art : Calliope la poésie épique, Clio l\'histoire, Euterpe la musique, Thalie la comédie, Melpomène la tragédie, Terpsichore la danse, Érato la poésie amoureuse, Polymnie les hymnes, Uranie l\'astronomie.',
      'Les poètes grecs commencent leurs chants en invoquant les Muses : « Chante, déesse… » ouvre l\'Iliade.',
    ],
    sources: 'Hésiode, Théogonie ; Homère, Iliade, I.',
    inGame: "Au camp, les Muses t'ont choisi pour protéger les textes ; elles allument et éteignent les aides à la relecture.",
  },
  {
    key: 'delphes',
    name: "Delphes et l'Oracle",
    kind: 'place',
    art: ART.scenes.delphes,
    teaser: 'Le sanctuaire où Apollon répondait par la bouche de la Pythie.',
    facts: [
      'À Delphes, sur les pentes du Parnasse, la Pythie, prêtresse d\'Apollon, rendait des oracles souvent à double sens.',
      'Les Grecs y voyaient le centre du monde, marqué par une pierre appelée omphalos (« nombril »).',
      'Sur le temple étaient gravées des maximes comme « Connais-toi toi-même » et « Rien de trop ».',
      'Les cités venaient y consulter avant une guerre ou la fondation d\'une colonie ; des Jeux pythiques s\'y tenaient tous les quatre ans.',
    ],
    sources: "Hérodote, Histoires, I ; Pausanias, Description de la Grèce, X ; Plutarque, Sur l'E de Delphes.",
    inGame: "Au camp, l'Oracle propose chaque semaine trois rouleaux scellés : tu en ouvres un, et c'est ta quête de la semaine.",
  },
  {
    key: 'dragon',
    name: 'Le dragon des Muses',
    kind: 'companion',
    art: ART.dragon.young,
    teaser: 'Un compagnon aux écailles de bronze.',
    facts: [
      "Dans les mythes grecs, les dragons sont de grands serpents gardiens : Ladon veillait sur les pommes d'or du jardin des Hespérides.",
      'Python, un serpent-dragon, gardait Delphes avant qu\'Apollon ne le tue et n\'y installe son oracle.',
      'Le dragon de Colchide gardait la Toison d\'or ; Médée l\'endormit pour que Jason puisse la prendre.',
    ],
    sources: 'Hésiode, Théogonie ; Apollonios de Rhodes, Argonautiques, IV ; Apollodore, Bibliothèque, II, 5.',
    inGame: "Au camp, ton dragon est une créature inventée pour le jeu, cousine lointaine de Ladon : il grandit à chaque ruse d'Éris que tu neutralises.",
  },
];

export function entry(key: string): BestiaryEntry | undefined {
  return BESTIARY.find((e) => e.key === key);
}
